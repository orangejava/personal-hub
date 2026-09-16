import { HttpStatus } from '@nestjs/common';
import { DomainHttpException } from '../../common/errors/domain-http.exception';

function normalizeOrigin(value: string): string {
  return value.replace(/\/$/, '');
}

function toAllowedList(allowedOrigins: string | string[]): string[] {
  const list = Array.isArray(allowedOrigins) ? allowedOrigins : [allowedOrigins];
  return list.map(normalizeOrigin);
}

/**
 * Cookie 鉴权接口必须校验浏览器 Origin / Referer，避免跨站带 Cookie 调用刷新或登出。
 *
 * 开发期请求经 Umi 代理到 Nest `:3001`。浏览器 Network 里的 Origin 仍是前端端口
 *（用户端 `:8000` 或管理端 `:8001`），但 `changeOrigin: true` 可能把 Nest 实际收到的
 * Origin 改成 `http://127.0.0.1:3001`。此时应以仍指向前端页的 Referer 为准。
 *
 * @param originHeader 请求 Origin
 * @param refererHeader 请求 Referer
 * @param allowedOrigins 单个 Origin 或白名单；来自解析后的 `CORS_ORIGIN`
 */
export function assertSameOrigin(
  originHeader: string | undefined,
  refererHeader: string | undefined,
  allowedOrigins: string | string[],
): void {
  const allowed = toAllowedList(allowedOrigins);
  const headerOrigin = readOriginHeader(originHeader);
  const refererOrigin = readRefererOrigin(refererHeader);
  const requestOrigin =
    headerOrigin && allowed.includes(headerOrigin)
      ? headerOrigin
      : refererOrigin && allowed.includes(refererOrigin)
        ? refererOrigin
        : (headerOrigin ?? refererOrigin);

  if (requestOrigin && allowed.includes(requestOrigin)) {
    return;
  }

  throw new DomainHttpException(
    HttpStatus.FORBIDDEN,
    'AUTH_ORIGIN_FORBIDDEN',
    '请求来源不被允许',
    [{ received: requestOrigin, allowed }],
  );
}

function readOriginHeader(originHeader: string | undefined): string | null {
  if (originHeader === undefined || originHeader.length === 0) {
    return null;
  }
  return normalizeOrigin(originHeader);
}

function readRefererOrigin(refererHeader: string | undefined): string | null {
  if (refererHeader === undefined || refererHeader.length === 0) {
    return null;
  }
  try {
    return normalizeOrigin(new URL(refererHeader).origin);
  } catch {
    return null;
  }
}
