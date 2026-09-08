import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataScope } from '@prisma/client';
import type { Request } from 'express';
import {
  REQUIRED_DATA_SCOPE_KEY,
  REQUIRED_PERMISSION_KEY,
} from '../../common/decorators/require-permission.decorator';
import { DomainHttpException } from '../../common/errors/domain-http.exception';
import { AuthService } from './auth.service';
import type { PermissionCode } from './rbac-catalog';

/**
 * 只在声明了 @RequirePermission 的路由上拦截。
 * 权限来自当前角色快照，不信任 JWT 或客户端传入的权限列表。
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionCode | undefined>(
      REQUIRED_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (required === undefined) {
      return true;
    }
    const requiredScope = this.reflector.getAllAndOverride<DataScope | undefined>(
      REQUIRED_DATA_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<Request>();
    const auth = request.auth;
    if (auth === undefined) {
      throw new DomainHttpException(HttpStatus.UNAUTHORIZED, 'AUTH_REQUIRED', '未登录或登录已失效');
    }

    const snapshot = await this.authService.getPermissionSnapshot(
      auth.userId,
      auth.permissionVersion,
    );
    const grant = snapshot.permissions.find((item) => item.code === required);
    if (!grant) {
      throw new DomainHttpException(HttpStatus.FORBIDDEN, 'AUTH_FORBIDDEN', '没有执行该操作的权限');
    }
    if (requiredScope !== undefined && grant.dataScope !== requiredScope) {
      throw new DomainHttpException(HttpStatus.FORBIDDEN, 'AUTH_FORBIDDEN', '没有执行该操作的权限');
    }
    return true;
  }
}
