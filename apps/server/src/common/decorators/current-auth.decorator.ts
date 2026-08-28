import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { RequestAuthContext } from '../types/request-id';

/**
 * 读取 JwtAuthGuard 写入的会话上下文。
 * 只在受保护路由使用；公开接口没有 auth。
 */
export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestAuthContext => {
    const request = context.switchToHttp().getRequest<{ auth?: RequestAuthContext }>();
    if (request.auth === undefined) {
      throw new Error('受保护路由缺少 auth 上下文，说明 Guard 未生效。');
    }
    return request.auth;
  },
);
