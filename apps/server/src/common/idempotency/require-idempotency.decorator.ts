import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENCY_REQUIRED_KEY = 'idempotencyRequired';
export const IDEMPOTENCY_OPTIONS_KEY = 'idempotencyOptions';

export interface IdempotencyOptions {
  /** 高风险异步或权限写入需保留 7 天，普通写入保留 24 小时。 */
  highRisk?: boolean;
  /** SSE 只校验请求带键，不持久化普通 JSON 响应。 */
  stream?: boolean;
}

/** 标记该写接口必须携带 Idempotency-Key，并可声明记录保留期。 */
export const RequireIdempotency = (options: IdempotencyOptions = {}): MethodDecorator => {
  const required = SetMetadata(IDEMPOTENCY_REQUIRED_KEY, true);
  const configured = SetMetadata(IDEMPOTENCY_OPTIONS_KEY, options);
  return (target, propertyKey, descriptor) => {
    required(target, propertyKey, descriptor);
    configured(target, propertyKey, descriptor);
  };
};
