import { SetMetadata } from '@nestjs/common';
import { DataScope } from '@prisma/client';
import type { PermissionCode } from '../../modules/auth/rbac-catalog';

export const REQUIRED_PERMISSION_KEY = 'requiredPermission';
export const REQUIRED_DATA_SCOPE_KEY = 'requiredPermissionDataScope';

/**
 * 声明该路由需要的动作权限。PermissionsGuard 在 JWT 之后检查，无元数据则放行。
 * 后台审核、代发布、版权闸等传入 `DataScope.ALL`，避免编辑者凭 OWN 打到后台写接口。
 */
export const RequirePermission = (code: PermissionCode, dataScope?: DataScope): MethodDecorator => {
  const permission = SetMetadata(REQUIRED_PERMISSION_KEY, code);
  const scope = SetMetadata(REQUIRED_DATA_SCOPE_KEY, dataScope);
  return (target, propertyKey, descriptor) => {
    permission(target, propertyKey, descriptor);
    if (dataScope !== undefined) {
      scope(target, propertyKey, descriptor);
    }
  };
};
