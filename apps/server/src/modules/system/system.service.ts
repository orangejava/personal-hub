import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { MenuScope, MenuType, Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { DomainHttpException } from '../../common/errors/domain-http.exception';
import { FileService } from '../file/file.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import {
  buildFilteredMenuTree,
  type MenuSnapshotRecord,
  type MenuTreeNode,
} from '../auth/permission-snapshot';
import {
  assemblePublicSiteConfig,
  DEFAULT_SYSTEM_CONFIGS,
  isPublicSystemConfigGroup,
  isSystemConfigGroup,
  parseGroupValue,
  SYSTEM_CONFIG_GROUPS,
  type PublicSiteConfig,
  type SystemConfigGroup,
} from './config-registry';
import {
  assertExternalUrl,
  assertInternalRouteKey,
  assertNotCoreLocked,
  sameScope,
  wouldCreateCycle,
} from './menu-rules';
import { MENU_ROUTE_OPTIONS } from './route-registry';
import { SystemRepository } from './system.repository';

const PUBLIC_CONFIG_CACHE_KEY = 'cache:system:public-config';
const PUBLIC_NAV_CACHE_KEY = 'cache:navigation:public';
const MENU_EPOCH_KEY = 'system:menu-epoch';
const CACHE_TTL_SECONDS = 300;

export interface AdminConfigGroupView {
  group: SystemConfigGroup;
  version: number;
  isPublic: boolean;
  value: unknown;
  updatedAt: string;
}

export interface MenuWriteInput {
  scope?: MenuScope;
  type?: MenuType;
  name?: string;
  localeKey?: string | null;
  icon?: string | null;
  parentId?: string | null;
  routeKey?: string | null;
  externalUrl?: string | null;
  openInNewTab?: boolean;
  sortOrder?: number;
  visible?: boolean;
  enabled?: boolean;
  remark?: string | null;
  permissionCodes?: string[];
  version?: number;
}

export interface AdminMenuNode extends MenuTreeNode {
  visible: boolean;
  enabled: boolean;
  isSystem: boolean;
  remark: string | null;
  localeKey: string | null;
  icon: string | null;
  openInNewTab: boolean;
  version: number;
  parentId: string | null;
  permissionCodes: string[];
}

/**
 * 系统配置与菜单写入。version 冲突返回 409，避免后保存覆盖先保存。
 * 写成功后清公开配置/导航缓存，前台下次请求才能读到新值。
 */
@Injectable()
export class SystemService {
  private readonly logger = new Logger(SystemService.name);

  constructor(
    private readonly repository: SystemRepository,
    private readonly redis: RedisService,
    private readonly files: FileService,
  ) {}

  async getPublicSiteConfig(): Promise<PublicSiteConfig> {
    const cached = await this.redis.getJson<PublicSiteConfig>(PUBLIC_CONFIG_CACHE_KEY);
    if (cached) {
      return cached;
    }
    const assembled = await this.loadPublicSiteConfig();
    await this.redis.setJson(PUBLIC_CONFIG_CACHE_KEY, assembled, CACHE_TTL_SECONDS);
    return assembled;
  }

  async getPublicNavigation(): Promise<MenuTreeNode[]> {
    const cached = await this.redis.getJson<MenuTreeNode[]>(PUBLIC_NAV_CACHE_KEY);
    if (cached) {
      return cached;
    }
    const tree = await this.loadPublicNavigation();
    await this.redis.setJson(PUBLIC_NAV_CACHE_KEY, tree, CACHE_TTL_SECONDS);
    return tree;
  }

  async listAdminConfigs(group?: string): Promise<AdminConfigGroupView[]> {
    if (group !== undefined && !isSystemConfigGroup(group)) {
      throw new DomainHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'SYSTEM_CONFIG_NOT_FOUND',
        '未知的配置组',
      );
    }
    const rows = await this.repository.findAllConfigs();
    const byGroup = new Map(rows.map((row) => [row.group, row]));
    const groups = group ? [group as SystemConfigGroup] : [...SYSTEM_CONFIG_GROUPS];
    return groups.map((item) => {
      const row = byGroup.get(item);
      const value = parseGroupValue(item, row?.value ?? DEFAULT_SYSTEM_CONFIGS[item]);
      return {
        group: item,
        version: row?.version ?? 1,
        isPublic: row?.isPublic ?? isPublicSystemConfigGroup(item),
        value,
        updatedAt: (row?.updatedAt ?? new Date()).toISOString(),
      };
    });
  }

  async updateConfigGroup(input: {
    group: string;
    value: unknown;
    expectedVersion: number;
    actorId: string;
    requestId: string | null;
  }): Promise<AdminConfigGroupView> {
    if (!isSystemConfigGroup(input.group)) {
      throw new DomainHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'SYSTEM_CONFIG_NOT_FOUND',
        '未知的配置组',
      );
    }
    const group = input.group;

    let parsed: unknown;
    try {
      parsed = parseGroupValue(group, input.value);
    } catch (error) {
      const details = error instanceof ZodError ? error.issues : [];
      throw new DomainHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'SYSTEM_CONFIG_INVALID',
        '配置值未通过校验',
        details,
      );
    }

    const updated = await this.repository.asTransaction(async (tx) => {
      const current = await this.repository.findConfigByGroup(group, tx);
      const currentVersion = current?.version ?? 0;
      // 客户端必须带上读取时的 version；过期则拒绝，而不是静默覆盖。
      if (current !== null && currentVersion !== input.expectedVersion) {
        throw new DomainHttpException(
          HttpStatus.CONFLICT,
          'SYSTEM_CONFIG_VERSION_CONFLICT',
          '配置已被他人更新，请刷新后重试',
        );
      }
      const nextVersion = currentVersion + 1;
      const row = await this.repository.upsertConfig(
        {
          group,
          value: parsed as Prisma.InputJsonValue,
          version: nextVersion,
          updatedBy: input.actorId,
        },
        tx,
      );
      // audit_logs.target_id 是 UUID；配置组是 site.general 这类字符串，只能放 detail
      await this.repository.createAuditLog(
        {
          action: 'system-config.update',
          actorId: input.actorId,
          targetId: null,
          requestId: input.requestId,
          result: 'SUCCEEDED',
          detail: { group, version: nextVersion },
        },
        tx,
      );
      return row;
    });

    await this.invalidatePublicConfigCache();
    return {
      group,
      version: updated.version,
      isPublic: updated.isPublic,
      value: parseGroupValue(group, updated.value),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  listRouteOptions() {
    return MENU_ROUTE_OPTIONS;
  }

  async listAdminMenus(): Promise<AdminMenuNode[]> {
    const rows = await this.repository.findAdminMenus();
    return this.buildAdminTree(rows);
  }

  async createMenu(input: MenuWriteInput & { actorId: string; requestId: string | null }) {
    const scope = input.scope;
    const type = input.type;
    const name = input.name;
    if (!scope || !type || !name) {
      throw new DomainHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'MENU_INVALID',
        '新增菜单必须提供 scope、type、name',
      );
    }
    assertInternalRouteKey(type, input.routeKey ?? null);
    assertExternalUrl(type, input.externalUrl ?? null);
    await this.assertParent(input.parentId ?? null, scope);

    const permissionIds = await this.resolvePermissionIds(input.permissionCodes ?? []);
    const created = await this.repository.asTransaction(async (tx) => {
      const menu = await this.repository.createMenu(
        {
          scope,
          type,
          name,
          localeKey: input.localeKey ?? null,
          icon: input.icon ?? null,
          parentId: input.parentId ?? null,
          routeKey: type === MenuType.INTERNAL ? (input.routeKey ?? null) : null,
          externalUrl: type === MenuType.EXTERNAL ? (input.externalUrl ?? null) : null,
          openInNewTab: input.openInNewTab ?? type === MenuType.EXTERNAL,
          sortOrder: input.sortOrder ?? 0,
          visible: input.visible ?? true,
          enabled: input.enabled ?? true,
          isSystem: false,
          remark: input.remark ?? null,
        },
        tx,
      );
      await this.repository.replaceMenuPermissions(menu.id, permissionIds, tx);
      await this.repository.createAuditLog(
        {
          action: 'menu.create',
          actorId: input.actorId,
          targetId: menu.id,
          requestId: input.requestId,
          result: 'SUCCEEDED',
          detail: { routeKey: menu.routeKey, scope: menu.scope },
        },
        tx,
      );
      return menu;
    });
    await this.invalidateMenuCaches();
    const loaded = await this.repository.findMenuById(created.id);
    return loaded;
  }

  async updateMenu(
    menuId: string,
    input: MenuWriteInput & { actorId: string; requestId: string | null },
  ) {
    const current = await this.repository.findMenuById(menuId);
    if (!current) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'MENU_NOT_FOUND', '菜单不存在');
    }
    if (input.version !== undefined && input.version !== current.version) {
      throw new DomainHttpException(
        HttpStatus.CONFLICT,
        'MENU_VERSION_CONFLICT',
        '菜单已被他人更新，请刷新后重试',
      );
    }

    const nextType = input.type ?? current.type;
    const nextScope = input.scope ?? current.scope;
    const nextRouteKey = input.routeKey === undefined ? current.routeKey : input.routeKey;
    const nextExternal = input.externalUrl === undefined ? current.externalUrl : input.externalUrl;
    const nextParentId = input.parentId === undefined ? current.parentId : input.parentId;
    const nextEnabled = input.enabled ?? current.enabled;
    const nextVisible = input.visible ?? current.visible;

    if (nextEnabled === false || nextVisible === false) {
      assertNotCoreLocked(current.routeKey, '禁用');
    }
    assertInternalRouteKey(nextType, nextRouteKey);
    assertExternalUrl(nextType, nextExternal);

    if (nextParentId) {
      await this.assertParent(nextParentId, nextScope);
      const all = await this.repository.findMenuParentMap();
      const parentById = new Map(all.map((row) => [row.id, row.parentId]));
      if (wouldCreateCycle(menuId, nextParentId, parentById)) {
        throw new DomainHttpException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'MENU_CYCLE_DETECTED',
          '不能将菜单挂到自己的子孙节点下',
        );
      }
    }

    const permissionIds =
      input.permissionCodes === undefined
        ? undefined
        : await this.resolvePermissionIds(input.permissionCodes);

    await this.repository.asTransaction(async (tx) => {
      await this.repository.updateMenu(
        menuId,
        {
          scope: nextScope,
          type: nextType,
          name: input.name ?? current.name,
          localeKey: input.localeKey === undefined ? current.localeKey : input.localeKey,
          icon: input.icon === undefined ? current.icon : input.icon,
          parentId: nextParentId,
          routeKey: nextType === MenuType.INTERNAL ? nextRouteKey : null,
          externalUrl: nextType === MenuType.EXTERNAL ? nextExternal : null,
          openInNewTab:
            input.openInNewTab === undefined ? current.openInNewTab : input.openInNewTab,
          sortOrder: input.sortOrder ?? current.sortOrder,
          visible: nextVisible,
          enabled: nextEnabled,
          remark: input.remark === undefined ? current.remark : input.remark,
          version: current.version + 1,
        },
        tx,
      );
      if (permissionIds !== undefined) {
        await this.repository.replaceMenuPermissions(menuId, permissionIds, tx);
      }
      await this.repository.createAuditLog(
        {
          action: 'menu.update',
          actorId: input.actorId,
          targetId: menuId,
          requestId: input.requestId,
          result: 'SUCCEEDED',
          detail: { routeKey: nextRouteKey },
        },
        tx,
      );
    });
    await this.invalidateMenuCaches();
    return this.repository.findMenuById(menuId);
  }

  async deleteMenu(menuId: string, actorId: string, requestId: string | null) {
    const current = await this.repository.findMenuById(menuId);
    if (!current) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'MENU_NOT_FOUND', '菜单不存在');
    }
    assertNotCoreLocked(current.routeKey, '删除');
    if (current.children.length > 0) {
      throw new DomainHttpException(
        HttpStatus.CONFLICT,
        'MENU_HAS_CHILDREN',
        '请先删除或迁移子菜单',
      );
    }
    await this.repository.asTransaction(async (tx) => {
      await this.repository.updateMenu(
        menuId,
        { deletedAt: new Date(), version: current.version + 1 },
        tx,
      );
      await this.repository.createAuditLog(
        {
          action: 'menu.delete',
          actorId,
          targetId: menuId,
          requestId,
          result: 'SUCCEEDED',
          detail: { routeKey: current.routeKey },
        },
        tx,
      );
    });
    await this.invalidateMenuCaches();
    return { deleted: true };
  }

  async sortMenus(
    items: Array<{ id: string; sortOrder: number }>,
    actorId: string,
    requestId: string | null,
  ) {
    const all = await this.repository.findMenuParentMap();
    const byId = new Map(all.map((row) => [row.id, row]));
    let parentId: string | null | undefined;
    let scope: MenuScope | undefined;
    for (const item of items) {
      const row = byId.get(item.id);
      if (!row) {
        throw new DomainHttpException(HttpStatus.NOT_FOUND, 'MENU_NOT_FOUND', '菜单不存在');
      }
      if (parentId === undefined) {
        parentId = row.parentId;
        scope = row.scope;
      } else if (row.parentId !== parentId || row.scope !== scope) {
        throw new DomainHttpException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'MENU_INVALID',
          '排序必须在同一 scope 且同一父节点下',
        );
      }
    }
    await this.repository.asTransaction(async (tx) => {
      for (const item of items) {
        await this.repository.updateMenu(item.id, { sortOrder: item.sortOrder }, tx);
      }
      await this.repository.createAuditLog(
        {
          action: 'menu.sort',
          actorId,
          targetId: parentId ?? null,
          requestId,
          result: 'SUCCEEDED',
          detail: { count: items.length },
        },
        tx,
      );
    });
    await this.invalidateMenuCaches();
    return this.listAdminMenus();
  }

  async getMenuEpoch(): Promise<number> {
    const raw = await this.redis.get(MENU_EPOCH_KEY);
    const parsed = raw === null ? 0 : Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private async loadPublicSiteConfig(): Promise<PublicSiteConfig> {
    const rows = await this.repository.findAllConfigs();
    const map = new Map<SystemConfigGroup, unknown>();
    for (const row of rows) {
      if (isSystemConfigGroup(row.group)) {
        map.set(row.group, row.value);
      }
    }
    const assembled = assemblePublicSiteConfig(map);
    return {
      ...assembled,
      logoUrl: await this.files.signFileId(assembled.logoFileId),
    };
  }

  private async loadPublicNavigation(): Promise<MenuTreeNode[]> {
    const rows = await this.repository.findPublicNavigationMenus();
    const records: MenuSnapshotRecord[] = rows.map((menu) => ({
      id: menu.id,
      scope: menu.scope,
      type: menu.type,
      name: menu.name,
      localeKey: menu.localeKey,
      icon: menu.icon,
      openInNewTab: menu.openInNewTab,
      parentId: menu.parentId,
      routeKey: menu.routeKey,
      externalUrl: menu.externalUrl,
      sortOrder: menu.sortOrder,
      permissionCodes: menu.permissions.map((item) => item.permission.code),
    }));
    // 匿名可见：无关联权限；有权限码的菜单对访客隐藏。
    return buildFilteredMenuTree(records, new Set());
  }

  private buildAdminTree(
    rows: Awaited<ReturnType<SystemRepository['findAdminMenus']>>,
  ): AdminMenuNode[] {
    const byId = new Map<string, AdminMenuNode>();
    for (const menu of rows) {
      byId.set(menu.id, {
        id: menu.id,
        scope: menu.scope,
        type: menu.type,
        name: menu.name,
        localeKey: menu.localeKey,
        icon: menu.icon,
        openInNewTab: menu.openInNewTab,
        routeKey: menu.routeKey,
        externalUrl: menu.externalUrl,
        sortOrder: menu.sortOrder,
        visible: menu.visible,
        enabled: menu.enabled,
        isSystem: menu.isSystem,
        remark: menu.remark,
        version: menu.version,
        parentId: menu.parentId,
        permissionCodes: menu.permissions.map((item) => item.permission.code),
        children: [],
      });
    }
    const roots: AdminMenuNode[] = [];
    for (const menu of rows) {
      const node = byId.get(menu.id);
      if (!node) {
        continue;
      }
      if (menu.parentId && byId.has(menu.parentId)) {
        (byId.get(menu.parentId) as AdminMenuNode).children.push(node);
      } else {
        roots.push(node);
      }
    }
    const sortTree = (nodes: AdminMenuNode[]): AdminMenuNode[] => {
      nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
      for (const node of nodes) {
        node.children = sortTree(node.children as AdminMenuNode[]);
      }
      return nodes;
    };
    return sortTree(roots);
  }

  private async assertParent(parentId: string | null, scope: MenuScope): Promise<void> {
    if (!parentId) {
      return;
    }
    const parent = await this.repository.findMenuById(parentId);
    if (!parent) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'MENU_NOT_FOUND', '父菜单不存在');
    }
    if (parent.type !== MenuType.DIRECTORY) {
      throw new DomainHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'MENU_INVALID',
        '父菜单必须是目录',
      );
    }
    if (!sameScope(parent.scope, scope)) {
      throw new DomainHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'MENU_INVALID',
        '父子菜单必须属于同一区域',
      );
    }
  }

  private async resolvePermissionIds(codes: string[]): Promise<string[]> {
    if (codes.length === 0) {
      return [];
    }
    const rows = await this.repository.findPermissionIdsByCodes(codes);
    if (rows.length !== codes.length) {
      throw new DomainHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'MENU_INVALID',
        '包含未知权限码',
      );
    }
    return rows.map((row) => row.id);
  }

  private async invalidatePublicConfigCache(): Promise<void> {
    await this.redis.del(PUBLIC_CONFIG_CACHE_KEY);
  }

  private async invalidateMenuCaches(): Promise<void> {
    await this.redis.del(PUBLIC_NAV_CACHE_KEY);
    try {
      await this.redis.getClient().incr(MENU_EPOCH_KEY);
    } catch (error) {
      this.logger.warn({ err: error }, '提升菜单世代失败，依赖权限快照 TTL 过期');
    }
  }
}
