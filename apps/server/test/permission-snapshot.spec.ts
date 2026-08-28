import { MenuScope, MenuType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  buildFilteredMenuTree,
  isMenuVisibleTo,
  type MenuSnapshotRecord,
} from '../src/modules/auth/permission-snapshot';

function menu(
  partial: Partial<MenuSnapshotRecord> & Pick<MenuSnapshotRecord, 'id' | 'routeKey'>,
): MenuSnapshotRecord {
  return {
    name: partial.routeKey ?? partial.id,
    scope: MenuScope.ADMIN,
    type: MenuType.INTERNAL,
    parentId: null,
    externalUrl: null,
    sortOrder: 10,
    permissionCodes: [],
    ...partial,
  };
}

describe('权限菜单快照', () => {
  it('没有关联权限的菜单对所有登录用户可见', () => {
    expect(isMenuVisibleTo(menu({ id: 'home', routeKey: 'public.home' }), new Set())).toBe(true);
  });

  it('多权限菜单在拥有任一动作时可见', () => {
    const item = menu({
      id: 'ai',
      routeKey: 'admin.ai.config',
      permissionCodes: ['ai:provider:manage', 'ai:model:manage'],
    });
    expect(isMenuVisibleTo(item, new Set(['ai:model:manage']))).toBe(true);
    expect(isMenuVisibleTo(item, new Set(['content:read']))).toBe(false);
  });

  it('过滤后丢掉空目录，且不把孤儿子项挂到根上', () => {
    const tree = buildFilteredMenuTree(
      [
        menu({
          id: 'group',
          routeKey: 'admin.system.group',
          type: MenuType.DIRECTORY,
        }),
        menu({
          id: 'users',
          routeKey: 'admin.users',
          parentId: 'group',
          permissionCodes: ['user:read'],
        }),
        menu({
          id: 'orphan',
          routeKey: 'orphan.item',
          parentId: 'missing-parent',
        }),
        menu({
          id: 'public',
          routeKey: 'public.home',
          scope: MenuScope.PUBLIC,
        }),
      ],
      new Set(),
    );

    expect(tree.map((node) => node.routeKey)).toEqual(['public.home']);
  });

  it('有可见子项时保留目录', () => {
    const tree = buildFilteredMenuTree(
      [
        menu({
          id: 'group',
          routeKey: 'admin.system.group',
          type: MenuType.DIRECTORY,
          sortOrder: 40,
        }),
        menu({
          id: 'users',
          routeKey: 'admin.users',
          parentId: 'group',
          permissionCodes: ['user:read'],
          sortOrder: 10,
        }),
      ],
      new Set(['user:read']),
    );

    expect(tree).toHaveLength(1);
    expect(tree[0]?.routeKey).toBe('admin.system.group');
    expect(tree[0]?.children.map((node) => node.routeKey)).toEqual(['admin.users']);
  });

  it('按 sortOrder 排序', () => {
    const tree = buildFilteredMenuTree(
      [
        menu({ id: 'b', routeKey: 'b', sortOrder: 20 }),
        menu({ id: 'a', routeKey: 'a', sortOrder: 10 }),
      ],
      new Set(),
    );
    expect(tree.map((node) => node.routeKey)).toEqual(['a', 'b']);
  });
});
