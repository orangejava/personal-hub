import type { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      /** 服务端生成的请求关联 ID，用于响应与日志追踪。 */
      requestId: string;
    }
  }
}

export type RequestWithId = Request & {
    requestId: string;
};
