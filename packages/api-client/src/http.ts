import type { ApiResponse } from '@personal-hub/shared-types';

export interface NestEnvelope<T> {
  data: T;
  requestId?: string;
}

export function toApiResponse<T>(data: T, requestId?: string): ApiResponse<T> {
  return { code: 0, message: 'ok', data, requestId };
}

export function nestHttpStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } }).response?.status;
}

function readResponseHeader(headers: unknown, name: string): string | undefined {
  if (!headers || typeof headers !== 'object') {
    return undefined;
  }
  const bag = headers as {
    get?: (key: string) => string | undefined;
    [key: string]: unknown;
  };
  if (typeof bag.get === 'function') {
    const fromGetter = bag.get(name) ?? bag.get(name.toLowerCase());
    if (fromGetter) {
      return fromGetter;
    }
  }
  const raw = bag[name] ?? bag[name.toLowerCase()];
  if (typeof raw === 'string') {
    return raw;
  }
  if (Array.isArray(raw) && typeof raw[0] === 'string') {
    return raw[0];
  }
  return undefined;
}

/**
 * 从 Nest 错误响应取出业务码、文案，以及 429 的 Retry-After（秒）。
 * 登录冷却 UI 必须读 header：JSON message 只有「请稍后再试」，不含剩余时间。
 */
export function nestError(error: unknown): {
  code?: string;
  message?: string;
  retryAfterSeconds?: number;
} {
  const response = (
    error as {
      response?: {
        headers?: unknown;
        data?: { error?: { code?: string; message?: string } };
      };
    }
  )?.response;
  const retryAfterRaw = readResponseHeader(response?.headers, 'retry-after');
  const retryAfterSeconds = Number(retryAfterRaw);
  return {
    ...(response?.data?.error ?? {}),
    retryAfterSeconds:
      Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? Math.floor(retryAfterSeconds)
        : undefined,
  };
}

export interface AuthHttpOptions {
  method?: string;
  data?: unknown;
  params?: Record<string, unknown>;
  skipErrorHandler?: boolean;
}

/** 由各 app 注入；用户端 / 管理端传入 Umi `request`。 */
export type AuthHttpRequest = <T>(
  url: string,
  options?: AuthHttpOptions,
) => Promise<T>;
