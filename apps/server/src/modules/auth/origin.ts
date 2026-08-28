import { HttpStatus } from '@nestjs/common';
import { DomainHttpException } from '../../common/errors/domain-http.exception';

/**
 * Cookie 鉴权接口必须校验浏览器 Origin / Referer，避免跨站带 Cookie 调用刷新或登出。
 *
 * 开发期请求经 Umi `:8000` 代理到 Nest `:3001`。浏览器 Network 里的 Origin 仍是
 * `http://localhost:8000`，但 `changeOrigin: true` 可能把 Nest 实际收到的 Origin
 * 改成 `http://127.0.0.1:3001`。此时应以仍指向前端页的 Referer 为准。
 */
export function assertSameOrigin(
  originHeader: string | undefined,
  refererHeader: string | undefined,
  allowedOrigin: string,
): void {
  const headerOrigin = readOriginHeader(originHeader);
  const refererOrigin = readRefererOrigin(refererHeader);
  const requestOrigin =
    headerOrigin === allowedOrigin
      ? headerOrigin
      : refererOrigin === allowedOrigin
        ? refererOrigin
        : (headerOrigin ?? refererOrigin);

  if (requestOrigin === allowedOrigin) {
    return;
  }

  throw new DomainHttpException(
    HttpStatus.FORBIDDEN,
    'AUTH_ORIGIN_FORBIDDEN',
    '请求来源不被允许',
    [{ received: requestOrigin, allowed: allowedOrigin }],
  );
}

function readOriginHeader(originHeader: string | undefined): string | null {
  if (originHeader === undefined || originHeader.length === 0) {
    return null;
  }
  return originHeader;
}

function readRefererOrigin(refererHeader: string | undefined): string | null {
  if (refererHeader === undefined || refererHeader.length === 0) {
    return null;
  }
  try {
    return new URL(refererHeader).origin;
  } catch {
    return null;
  }
}
