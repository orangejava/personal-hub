import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * 不信任客户端提供的关联 ID，统一在服务端生成，保证日志、响应与后续异步任务可可靠关联。
 */
export function assignRequestId(request: Request, response: Response, next: NextFunction): void {
  const requestId = randomUUID();
  request.requestId = requestId;
  response.setHeader('X-Request-Id', requestId);
  next();
}
