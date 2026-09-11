import type { Request } from 'express';

export interface RequestAuthContext {
  userId: string;
  sessionId: string;
  authVersion: number;
  permissionVersion: number;
}

declare global {
  namespace Express {
    interface Request {
      /** 服务端生成的请求关联 ID，用于响应与日志追踪。 */
      requestId: string;
      /** JwtAuthGuard 校验通过后写入的会话上下文。 */
      auth?: RequestAuthContext;
      /** 匿名 AI 主体 UUID，仅 /public/ai 写入。 */
      aiAnonymousId?: string;
    }
  }
}

export type RequestWithId = Request & {
  requestId: string;
  auth?: RequestAuthContext;
};
