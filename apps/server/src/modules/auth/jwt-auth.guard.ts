import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { DomainHttpException } from '../../common/errors/domain-http.exception';
import type { RequestAuthContext } from '../../common/types/request-id';
import { AuthService } from './auth.service';
import type { AccessTokenPayload } from './token.types';

/**
 * 校验 Access JWT，并用 Redis/数据库会话版本拒绝已撤销或权限已变更的令牌。
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.readBearerToken(request.headers.authorization);
    if (token === null) {
      throw new DomainHttpException(HttpStatus.UNAUTHORIZED, 'AUTH_REQUIRED', '未登录或登录已失效');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        algorithms: ['HS256'],
      });
    } catch {
      throw new DomainHttpException(HttpStatus.UNAUTHORIZED, 'AUTH_REQUIRED', '未登录或登录已失效');
    }

    if (
      typeof payload.sub !== 'string' ||
      typeof payload.sid !== 'string' ||
      typeof payload.av !== 'number' ||
      typeof payload.pv !== 'number'
    ) {
      throw new DomainHttpException(HttpStatus.UNAUTHORIZED, 'AUTH_REQUIRED', '未登录或登录已失效');
    }

    const session = await this.authService.assertActiveSession({
      userId: payload.sub,
      sessionId: payload.sid,
      authVersion: payload.av,
      permissionVersion: payload.pv,
    });

    if (session.mustChangePassword && !this.isAllowedWhileMustChangePassword(request)) {
      throw new DomainHttpException(
        HttpStatus.FORBIDDEN,
        'AUTH_PASSWORD_CHANGE_REQUIRED',
        '请先修改临时密码后再继续',
      );
    }

    const auth: RequestAuthContext = {
      userId: session.userId,
      sessionId: session.sessionId,
      authVersion: session.authVersion,
      permissionVersion: session.permissionVersion,
    };
    request.auth = auth;
    return true;
  }

  /**
   * 临时密码账号只允许改密和读取自身身份。登出已是 @Public()，不走本 Guard。
   */
  private isAllowedWhileMustChangePassword(request: Request): boolean {
    const path = request.path;
    const method = request.method.toUpperCase();
    if (method === 'GET' && (path.endsWith('/auth/me') || path.endsWith('/auth/permissions'))) {
      return true;
    }
    return method === 'POST' && path.endsWith('/auth/change-password');
  }

  private readBearerToken(header: string | undefined): string | null {
    if (header === undefined || !header.startsWith('Bearer ')) {
      return null;
    }
    const token = header.slice('Bearer '.length).trim();
    return token.length > 0 ? token : null;
  }
}
