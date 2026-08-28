import { SetMetadata } from '@nestjs/common';
import type { PermissionCode } from '../../modules/auth/rbac-catalog';

export const REQUIRED_PERMISSION_KEY = 'requiredPermission';

/**
 * 声明该路由需要的动作权限。PermissionsGuard 在 JWT 之后检查，无元数据则放行。
 */
export const RequirePermission = (code: PermissionCode) =>
  SetMetadata(REQUIRED_PERMISSION_KEY, code);
