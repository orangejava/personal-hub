import { MenuScope, MenuType, PrismaClient } from '@prisma/client';
import {
  PERMISSION_CATALOG,
  SYSTEM_ROLE_DATA_SCOPE,
  SYSTEM_ROLE_DEFINITIONS,
  SYSTEM_ROLE_PERMISSIONS,
  type PermissionCode,
} from '../src/modules/auth/rbac-catalog';
import {
  DEFAULT_SYSTEM_CONFIGS,
  isPublicSystemConfigGroup,
  SYSTEM_CONFIG_GROUPS,
} from '../src/modules/system/config-registry';
import { MENU_ROUTE_META } from '../src/modules/system/route-registry';
import { seedAiCatalog } from './seed-ai';
import { seedContentTaxonomy, seedSampleContents } from './seed-content';

const prisma = new PrismaClient();

interface SystemMenuDefinition {
  routeKey: string;
  scope: MenuScope;
  type: MenuType;
  name: string;
  parentRouteKey?: string;
  sortOrder: number;
  /** 默认可见；配置中心子页可隐式挂在系统管理下，避免侧栏多出入口。 */
  visible?: boolean;
  permissionCodes: readonly PermissionCode[];
}

/**
 * 系统导航。菜单只控制展示，接口仍必须由 Guard 校验。
 *
 * ADMIN 区域里与 EDITOR 内容权限重叠的项，改用 EDITOR 没有的动作码
 * （例如 content:featured），避免编辑者因为 content:read 看到后台内容管理。
 */
export const SYSTEM_MENUS: readonly SystemMenuDefinition[] = [
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
    routeKey: 'public.ai',
    scope: MenuScope.PUBLIC,
    type: MenuType.INTERNAL,
    name: 'AI 工具',
    sortOrder: 30,
    permissionCodes: [],
  },
  {
    routeKey: 'public.projects',
    scope: MenuScope.PUBLIC,
    type: MenuType.INTERNAL,
    name: '项目',
    sortOrder: 40,
    permissionCodes: [],
  },
  {
    routeKey: 'public.about',
    scope: MenuScope.PUBLIC,
    type: MenuType.INTERNAL,
    name: '关于我',
    sortOrder: 50,
    permissionCodes: [],
  },
  {
    routeKey: 'workspace.dashboard',
    scope: MenuScope.WORKSPACE,
    type: MenuType.INTERNAL,
    name: '工作台',
    sortOrder: 10,
    permissionCodes: [],
  },
  {
    routeKey: 'workspace.content.group',
    scope: MenuScope.WORKSPACE,
    type: MenuType.DIRECTORY,
    name: '内容中心',
    sortOrder: 20,
    permissionCodes: [],
  },
  {
    routeKey: 'workspace.contents',
    scope: MenuScope.WORKSPACE,
    type: MenuType.INTERNAL,
    name: '文档管理',
    parentRouteKey: 'workspace.content.group',
    sortOrder: 10,
    permissionCodes: ['content:read'],
  },
  {
    routeKey: 'workspace.content.new',
    scope: MenuScope.WORKSPACE,
    type: MenuType.INTERNAL,
    name: '新建内容',
    parentRouteKey: 'workspace.content.group',
    sortOrder: 20,
    permissionCodes: ['content:create'],
  },
  {
    routeKey: 'workspace.markdown.new',
    scope: MenuScope.WORKSPACE,
    type: MenuType.INTERNAL,
    name: '新建 Markdown',
    parentRouteKey: 'workspace.content.group',
    sortOrder: 30,
    permissionCodes: ['content:create'],
  },
  {
    routeKey: 'workspace.richtext.new',
    scope: MenuScope.WORKSPACE,
    type: MenuType.INTERNAL,
    name: '新建富文本',
    parentRouteKey: 'workspace.content.group',
    sortOrder: 40,
    permissionCodes: ['content:create'],
  },
  {
    routeKey: 'workspace.booklets',
    scope: MenuScope.WORKSPACE,
    type: MenuType.INTERNAL,
    name: '小册管理',
    parentRouteKey: 'workspace.content.group',
    sortOrder: 50,
    permissionCodes: ['booklet:import'],
  },
  {
    routeKey: 'workspace.uploads',
    scope: MenuScope.WORKSPACE,
    type: MenuType.INTERNAL,
    name: '上传任务',
    parentRouteKey: 'workspace.content.group',
    sortOrder: 55,
    permissionCodes: ['content:read'],
  },
  {
    routeKey: 'workspace.favorites',
    scope: MenuScope.WORKSPACE,
    type: MenuType.INTERNAL,
    name: '我的收藏',
    parentRouteKey: 'workspace.content.group',
    sortOrder: 60,
    permissionCodes: [],
  },
  {
    routeKey: 'workspace.aiHistory',
    scope: MenuScope.WORKSPACE,
    type: MenuType.INTERNAL,
    name: 'AI 历史',
    sortOrder: 30,
    permissionCodes: ['ai:use'],
  },
  {
    routeKey: 'workspace.usage',
    scope: MenuScope.WORKSPACE,
    type: MenuType.INTERNAL,
    name: '我的用量',
    sortOrder: 40,
    permissionCodes: [],
  },
  {
    routeKey: 'workspace.profile',
    scope: MenuScope.WORKSPACE,
    type: MenuType.INTERNAL,
    name: '个人中心',
    sortOrder: 50,
    permissionCodes: [],
  },
  {
    routeKey: 'workspace.sessions',
    scope: MenuScope.WORKSPACE,
    type: MenuType.INTERNAL,
    name: '登录设备',
    sortOrder: 60,
    permissionCodes: [],
  },
  {
    routeKey: 'admin.dashboard',
    scope: MenuScope.ADMIN,
    type: MenuType.INTERNAL,
    name: '运营概览',
    sortOrder: 10,
    permissionCodes: ['dashboard:read'],
  },
  {
    routeKey: 'admin.content.group',
    scope: MenuScope.ADMIN,
    type: MenuType.DIRECTORY,
    name: '内容管理',
    sortOrder: 20,
    permissionCodes: [],
  },
  {
    routeKey: 'admin.content.list',
    scope: MenuScope.ADMIN,
    type: MenuType.INTERNAL,
    name: '文档列表',
    parentRouteKey: 'admin.content.group',
    sortOrder: 10,
    permissionCodes: ['content:featured'],
  },
  {
    routeKey: 'admin.content.reviews',
    scope: MenuScope.ADMIN,
    type: MenuType.INTERNAL,
    name: '内容审核',
    parentRouteKey: 'admin.content.group',
    sortOrder: 15,
    permissionCodes: ['content:featured'],
  },
  {
    routeKey: 'admin.content.booklets',
    scope: MenuScope.ADMIN,
    type: MenuType.INTERNAL,
    name: '小册管理',
    parentRouteKey: 'admin.content.group',
    sortOrder: 20,
    permissionCodes: ['content:featured'],
  },
  {
    routeKey: 'admin.content.categories',
    scope: MenuScope.ADMIN,
    type: MenuType.INTERNAL,
    name: '分类管理',
    parentRouteKey: 'admin.content.group',
    sortOrder: 30,
    permissionCodes: ['category:manage'],
  },
  {
    routeKey: 'admin.content.tags',
    scope: MenuScope.ADMIN,
    type: MenuType.INTERNAL,
    name: '标签管理',
    parentRouteKey: 'admin.content.group',
    sortOrder: 40,
    permissionCodes: ['tag:manage'],
  },
  {
    routeKey: 'admin.files',
    scope: MenuScope.ADMIN,
    type: MenuType.INTERNAL,
    name: '文件管理',
    parentRouteKey: 'admin.content.group',
    sortOrder: 50,
    permissionCodes: ['file:read'],
  },
  {
    routeKey: 'admin.ai.group',
    scope: MenuScope.ADMIN,
    type: MenuType.DIRECTORY,
    name: 'AI 管理',
    sortOrder: 30,
    permissionCodes: [],
  },
  {
    routeKey: 'admin.ai.config',
    scope: MenuScope.ADMIN,
    type: MenuType.INTERNAL,
    name: 'AI 配置',
    parentRouteKey: 'admin.ai.group',
    sortOrder: 10,
    permissionCodes: [
      'ai:provider:manage',
      'ai:model:manage',
      'ai:tool:manage',
      'ai:template:manage',
      'ai:entitlement:manage',
    ],
  },
  {
    routeKey: 'admin.ai.stats',
    scope: MenuScope.ADMIN,
    type: MenuType.INTERNAL,
    name: 'AI 统计',
    parentRouteKey: 'admin.ai.group',
    sortOrder: 20,
    permissionCodes: ['dashboard:read'],
  },
  {
    routeKey: 'admin.system.group',
    scope: MenuScope.ADMIN,
    type: MenuType.DIRECTORY,
    name: '系统管理',
    sortOrder: 40,
    permissionCodes: [],
  },
  {
    routeKey: 'admin.users',
    scope: MenuScope.ADMIN,
    type: MenuType.INTERNAL,
    name: '用户管理',
    parentRouteKey: 'admin.system.group',
    sortOrder: 10,
    permissionCodes: ['user:read'],
  },
  {
    routeKey: 'admin.roles',
    scope: MenuScope.ADMIN,
    type: MenuType.INTERNAL,
    name: '角色与权限',
    parentRouteKey: 'admin.system.group',
    sortOrder: 20,
    permissionCodes: ['role:read'],
  },
  {
    routeKey: 'admin.menus',
    scope: MenuScope.ADMIN,
    type: MenuType.INTERNAL,
    name: '菜单管理',
    parentRouteKey: 'admin.system.group',
    sortOrder: 30,
    permissionCodes: ['menu:manage'],
  },
  {
    routeKey: 'admin.system.config',
    scope: MenuScope.ADMIN,
    type: MenuType.INTERNAL,
    name: '系统配置',
    parentRouteKey: 'admin.system.group',
    sortOrder: 40,
    permissionCodes: ['system:config:manage'],
  },
  {
    routeKey: 'admin.homepage',
    scope: MenuScope.ADMIN,
    type: MenuType.INTERNAL,
    name: '首页配置',
    parentRouteKey: 'admin.system.group',
    sortOrder: 45,
    visible: false,
    permissionCodes: ['system:config:manage'],
  },
  {
    routeKey: 'admin.system.theme',
    scope: MenuScope.ADMIN,
    type: MenuType.INTERNAL,
    name: '主题配置',
    parentRouteKey: 'admin.system.group',
    sortOrder: 50,
    permissionCodes: ['system:config:manage'],
  },
  {
    routeKey: 'admin.logs',
    scope: MenuScope.ADMIN,
    type: MenuType.INTERNAL,
    name: '操作日志',
    parentRouteKey: 'admin.system.group',
    sortOrder: 60,
    permissionCodes: ['audit:read'],
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
      const meta = MENU_ROUTE_META[menu.routeKey];
      const visible = menu.visible ?? true;
      await tx.menu.upsert({
        where: { routeKey: menu.routeKey },
        create: {
          routeKey: menu.routeKey,
          scope: menu.scope,
          type: menu.type,
          name: menu.name,
          localeKey: meta?.localeKey ?? menu.routeKey,
          icon: meta?.icon ?? null,
          sortOrder: menu.sortOrder,
          visible,
          isSystem: true,
        },
        update: {
          scope: menu.scope,
          type: menu.type,
          name: menu.name,
          localeKey: meta?.localeKey ?? menu.routeKey,
          icon: meta?.icon ?? null,
          sortOrder: menu.sortOrder,
          visible,
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

    for (const group of SYSTEM_CONFIG_GROUPS) {
      await tx.systemConfig.upsert({
        where: { key: group },
        create: {
          key: group,
          group,
          value: DEFAULT_SYSTEM_CONFIGS[group] as object,
          isPublic: isPublicSystemConfigGroup(group),
          version: 1,
        },
        update: {},
      });
    }
  });
  await seedContentTaxonomy(client);
  await seedAiCatalog(client);
}

async function main(): Promise<void> {
  await runBaselineSeed(prisma);
  await seedSampleContents(prisma);
  console.info('M1/M3 基线、内容分类/样例与 AI 目录 seed 已完成。');
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
