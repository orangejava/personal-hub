import { MenuScope, MenuType, PrismaClient } from '@prisma/client';
import {
  PERMISSION_CATALOG,
  SYSTEM_ROLE_DATA_SCOPE,
  SYSTEM_ROLE_DEFINITIONS,
  SYSTEM_ROLE_PERMISSIONS,
  type PermissionCode,
} from '../src/modules/auth/rbac-catalog';

const prisma = new PrismaClient();

interface SystemMenuDefinition {
  routeKey: string;
  scope: MenuScope;
  type: MenuType;
  name: string;
  parentRouteKey?: string;
  sortOrder: number;
  permissionCodes: readonly PermissionCode[];
}

/**
 * M1 最小导航。菜单权限只决定展示，后续 Controller 仍需通过 Guard 强制校验。
 */
const SYSTEM_MENUS: readonly SystemMenuDefinition[] = [
  {
    routeKey: 'public.home',
    scope: MenuScope.PUBLIC,
    type: MenuType.INTERNAL,
    name: '首页',
    sortOrder: 10,
    permissionCodes: [],
  },
  {
    routeKey: 'public.contents',
    scope: MenuScope.PUBLIC,
    type: MenuType.INTERNAL,
    name: '内容中心',
    sortOrder: 20,
    permissionCodes: [],
  },
  {
    routeKey: 'workspace.dashboard',
    scope: MenuScope.WORKSPACE,
    type: MenuType.INTERNAL,
    name: '工作区',
    sortOrder: 10,
    permissionCodes: [],
  },
  {
    routeKey: 'workspace.contents',
    scope: MenuScope.WORKSPACE,
    type: MenuType.INTERNAL,
    name: '我的内容',
    parentRouteKey: 'workspace.dashboard',
    sortOrder: 20,
    permissionCodes: ['content:read'],
  },
  {
    routeKey: 'admin.dashboard',
    scope: MenuScope.ADMIN,
    type: MenuType.INTERNAL,
    name: '后台概览',
    sortOrder: 10,
    permissionCodes: ['dashboard:read'],
  },
  {
    routeKey: 'admin.users',
    scope: MenuScope.ADMIN,
    type: MenuType.INTERNAL,
    name: '用户管理',
    sortOrder: 20,
    permissionCodes: ['user:read'],
  },
  {
    routeKey: 'admin.roles',
    scope: MenuScope.ADMIN,
    type: MenuType.INTERNAL,
    name: '角色与权限',
    sortOrder: 30,
    permissionCodes: ['role:read'],
  },
  {
    routeKey: 'admin.menus',
    scope: MenuScope.ADMIN,
    type: MenuType.INTERNAL,
    name: '菜单管理',
    sortOrder: 40,
    permissionCodes: ['menu:manage'],
  },
];

/**
 * 将设计确认的基础目录收敛到一次可重放操作。
 *
 * 仅重置四个系统角色和本文件声明的系统菜单关联，不触碰未来自定义角色或菜单。
 */
export async function runBaselineSeed(client: PrismaClient): Promise<void> {
  await client.$transaction(async (tx) => {
    for (const role of SYSTEM_ROLE_DEFINITIONS) {
      await tx.role.upsert({
        where: { code: role.code },
        create: {
          code: role.code,
          label: role.label,
          isSystem: true,
          isProtected: role.isProtected,
        },
        update: {
          label: role.label,
          isSystem: true,
          isProtected: role.isProtected,
        },
      });
    }

    for (const permission of PERMISSION_CATALOG) {
      await tx.permission.upsert({
        where: { code: permission.code },
        create: permission,
        update: {
          group: permission.group,
          label: permission.label,
          description: permission.description,
        },
      });
    }

    const roles = await tx.role.findMany({
      where: { code: { in: SYSTEM_ROLE_DEFINITIONS.map(({ code }) => code) } },
      select: { id: true, code: true },
    });
    const roleIdByCode = new Map(roles.map((role) => [role.code, role.id]));

    const permissions = await tx.permission.findMany({
      where: { code: { in: PERMISSION_CATALOG.map(({ code }) => code) } },
      select: { id: true, code: true },
    });
    const permissionIdByCode = new Map(
      permissions.map((permission) => [permission.code, permission.id]),
    );

    if (
      roleIdByCode.size !== SYSTEM_ROLE_DEFINITIONS.length ||
      permissionIdByCode.size !== PERMISSION_CATALOG.length
    ) {
      throw new Error('系统角色或权限目录未完整写入，已中止 seed。');
    }

    for (const role of SYSTEM_ROLE_DEFINITIONS) {
      const roleId = roleIdByCode.get(role.code);
      if (roleId === undefined) {
        throw new Error(`缺少系统角色：${role.code}`);
      }

      await tx.rolePermission.deleteMany({ where: { roleId } });
      const permissionCodes = SYSTEM_ROLE_PERMISSIONS[role.code];
      if (permissionCodes.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionCodes.map((permissionCode) => {
            const permissionId = permissionIdByCode.get(permissionCode);
            if (permissionId === undefined) {
              throw new Error(`缺少目录权限：${permissionCode}`);
            }

            return {
              roleId,
              permissionId,
              dataScope: SYSTEM_ROLE_DATA_SCOPE[role.code],
            };
          }),
        });
      }

      await tx.aiEntitlement.upsert({
        where: { roleId },
        create: { roleId, verificationGrantAmount: 10000n },
        update: { verificationGrantAmount: 10000n },
      });
    }

    for (const menu of SYSTEM_MENUS) {
      await tx.menu.upsert({
        where: { routeKey: menu.routeKey },
        create: {
          routeKey: menu.routeKey,
          scope: menu.scope,
          type: menu.type,
          name: menu.name,
          sortOrder: menu.sortOrder,
          isSystem: true,
        },
        update: {
          scope: menu.scope,
          type: menu.type,
          name: menu.name,
          sortOrder: menu.sortOrder,
          visible: true,
          enabled: true,
          isSystem: true,
          deletedAt: null,
        },
      });
    }

    const seededMenus = await tx.menu.findMany({
      where: { routeKey: { in: SYSTEM_MENUS.map(({ routeKey }) => routeKey) } },
      select: { id: true, routeKey: true },
    });
    const menuIdByRouteKey = new Map(
      seededMenus
        .filter((menu): menu is { id: string; routeKey: string } => menu.routeKey !== null)
        .map((menu) => [menu.routeKey, menu.id]),
    );

    for (const menu of SYSTEM_MENUS) {
      const menuId = menuIdByRouteKey.get(menu.routeKey);
      const parentId =
        menu.parentRouteKey === undefined ? null : menuIdByRouteKey.get(menu.parentRouteKey);
      if (menuId === undefined || (menu.parentRouteKey !== undefined && parentId === undefined)) {
        throw new Error(`系统菜单关系不完整：${menu.routeKey}`);
      }

      await tx.menu.update({
        where: { id: menuId },
        data: { parentId },
      });
    }

    await tx.menuPermission.deleteMany({
      where: { menuId: { in: [...menuIdByRouteKey.values()] } },
    });
    const menuPermissionRows = SYSTEM_MENUS.flatMap((menu) => {
      const menuId = menuIdByRouteKey.get(menu.routeKey);
      if (menuId === undefined) {
        throw new Error(`缺少系统菜单：${menu.routeKey}`);
      }

      return menu.permissionCodes.map((permissionCode) => {
        const permissionId = permissionIdByCode.get(permissionCode);
        if (permissionId === undefined) {
          throw new Error(`缺少菜单权限：${permissionCode}`);
        }

        return { menuId, permissionId };
      });
    });
    if (menuPermissionRows.length > 0) {
      await tx.menuPermission.createMany({ data: menuPermissionRows });
    }
  });
}

async function main(): Promise<void> {
  await runBaselineSeed(prisma);
  console.info('M1 Auth/RBAC/菜单基线 seed 已完成。');
}

if (require.main === module) {
  main()
    .catch((error: unknown) => {
      console.error('M1 基线 seed 失败。', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
