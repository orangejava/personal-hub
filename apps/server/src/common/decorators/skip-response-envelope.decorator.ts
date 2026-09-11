import { SetMetadata } from '@nestjs/common';

export const SKIP_RESPONSE_ENVELOPE_KEY = 'skipResponseEnvelope';

/** SSE 等已自行写 Response 的路由不要再包 `{ data, requestId }`。 */
export const SkipResponseEnvelope = (): MethodDecorator =>
  SetMetadata(SKIP_RESPONSE_ENVELOPE_KEY, true);
