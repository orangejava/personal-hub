import { CallHandler, ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SKIP_RESPONSE_ENVELOPE_KEY } from '../decorators/skip-response-envelope.decorator';
import type { RequestWithId } from '../types/request-id';

export interface ApiSuccess<T> {
  data: T;
  requestId: string;
}

/**
 * 只包成功体 `{ data, requestId }`。异常不经过这里，由 HttpExceptionFilter 写 `{ error, requestId }`。
 */
@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<T, ApiSuccess<T>> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccess<T>> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_RESPONSE_ENVELOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return next.handle() as Observable<ApiSuccess<T>>;
    }
    const request = context.switchToHttp().getRequest<RequestWithId>();

    return next.handle().pipe(
      map((data) => ({
        data,
        requestId: request.requestId,
      })),
    );
  }
}
