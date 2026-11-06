import { lookup } from 'node:dns';
import { request } from 'node:https';
import { isIP } from 'node:net';
import { Readable } from 'node:stream';
import { HttpStatus } from '@nestjs/common';
import { DomainHttpException } from '../../common/errors/domain-http.exception';

export function isPublicIpv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split('.').map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}

export function isPublicIpv6(address: string): boolean {
  if (isIP(address) !== 6) return false;
  let normalized = address.toLowerCase().split('%')[0];
  // Node 的 IPv6 解析结果可能保留 IPv4 dotted tail（如 ::ffff:127.0.0.1）。
  // 先转成两个十六进制分组，才能统一走 128 位地址判断。
  const dottedTail = normalized.match(/((?:\d{1,3}\.){3}\d{1,3})$/)?.[1];
  if (dottedTail) {
    const octets = dottedTail.split('.').map(Number);
    if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
      return false;
    }
    const high = ((octets[0] << 8) | octets[1]).toString(16);
    const low = ((octets[2] << 8) | octets[3]).toString(16);
    normalized = `${normalized.slice(0, -dottedTail.length)}${high}:${low}`;
  }
  const groups = normalized.split('::');
  const left = groups[0] ? groups[0].split(':') : [];
  const right = groups[1] ? groups[1].split(':') : [];
  const expanded =
    groups.length === 2
      ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right]
      : left;
  if (expanded.length !== 8) return false;
  let value = 0n;
  for (const group of expanded) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return false;
    value = (value << 16n) | BigInt(Number.parseInt(group, 16));
  }
  // DNS 可能以 IPv6 形式返回内嵌 IPv4 的地址；必须按 IPv4 私网规则再次校验。
  // NAT64 公共前缀与 IPv4-mapped 地址把 IPv4 放在末尾 32 位，6to4 放在前 48 位；
  // Teredo 的末尾 32 位则逐位取反。统一解码后复用 IPv4 私网规则。
  const embeddedIpv4 =
    value >> 32n === 0xffffn || value >> 32n === 0x64ff9bn << 64n
      ? value & 0xffffffffn
      : value >> 112n === 0x2002n
        ? (value >> 80n) & 0xffffffffn
        : value >> 96n === 0x20010000n
          ? (value & 0xffffffffn) ^ 0xffffffffn
          : null;
  if (embeddedIpv4 !== null) {
    const mappedIpv4 = [24n, 16n, 8n, 0n]
      .map((shift) => Number((embeddedIpv4 >> shift) & 0xffn))
      .join('.');
    return isPublicIpv4(mappedIpv4);
  }
  const first = Number(value >> 120n);
  const second = Number((value >> 112n) & 0xffn);
  // 未指定、回环、链路本地、唯一本地、组播和文档保留段均不可作为出站目标。
  return (
    value !== 0n &&
    value !== 1n &&
    first !== 0xff &&
    first !== 0xfe &&
    !(first === 0xfc || first === 0xfd) &&
    !(first === 0x20 && second === 0x01 && Number((value >> 104n) & 0xffn) === 0x0d)
  );
}

function isPublicAddress(address: string, family: number): boolean {
  return family === 4 ? isPublicIpv4(address) : isPublicIpv6(address);
}

/** 仅接受 HTTPS 域名；Node 的 URL.hostname 会给 IPv6 字面量保留方括号。 */
export function parseUserProviderUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new DomainHttpException(
      HttpStatus.BAD_REQUEST,
      'AI_PROVIDER_URL_INVALID',
      '自备厂商须使用公网 HTTPS 域名',
    );
  }
  const hostname =
    url.hostname.startsWith('[') && url.hostname.endsWith(']')
      ? url.hostname.slice(1, -1)
      : url.hostname;
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    isIP(hostname) !== 0 ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost')
  ) {
    throw new DomainHttpException(
      HttpStatus.BAD_REQUEST,
      'AI_PROVIDER_URL_INVALID',
      '自备厂商须使用公网 HTTPS 域名',
    );
  }
  return url;
}

/** 自备端点的 DNS 校验和 TCP 连接使用同一个解析结果，且不跟随重定向。 */
export async function userProviderFetch(
  urlText: string,
  init: {
    method: 'GET' | 'POST';
    headers: Record<string, string>;
    body?: string;
    signal: AbortSignal;
  },
): Promise<Response> {
  const url = parseUserProviderUrl(urlText);
  return new Promise<Response>((resolve, reject) => {
    const outgoing = request(
      url,
      {
        method: init.method,
        headers: init.headers,
        signal: init.signal,
        lookup(hostname, options, callback) {
          lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
            if (error) {
              return options.all ? callback(error, []) : callback(error, '', 0);
            }
            const target = addresses.find((entry) => isPublicAddress(entry.address, entry.family));
            if (!target) {
              const denied = new Error('AI_PROVIDER_PRIVATE_ADDRESS');
              return options.all ? callback(denied, []) : callback(denied, '', 0);
            }
            return options.all
              ? callback(null, [target])
              : callback(null, target.address, target.family);
          });
        },
      },
      (incoming) => {
        try {
          const headers = new Headers();
          for (const [key, value] of Object.entries(incoming.headers)) {
            if (typeof value === 'string') headers.set(key, value);
          }
          const status = incoming.statusCode ?? 502;
          const hasNoBody = status === 204 || status === 205 || status === 304;
          resolve(
            new Response(hasNoBody ? null : (Readable.toWeb(incoming) as BodyInit), {
              status,
              headers,
            }),
          );
        } catch {
          reject(
            new DomainHttpException(
              HttpStatus.BAD_GATEWAY,
              'AI_PROVIDER_CONNECTION_FAILED',
              '自备厂商响应格式无效',
            ),
          );
        }
      },
    );
    outgoing.on('error', () =>
      reject(
        new DomainHttpException(
          HttpStatus.BAD_GATEWAY,
          'AI_PROVIDER_CONNECTION_FAILED',
          '自备厂商连接失败或地址不可用',
        ),
      ),
    );
    if (init.body) outgoing.write(init.body);
    outgoing.end();
  });
}
