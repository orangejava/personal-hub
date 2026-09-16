import type { PermissionCode } from '@personal-hub/shared-types';
import { useAccess } from '@umijs/max';
import React from 'react';
import ForbiddenState from '../ForbiddenState';

interface PermissionGateProps {
  /** 需要的权限点，满足其一即放行 */
  permissions: PermissionCode[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/** 根据权限点控制局部渲染。路由级 403 走 access，这里只挡块级按钮/分区。 */
const PermissionGate: React.FC<PermissionGateProps> = ({
  permissions,
  children,
  fallback,
}) => {
  const access = useAccess() as { can: (code: PermissionCode) => boolean };
  const allowed = permissions.some((p) => access.can(p));
  if (allowed) return <>{children}</>;
  return <>{fallback ?? <ForbiddenState />}</>;
};

export default PermissionGate;
