import { HttpStatus } from '@nestjs/common';
import { DomainHttpException } from '../../common/errors/domain-http.exception';

export interface ProviderProbeTarget {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  modelKey?: string;
}

/**
 * 管理端连接测试。不写用量、不预占额度。日志与异常都不带密钥。
 *
 * @param target 已解析的地址、密钥和可选模型
 * @returns 给人看的成功说明
 */
export async function probeProviderConnection(target: ProviderProbeTarget): Promise<string> {
  const timeoutMs = Math.min(Math.max(target.timeoutMs, 1), 20_000);
  const baseUrl = target.baseUrl.replace(/\/$/, '');
  let listed: Response;
  try {
    listed = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers: { authorization: `Bearer ${target.apiKey}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new DomainHttpException(
      HttpStatus.BAD_GATEWAY,
      'AI_PROVIDER_TEST_FAILED',
      '无法连接厂商',
    );
  }
  if (listed.status === 404 && target.modelKey) {
    return pingChatCompletion(baseUrl, target, timeoutMs);
  }
  const body = await readJson(listed);
  if (!listed.ok) {
    throw new DomainHttpException(
      HttpStatus.BAD_GATEWAY,
      'AI_PROVIDER_TEST_FAILED',
      `连接失败：HTTP ${listed.status}`,
    );
  }
  if (!target.modelKey) {
    return '已连通厂商模型列表';
  }
  if (listedModelKeys(body).includes(target.modelKey)) {
    return `模型 ${target.modelKey} 可用`;
  }
  throw new DomainHttpException(
    HttpStatus.BAD_GATEWAY,
    'AI_PROVIDER_TEST_FAILED',
    `厂商模型列表中没有 ${target.modelKey}`,
  );
}

async function pingChatCompletion(
  baseUrl: string,
  target: ProviderProbeTarget,
  timeoutMs: number,
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${target.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: target.modelKey,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        stream: false,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new DomainHttpException(
      HttpStatus.BAD_GATEWAY,
      'AI_PROVIDER_TEST_FAILED',
      '无法连接厂商',
    );
  }
  await readJson(response);
  if (!response.ok) {
    throw new DomainHttpException(
      HttpStatus.BAD_GATEWAY,
      'AI_PROVIDER_TEST_FAILED',
      `连接失败：HTTP ${response.status}`,
    );
  }
  return `模型 ${target.modelKey} 可用`;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    if (!text.trim()) throw new Error('empty response');
    return JSON.parse(text) as unknown;
  } catch {
    throw new DomainHttpException(
      HttpStatus.BAD_GATEWAY,
      'AI_PROVIDER_TEST_FAILED',
      '厂商响应不完整或不是 JSON',
    );
  }
}

function listedModelKeys(body: unknown): string[] {
  const rows = Array.isArray(body)
    ? body
    : body && typeof body === 'object' && Array.isArray((body as { data?: unknown }).data)
      ? (body as { data: unknown[] }).data
      : [];
  return rows.flatMap((row) => {
    if (typeof row === 'string') {
      return [row];
    }
    if (row && typeof row === 'object' && typeof (row as { id?: unknown }).id === 'string') {
      return [(row as { id: string }).id];
    }
    return [];
  });
}
