import { Injectable } from '@nestjs/common';
import {
  type Prisma,
  RoleCode,
  UserStatus,
  AiQuotaTransactionType,
  type AuthSession,
  type RefreshToken,
  type Role,
  type User,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

type DbClient = Prisma.TransactionClient | PrismaService;

export type UserWithRole = User & { role: { code: RoleCode } };

/**
 * Auth 持久化。邮件/重置 Token 只存哈希；Refresh 轮换先插新再作废旧的，防止重放。
 * 多数方法接受可选事务客户端，必须与 Service 层 asTransaction 共用同一 db。
 */
@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string, db: DbClient = this.prisma): Promise<UserWithRole | null> {
    return db.user.findUnique({
      where: { email },
      include: { role: { select: { code: true } } },
    });
  }

  async findUserById(userId: string, db: DbClient = this.prisma): Promise<UserWithRole | null> {
    return db.user.findUnique({
      where: { id: userId },
      include: { role: { select: { code: true } } },
    });
  }

  async findRoleByCode(code: RoleCode, db: DbClient = this.prisma): Promise<Role | null> {
    return db.role.findUnique({ where: { code } });
  }

  async createPendingMember(
    input: {
      email: string;
      passwordHash: string;
      nickname: string | null;
      roleId: string;
    },
    db: DbClient = this.prisma,
  ): Promise<UserWithRole> {
    return db.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        nickname: input.nickname,
        roleId: input.roleId,
        status: UserStatus.PENDING_VERIFICATION,
      },
      include: { role: { select: { code: true } } },
    });
  }

  async createVerificationToken(
    input: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
    },
    db: DbClient = this.prisma,
  ): Promise<void> {
    await db.emailVerificationToken.create({ data: input });
  }

  async invalidateOpenVerificationTokens(
    userId: string,
    db: DbClient = this.prisma,
  ): Promise<void> {
    await db.emailVerificationToken.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  }

  async findVerificationTokenByHash(tokenHash: string, db: DbClient = this.prisma) {
    return db.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { role: { select: { code: true } } } } },
    });
  }

  async createPasswordResetToken(
    input: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
    },
    db: DbClient = this.prisma,
  ): Promise<void> {
    await db.passwordResetToken.create({ data: input });
  }

  async invalidateOpenPasswordResetTokens(
    userId: string,
    db: DbClient = this.prisma,
  ): Promise<void> {
    await db.passwordResetToken.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  }

  async findPasswordResetTokenByHash(tokenHash: string, db: DbClient = this.prisma) {
    return db.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { role: { select: { code: true } } } } },
    });
  }

  /**
   * 条件消费重置 Token。count === 0 表示已用或过期，避免把明文 Token 落库后被重复消费。
   */
  async consumePasswordResetToken(tokenId: string, db: DbClient = this.prisma): Promise<number> {
    const result = await db.passwordResetToken.updateMany({
      where: {
        id: tokenId,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    });
    return result.count;
  }

  async incrementAuthVersion(userId: string, db: DbClient = this.prisma): Promise<void> {
    // 改密/踢人后递增，让尚未过期的 Access JWT 在 Guard 里立刻失效。
    await db.user.update({
      where: { id: userId },
      data: { authVersion: { increment: 1 } },
    });
  }

  async listUsers(input: { page: number; pageSize: number; email?: string }) {
    const email = input.email?.trim().toLowerCase();
    const where = email
      ? { email: { contains: email, mode: 'insensitive' as const } }
      : {};
    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: { role: { select: { code: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
    ]);
    return { total, users };
  }

  /**
   * 条件消费验证 Token。count === 0 表示已被别人用掉或已过期，调用方按幂等成功或无效处理。
   */
  async consumeVerificationToken(tokenId: string, db: DbClient = this.prisma): Promise<number> {
    const result = await db.emailVerificationToken.updateMany({
      where: {
        id: tokenId,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    });
    return result.count;
  }

  async activateVerifiedUser(userId: string, db: DbClient = this.prisma): Promise<UserWithRole> {
    return db.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
      include: { role: { select: { code: true } } },
    });
  }

  async findEntitlementByRoleId(roleId: string, db: DbClient = this.prisma) {
    return db.aiEntitlement.findUnique({ where: { roleId } });
  }

  async upsertQuotaAccount(userId: string, db: DbClient = this.prisma) {
    return db.aiQuotaAccount.upsert({
      where: { userId },
      create: { userId, availableAmount: 0n, reservedAmount: 0n },
      update: {},
    });
  }

  async findQuotaTransactionByIdempotencyKey(idempotencyKey: string, db: DbClient = this.prisma) {
    return db.aiQuotaTransaction.findUnique({ where: { idempotencyKey } });
  }

  async grantVerificationQuota(
    input: {
      accountId: string;
      currentAvailable: bigint;
      currentReserved: bigint;
      amount: bigint;
      idempotencyKey: string;
      requestId: string;
    },
    db: DbClient = this.prisma,
  ): Promise<void> {
    const nextAvailable = input.currentAvailable + input.amount;
    await db.aiQuotaAccount.update({
      where: { id: input.accountId },
      data: {
        availableAmount: nextAvailable,
        version: { increment: 1 },
      },
    });
    await db.aiQuotaTransaction.create({
      data: {
        accountId: input.accountId,
        type: AiQuotaTransactionType.GRANT,
        amount: input.amount,
        availableBalanceAfter: nextAvailable,
        reservedBalanceAfter: input.currentReserved,
        source: 'EMAIL_VERIFICATION',
        idempotencyKey: input.idempotencyKey,
        requestId: input.requestId,
      },
    });
  }

  async createSession(
    input: {
      userId: string;
      deviceName: string | null;
      userAgent: string | null;
      ipHash: string | null;
      ipMasked: string | null;
      expiresAt: Date;
      authVersion: number;
      permissionVersion: number;
    },
    db: DbClient = this.prisma,
  ): Promise<AuthSession> {
    return db.authSession.create({ data: input });
  }

  async findActiveSessionsByUserId(userId: string, db: DbClient = this.prisma) {
    return db.authSession.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActiveAt: 'desc' },
    });
  }

  async createRefreshToken(
    input: {
      sessionId: string;
      tokenHash: string;
      expiresAt: Date;
    },
    db: DbClient = this.prisma,
  ): Promise<RefreshToken> {
    return db.refreshToken.create({ data: input });
  }

  async findSessionById(sessionId: string, db: DbClient = this.prisma) {
    return db.authSession.findUnique({
      where: { id: sessionId },
      include: { user: { include: { role: { select: { code: true } } } } },
    });
  }

  async findRefreshTokenByHash(tokenHash: string, db: DbClient = this.prisma) {
    return db.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        session: {
          include: { user: { include: { role: { select: { code: true } } } } },
        },
      },
    });
  }

  async countActiveSessions(userId: string, db: DbClient = this.prisma): Promise<number> {
    return db.authSession.count({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  async findOldestActiveSession(userId: string, db: DbClient = this.prisma) {
    return db.authSession.findFirst({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActiveAt: 'asc' },
    });
  }

  async revokeSession(
    sessionId: string,
    reason: string,
    db: DbClient = this.prisma,
  ): Promise<void> {
    const now = new Date();
    await db.authSession.update({
      where: { id: sessionId },
      data: { revokedAt: now, revokedReason: reason },
    });
    await db.refreshToken.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  async revokeActiveSessionsForUser(
    userId: string,
    reason: string,
    exceptSessionId: string | null,
    db: DbClient = this.prisma,
  ): Promise<string[]> {
    const sessions = await db.authSession.findMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      select: { id: true },
    });
    for (const session of sessions) {
      await this.revokeSession(session.id, reason, db);
    }
    return sessions.map((session) => session.id);
  }

  async updatePasswordAfterChange(
    userId: string,
    passwordHash: string,
    db: DbClient = this.prisma,
  ): Promise<void> {
    await db.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: false,
        authVersion: { increment: 1 },
      },
    });
  }

  /**
   * Refresh 轮换：只有仍处于可轮换状态的旧 token 能赢得这次状态迁移。
   * 条件更新是跨实例并发安全的关键；失败时不创建后继 token，事务由调用方回滚。
   */
  async rotateRefreshToken(
    input: {
      oldTokenId: string;
      sessionId: string;
      tokenHash: string;
      expiresAt: Date;
    },
    db: DbClient = this.prisma,
  ): Promise<RefreshToken | null> {
    const now = new Date();
    const claimed = await db.refreshToken.updateMany({
      where: {
        id: input.oldTokenId,
        sessionId: input.sessionId,
        rotatedAt: null,
        revokedAt: null,
      },
      data: {
        rotatedAt: now,
        revokedAt: now,
      },
    });
    if (claimed.count !== 1) {
      return null;
    }
    const created = await db.refreshToken.create({
      data: {
        sessionId: input.sessionId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
    });
    await db.refreshToken.update({
      where: { id: input.oldTokenId },
      data: { replacedByTokenId: created.id },
    });
    return created;
  }

  async touchSession(sessionId: string, db: DbClient = this.prisma): Promise<void> {
    await db.authSession.update({
      where: { id: sessionId },
      data: { lastActiveAt: new Date() },
    });
  }

  async createAuditLog(
    input: {
      action: string;
      actorId: string | null;
      targetId: string | null;
      requestId: string | null;
      ipHash: string | null;
      result: 'SUCCEEDED' | 'FAILED';
      detail?: Prisma.InputJsonValue;
    },
    db: DbClient = this.prisma,
  ): Promise<void> {
    await db.auditLog.create({
      data: {
        category: 'AUTH',
        action: input.action,
        actorId: input.actorId,
        targetType: 'USER',
        targetId: input.targetId,
        requestId: input.requestId,
        ipHash: input.ipHash,
        result: input.result,
        detail: input.detail,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
  }

  async findRolePermissionsByUserId(userId: string, db: DbClient = this.prisma) {
    return db.user.findUnique({
      where: { id: userId },
      select: {
        status: true,
        permissionVersion: true,
        role: {
          select: {
            permissions: {
              select: {
                dataScope: true,
                permission: { select: { code: true } },
              },
            },
          },
        },
      },
    });
  }

  async findVisibleMenus(db: DbClient = this.prisma) {
    return db.menu.findMany({
      where: {
        deletedAt: null,
        visible: true,
        enabled: true,
      },
      select: {
        id: true,
        scope: true,
        type: true,
        name: true,
        localeKey: true,
        icon: true,
        openInNewTab: true,
        parentId: true,
        routeKey: true,
        externalUrl: true,
        sortOrder: true,
        permissions: {
          select: {
            permission: { select: { code: true } },
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  isMember(role: RoleCode): boolean {
    return role === RoleCode.MEMBER;
  }

  isActive(status: UserStatus): boolean {
    return status === UserStatus.ACTIVE;
  }
}
