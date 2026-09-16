import type { ApiResponse } from '@personal-hub/shared-types';

export interface NestEnvelope<T> {
  data: T;
  requestId?: string;
}

export function toApiResponse<T>(data: T, requestId?: string): ApiResponse<T> {
  return { code: 0, message: 'ok', data, requestId };
}

/** 与 Umi errorHandler 约定的业务错误：name 必须是 BizError。 */
export class HttpBizError extends Error {
  override name = 'BizError';
  info: { code: number | string; message?: string; data?: unknown };

  constructor(info: { code: number | string; message?: string; data?: unknown }) {
    super(info.message || '请求失败');
    this.info = info;
  }
}

/**
 * 把 Nest `{ data }` 或遗留 mock `{ code: 0, data }` 解成业务对象 T。
 * `code !== 0` 时抛 HttpBizError。已是业务对象则原样返回。
 */
export function unwrapHttpData<T>(body: unknown): T {
  if (body == null) {
    return body as T;
  }
  if (typeof body === 'object' && !Array.isArray(body) && 'code' in body) {
    const envelope = body as ApiResponse<T>;
    if (typeof envelope.code === 'number' && envelope.code !== 0) {
      throw new HttpBizError({
        code: envelope.code,
        message: envelope.message,
        data: envelope.data,
      });
    }
    if (typeof envelope.code === 'number') {
      return envelope.data as T;
    }
  }
  return readNestData(body as NestEnvelope<T> | T);
}

/** Nest 信封字段；Umi 有时会丢掉 requestId，只剩 `{ data }`。 */
const NEST_ENVELOPE_KEYS = new Set(['data', 'requestId', 'error', 'success']);

function isNestEnvelope<T>(res: unknown): res is NestEnvelope<T> {
  if (!res || typeof res !== 'object' || Array.isArray(res) || !('data' in res)) {
    return false;
  }
  const keys = Object.keys(res);
  return keys.length > 0 && keys.every((key) => NEST_ENVELOPE_KEYS.has(key));
}

/**
 * Umi 有时返回完整信封，有时因 dataField 已解包。
 * 只要求 requestId 会把 `{ data: 配置 }` 误当成业务对象，mapPublicSiteConfig 读 theme 就会抛。
 */
export function readNestData<T>(res: NestEnvelope<T> | T): T {
  if (isNestEnvelope<T>(res)) {
    return res.data;
  }
  return res as T;
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
 * 全局 toast 在 requestErrorConfig 里就地读 error.message（避开 MFSU），本函数给页面分支用。
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
