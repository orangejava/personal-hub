import type { MenuItem, PermissionCode } from '@personal-hub/shared-types';
import { mapNestMenusToLayout, type NestMenuNode } from './routeRegistry';

export interface NestPermissionGrant {
  code: string;
  dataScope: 'OWN' | 'ALL';
}

export interface NestPermissionSnapshot {
  permissions: NestPermissionGrant[];
  menus: NestMenuNode[];
}

export interface AdaptedPermissions {
  /** 供 access.ts / PermissionGate 使用，含 mock 兼容码 */
  permissions: PermissionCode[];
  /** Canonical 动作权限与数据范围，供后续业务层使用 */
  permissionGrants: NestPermissionGrant[];
  menu: MenuItem[];
}

const MOCK_COMPAT_CODES: readonly PermissionCode[] = [
  'content:read',
  'content:write',
  'content:publish',
  'content:delete',
  'booklet:read',
  'booklet:write',
  'workspace:access',
  'admin:access',
  'user:manage',
  'role:manage',
  'ai:use',
  'ai:manage',
  'system:config',
];

/**
 * 把 Nest `/auth/permissions` 转成当前 React 仍在使用的权限码和布局菜单。
 * 真实接口校验仍以 Nest Guard 为准；这里只解决路由守卫和按钮显隐。
 */
export function adaptNestPermissions(
  snapshot: NestPermissionSnapshot,
): AdaptedPermissions {
  const codes = new Set(snapshot.permissions.map((item) => item.code));
  const menu = mapNestMenusToLayout(snapshot.menus);
  const permissions = new Set<PermissionCode>();

  for (const code of MOCK_COMPAT_CODES) {
    if (codes.has(code)) {
      permissions.add(code);
    }
  }

  if (codes.has('content:create') || codes.has('content:update')) {
    permissions.add('content:write');
  }
  if (codes.has('content:read')) {
    permissions.add('booklet:read');
  }
  if (codes.has('booklet:import')) {
    permissions.add('booklet:write');
  }
  if (
    codes.has('user:read') ||
    codes.has('user:status:update') ||
    codes.has('user:role:assign')
  ) {
    permissions.add('user:manage');
  }
  if (codes.has('system:config:manage')) {
    permissions.add('system:config');
  }
  if (
    [...codes].some(
      (code) => code.startsWith('ai:') && code.endsWith(':manage'),
    )
  ) {
    permissions.add('ai:manage');
  }

  // 登录用户都有个人能力；菜单可见性才决定能否进工作区/后台。
  permissions.add('ai:use');
  if (hasMenuPath(menu, '/workspace')) {
    permissions.add('workspace:access');
  }
  if (hasMenuPath(menu, '/admin')) {
    permissions.add('admin:access');
  }

  return {
    permissions: [...permissions],
    permissionGrants: snapshot.permissions,
    menu,
  };
}

function hasMenuPath(menu: MenuItem[], path: string): boolean {
  return menu.some(
    (item) =>
      item.path === path ||
      item.path.startsWith(`${path}/`) ||
      (item.children ? hasMenuPath(item.children, path) : false),
  );
}
