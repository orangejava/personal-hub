import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENCY_REQUIRED_KEY = 'idempotencyRequired';

/** 标记该写接口必须携带 Idempotency-Key。 */
export const RequireIdempotency = (): MethodDecorator =>
  SetMetadata(IDEMPOTENCY_REQUIRED_KEY, true);
