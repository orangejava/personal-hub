import { Injectable } from '@nestjs/common';
import { MenuScope, MenuType, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { SystemConfigGroup } from './config-registry';

type DbClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class SystemRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllConfigs(db: DbClient = this.prisma) {
    return db.systemConfig.findMany();
  }

  async findConfigByGroup(group: SystemConfigGroup, db: DbClient = this.prisma) {
    return db.systemConfig.findUnique({ where: { key: group } });
  }

  async upsertConfig(
    input: {
      group: SystemConfigGroup;
      value: Prisma.InputJsonValue;
      version: number;
      updatedBy: string | null;
    },
    db: DbClient = this.prisma,
  ) {
    return db.systemConfig.upsert({
      where: { key: input.group },
      create: {
        key: input.group,
        group: input.group,
        value: input.value,
        isPublic: true,
        version: 1,
        updatedBy: input.updatedBy,
      },
      update: {
        value: input.value,
        version: input.version,
        updatedBy: input.updatedBy,
      },
    });
  }

  async findPublicNavigationMenus(db: DbClient = this.prisma) {
    return db.menu.findMany({
      where: {
        deletedAt: null,
        visible: true,
        enabled: true,
        scope: { in: [MenuScope.PUBLIC, MenuScope.AI] },
      },
      select: {
        id: true,
        scope: true,
        type: true,
        name: true,
        localeKey: true,
        icon: true,
        parentId: true,
        routeKey: true,
        externalUrl: true,
        openInNewTab: true,
        sortOrder: true,
        permissions: {
          select: { permission: { select: { code: true } } },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findAdminMenus(db: DbClient = this.prisma) {
    return db.menu.findMany({
      where: { deletedAt: null },
      include: {
        permissions: { select: { permission: { select: { id: true, code: true } } } },
      },
      orderBy: [{ scope: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findMenuById(id: string, db: DbClient = this.prisma) {
    return db.menu.findFirst({
      where: { id, deletedAt: null },
      include: {
        permissions: { select: { permission: { select: { id: true, code: true } } } },
        children: { where: { deletedAt: null }, select: { id: true } },
      },
    });
  }

  async findMenuParentMap(db: DbClient = this.prisma) {
    const rows = await db.menu.findMany({
      where: { deletedAt: null },
      select: { id: true, parentId: true, scope: true, type: true, routeKey: true },
    });
    return rows;
  }

  async createMenu(
    data: Prisma.MenuUncheckedCreateInput,
    db: DbClient = this.prisma,
  ) {
    return db.menu.create({ data });
  }

  async updateMenu(
    id: string,
    data: Prisma.MenuUncheckedUpdateInput,
    db: DbClient = this.prisma,
  ) {
    return db.menu.update({ where: { id }, data });
  }

  async replaceMenuPermissions(
    menuId: string,
    permissionIds: string[],
    db: DbClient = this.prisma,
  ) {
    await db.menuPermission.deleteMany({ where: { menuId } });
    if (permissionIds.length > 0) {
      await db.menuPermission.createMany({
        data: permissionIds.map((permissionId) => ({ menuId, permissionId })),
      });
    }
  }

  async findPermissionIdsByCodes(codes: string[], db: DbClient = this.prisma) {
    if (codes.length === 0) {
      return [];
    }
    return db.permission.findMany({
      where: { code: { in: codes } },
      select: { id: true, code: true },
    });
  }

  async createAuditLog(
    input: {
      action: string;
      actorId: string | null;
      targetId: string | null;
      requestId: string | null;
      result: 'SUCCEEDED' | 'FAILED';
      detail?: Prisma.InputJsonValue;
    },
    db: DbClient = this.prisma,
  ) {
    await db.auditLog.create({
      data: {
        category: 'SYSTEM',
        action: input.action,
        actorId: input.actorId,
        targetType: 'SYSTEM',
        targetId: input.targetId,
        requestId: input.requestId,
        result: input.result,
        detail: input.detail,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
  }

  asTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}

export type { MenuType };
