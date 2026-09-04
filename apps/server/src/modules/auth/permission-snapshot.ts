import { DataScope, MenuScope, MenuType } from '@prisma/client';

export const PERMISSION_CACHE_TTL_SECONDS = 60;

export interface PermissionGrant {
  code: string;
  dataScope: DataScope;
}

export interface MenuSnapshotRecord {
  id: string;
  scope: MenuScope;
  type: MenuType;
  name: string;
  localeKey?: string | null;
  icon?: string | null;
  openInNewTab?: boolean;
  parentId: string | null;
  routeKey: string | null;
  externalUrl: string | null;
  sortOrder: number;
  permissionCodes: string[];
}

export interface MenuTreeNode {
  id: string;
  scope: MenuScope;
  type: MenuType;
  name: string;
  localeKey?: string | null;
  icon?: string | null;
  openInNewTab?: boolean;
  routeKey: string | null;
  externalUrl: string | null;
  sortOrder: number;
  children: MenuTreeNode[];
}

export interface PermissionSnapshot {
  permissions: PermissionGrant[];
  menus: MenuTreeNode[];
}

/**
 * 菜单关联多个权限时，拥有其中任一动作即可看见（PRD：OR）。
 * 没有关联权限的菜单对所有已登录用户可见。
 */
export function isMenuVisibleTo(
  menu: MenuSnapshotRecord,
  grantedCodes: ReadonlySet<string>,
): boolean {
  if (menu.permissionCodes.length === 0) {
    return true;
  }
  return menu.permissionCodes.some((code) => grantedCodes.has(code));
}

/**
 * 按权限过滤后组装树，并丢掉过滤后没有子项的目录。
 */
export function buildFilteredMenuTree(
  menus: readonly MenuSnapshotRecord[],
  grantedCodes: ReadonlySet<string>,
): MenuTreeNode[] {
  const visible = menus.filter((menu) => isMenuVisibleTo(menu, grantedCodes));
  const visibleIds = new Set(visible.map((menu) => menu.id));
  const byId = new Map<string, MenuTreeNode>();

  for (const menu of visible) {
    byId.set(menu.id, {
      id: menu.id,
      scope: menu.scope,
      type: menu.type,
      name: menu.name,
      localeKey: menu.localeKey ?? null,
      icon: menu.icon ?? null,
      openInNewTab: menu.openInNewTab ?? false,
      routeKey: menu.routeKey,
      externalUrl: menu.externalUrl,
      sortOrder: menu.sortOrder,
      children: [],
    });
  }

  const roots: MenuTreeNode[] = [];
  for (const menu of visible) {
    const node = byId.get(menu.id);
    if (node === undefined) {
      continue;
    }

    // 父节点被权限过滤掉时，子项不再挂到根上，避免后台项泄漏到公开区。
    if (menu.parentId !== null && visibleIds.has(menu.parentId)) {
      byId.get(menu.parentId)?.children.push(node);
      continue;
    }
    if (menu.parentId === null) {
      roots.push(node);
    }
  }

  return pruneAndSort(roots);
}

function pruneAndSort(nodes: MenuTreeNode[]): MenuTreeNode[] {
  const next = nodes
    .map((node) => ({ ...node, children: pruneAndSort(node.children) }))
    .filter((node) => node.type !== MenuType.DIRECTORY || node.children.length > 0);

  next.sort(
    (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
  );
  return next;
}
