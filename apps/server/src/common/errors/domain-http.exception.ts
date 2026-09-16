import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 带领域错误码的 HTTP 异常，供 Filter 原样写入 error.code，避免客户端只能看到泛化状态码。
 * `retryAfterSeconds` 仅给 429 使用：Filter 写成 `Retry-After`，契约要求客户端知道窗口还剩多久。
 */
export class DomainHttpException extends HttpException {
  readonly retryAfterSeconds?: number;

  constructor(
    status: HttpStatus,
    code: string,
    message: string,
    details: unknown[] = [],
    options?: { retryAfterSeconds?: number },
  ) {
    super({ code, message, details }, status);
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}
