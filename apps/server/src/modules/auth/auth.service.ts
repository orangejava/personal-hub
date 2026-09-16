import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import svgCaptcha from 'svg-captcha';
import { Prisma, RoleCode, UserStatus } from '@prisma/client';
import { DomainHttpException } from '../../common/errors/domain-http.exception';
import type { Env } from '../../config/env.schema';
import { MailService } from '../../infrastructure/mail/mail.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  CAPTCHA_CHALLENGE_IP_LIMIT,
  CAPTCHA_TTL_SECONDS,
  FORGOT_ATTEMPT_EMAIL_IP_LIMIT,
  FORGOT_ATTEMPT_IP_LIMIT,
  LOGIN_CAPTCHA_AFTER_FAILURES,
  LOGIN_FAIL_ACCOUNT_IP_LIMIT,
  LOGIN_FAIL_IP_LIMIT,
  LOGIN_FAIL_WINDOW_SECONDS,
  MEMBER_ACTIVE_SESSION_LIMIT,
  REGISTER_ATTEMPT_EMAIL_IP_LIMIT,
  REGISTER_ATTEMPT_IP_LIMIT,
  REGISTER_ATTEMPT_WINDOW_SECONDS,
  RESEND_ATTEMPT_EMAIL_IP_LIMIT,
} from '../../infrastructure/http/refresh-cookie';
import { hashPassword } from './password';
import { formatDeviceLabel, maskIp } from './session-display';
import { AuthRepository, type UserWithRole } from './auth.repository';
import { TokenService } from './token.service';
import {
  buildFilteredMenuTree,
  PERMISSION_CACHE_TTL_SECONDS,
  type MenuSnapshotRecord,
  type PermissionSnapshot,
} from './permission-snapshot';
import { PERMISSION_CATALOG, SYSTEM_ROLE_DATA_SCOPE } from './rbac-catalog';
import type {
  AuthLoginResult,
  AuthPermissionSnapshot,
  AuthUserSummary,
  CachedAuthSession,
} from './token.types';

interface LoginInput {
  email: string;
  password: string;
  challengeId?: string;
  captchaAnswer?: string;
  ip: string;
  userAgent: string | null;
  requestId: string;
  /** 匿名 AI Cookie 主体；认领失败不得影响登录。 */
  anonymousSubjectId?: string | null;
}

interface RefreshInput {
  refreshToken: string | undefined;
  ip: string;
  requestId: string;
}

interface RegisterInput {
  email: string;
  password: string;
  nickname?: string;
  ip: string;
  requestId: string;
}

interface VerifyEmailInput {
  token: string;
  ip: string;
  requestId: string;
}

interface ResendVerificationInput {
  email: string;
  ip: string;
  requestId: string;
}

/**
 * 登录注册会话与权限快照。限流键按账号+IP，失败文案给人看、错误码给前端分支。
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly authRepository: AuthRepository,
    private readonly tokenService: TokenService,
    private readonly mailService: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async login(input: LoginInput): Promise<AuthLoginResult> {
    const email = input.email.trim().toLowerCase();
    await this.assertLoginNotRateLimited(email, input.ip);
    await this.assertCaptchaIfRequired(email, input.ip, input.challengeId, input.captchaAnswer);

    const user = await this.authRepository.findUserByEmail(email);
    const passwordOk =
      user !== null ? await argon2.verify(user.passwordHash, input.password) : false;
    if (user === null || !passwordOk) {
      await this.recordLoginFailure(email, input.ip);
      throw new DomainHttpException(
        HttpStatus.UNAUTHORIZED,
        'AUTH_INVALID_CREDENTIALS',
        '账号或密码错误',
      );
    }

    if (user.status === UserStatus.PENDING_VERIFICATION) {
      throw new DomainHttpException(
        HttpStatus.FORBIDDEN,
        'AUTH_EMAIL_NOT_VERIFIED',
        '请先完成邮箱验证',
      );
    }
    if (user.status === UserStatus.DISABLED) {
      throw new DomainHttpException(HttpStatus.FORBIDDEN, 'AUTH_ACCOUNT_DISABLED', '账号已被禁用');
    }

    const ipHash = this.tokenService.hashIdentifier(input.ip);
    const refresh = this.tokenService.createRefreshToken();
    const sessionExpiresAt = refresh.expiresAt;
    const evictedSessionIds: string[] = [];
    const deviceLabel = formatDeviceLabel(input.userAgent);

    const session = await this.prisma.$transaction(async (tx) => {
      // MEMBER 活跃会话上限由角色配置读取的固定值执行，避免无限堆积设备。
      if (this.authRepository.isMember(user.role.code)) {
        const activeCount = await this.authRepository.countActiveSessions(user.id, tx);
        if (activeCount >= MEMBER_ACTIVE_SESSION_LIMIT) {
          const oldest = await this.authRepository.findOldestActiveSession(user.id, tx);
          if (oldest !== null) {
            await this.authRepository.revokeSession(oldest.id, 'SESSION_LIMIT', tx);
            evictedSessionIds.push(oldest.id);
          }
        }
      }

      const created = await this.authRepository.createSession(
        {
          userId: user.id,
          deviceName: deviceLabel,
          userAgent: input.userAgent?.slice(0, 512) ?? null,
          ipHash,
          ipMasked: maskIp(input.ip),
          expiresAt: sessionExpiresAt,
          authVersion: user.authVersion,
          permissionVersion: user.permissionVersion,
        },
        tx,
      );
      await this.authRepository.createRefreshToken(
        {
          sessionId: created.id,
          tokenHash: refresh.tokenHash,
          expiresAt: refresh.expiresAt,
        },
        tx,
      );
      await this.authRepository.createAuditLog(
        {
          action: 'AUTH_LOGIN_SUCCEEDED',
          actorId: user.id,
          targetId: user.id,
          requestId: input.requestId,
          ipHash,
          result: 'SUCCEEDED',
        },
        tx,
      );
      return created;
    });

    await Promise.all(
      evictedSessionIds.map((sessionId) => this.redis.del(this.sessionCacheKey(sessionId))),
    );
    await this.cacheSession({
      userId: user.id,
      sessionId: session.id,
      email: user.email,
      authVersion: user.authVersion,
      permissionVersion: user.permissionVersion,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      expiresAt: session.expiresAt.toISOString(),
    });
    await this.clearLoginFailures(email, input.ip);

    if (input.anonymousSubjectId) {
      try {
        const { claimAnonymousHistory } = await import('../ai/ai-anonymous');
        await claimAnonymousHistory(this.prisma, user.id, input.anonymousSubjectId);
      } catch (error) {
        this.logger.warn(
          `认领匿名 AI 历史失败 user=${user.id}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    return {
      accessToken: this.tokenService.signAccessToken({
        sub: user.id,
        sid: session.id,
        av: user.authVersion,
        pv: user.permissionVersion,
      }),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: this.toUserSummary(user),
      refreshToken: refresh.token,
    };
  }

  async refresh(input: RefreshInput): Promise<AuthLoginResult> {
    if (input.refreshToken === undefined || input.refreshToken.length === 0) {
      throw new DomainHttpException(HttpStatus.UNAUTHORIZED, 'AUTH_REQUIRED', '未登录或登录已失效');
    }

    const tokenHash = this.tokenService.hashRefreshToken(input.refreshToken);
    const existing = await this.authRepository.findRefreshTokenByHash(tokenHash);
    const now = new Date();
    if (existing === null) {
      throw new DomainHttpException(HttpStatus.UNAUTHORIZED, 'AUTH_REQUIRED', '未登录或登录已失效');
    }

    // 已轮换的 Refresh Token 再出现视为该设备链被盗用，只撤销当前会话。
    if (existing.rotatedAt !== null || existing.replacedByTokenId !== null) {
      await this.authRepository.revokeSession(existing.sessionId, 'REFRESH_REPLAY');
      await this.redis.del(this.sessionCacheKey(existing.sessionId));
      throw new DomainHttpException(HttpStatus.UNAUTHORIZED, 'AUTH_REQUIRED', '未登录或登录已失效');
    }

    if (
      existing.revokedAt !== null ||
      existing.expiresAt <= now ||
      existing.session.revokedAt !== null ||
      existing.session.expiresAt <= now
    ) {
      throw new DomainHttpException(HttpStatus.UNAUTHORIZED, 'AUTH_REQUIRED', '未登录或登录已失效');
    }

    const user = existing.session.user;
    if (user.status !== UserStatus.ACTIVE) {
      throw new DomainHttpException(HttpStatus.UNAUTHORIZED, 'AUTH_REQUIRED', '未登录或登录已失效');
    }

    const next = this.tokenService.createRefreshToken();
    const ipHash = this.tokenService.hashIdentifier(input.ip);
    await this.prisma.$transaction(async (tx) => {
      await this.authRepository.rotateRefreshToken(
        {
          oldTokenId: existing.id,
          sessionId: existing.sessionId,
          tokenHash: next.tokenHash,
          expiresAt: next.expiresAt,
        },
        tx,
      );
      await this.authRepository.touchSession(existing.sessionId, tx);
      await this.authRepository.createAuditLog(
        {
          action: 'AUTH_REFRESH_SUCCEEDED',
          actorId: user.id,
          targetId: user.id,
          requestId: input.requestId,
          ipHash,
          result: 'SUCCEEDED',
        },
        tx,
      );
    });

    await this.cacheSession({
      userId: user.id,
      sessionId: existing.sessionId,
      email: user.email,
      authVersion: user.authVersion,
      permissionVersion: user.permissionVersion,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      expiresAt: existing.session.expiresAt.toISOString(),
    });

    return {
      accessToken: this.tokenService.signAccessToken({
        sub: user.id,
        sid: existing.sessionId,
        av: user.authVersion,
        pv: user.permissionVersion,
      }),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: this.toUserSummary(user),
      refreshToken: next.token,
    };
  }

  /**
   * 结束当前 Web 会话：先按 Refresh Cookie 找 sid，没有再用未过期 Access。
   * 两样都没有时不抛错，方便前端幂等退出；只撤这一场，不会变成踢全部设备。
   */
  async logoutCurrent(input: {
    refreshToken: string | undefined;
    accessToken: string | undefined;
    ip: string;
    requestId: string;
  }): Promise<void> {
    const identity =
      (await this.resolveLogoutFromRefresh(input.refreshToken)) ??
      (await this.resolveLogoutFromAccess(input.accessToken));
    if (identity === null) {
      return;
    }
    await this.logout({
      userId: identity.userId,
      sessionId: identity.sessionId,
      ip: input.ip,
      requestId: input.requestId,
    });
  }

  async logout(input: {
    userId: string;
    sessionId: string;
    ip: string;
    requestId: string;
  }): Promise<void> {
    await this.authRepository.revokeSession(input.sessionId, 'LOGOUT');
    await this.redis.del(this.sessionCacheKey(input.sessionId));
    await this.authRepository.createAuditLog({
      action: 'AUTH_LOGOUT',
      actorId: input.userId,
      targetId: input.userId,
      requestId: input.requestId,
      ipHash: this.tokenService.hashIdentifier(input.ip),
      result: 'SUCCEEDED',
    });
  }

  /** Cookie 能对上 Refresh 哈希即可认人，即使该 Token 已被轮换（登出仍应撤掉同一场会话）。 */
  private async resolveLogoutFromRefresh(
    refreshToken: string | undefined,
  ): Promise<{ userId: string; sessionId: string } | null> {
    if (refreshToken === undefined || refreshToken.length === 0) {
      return null;
    }
    const existing = await this.authRepository.findRefreshTokenByHash(
      this.tokenService.hashRefreshToken(refreshToken),
    );
    if (existing === null) {
      return null;
    }
    return { userId: existing.session.userId, sessionId: existing.sessionId };
  }

  private async resolveLogoutFromAccess(
    accessToken: string | undefined,
  ): Promise<{ userId: string; sessionId: string } | null> {
    if (accessToken === undefined || accessToken.length === 0) {
      return null;
    }
    const payload = this.tokenService.verifyAccessToken(accessToken);
    if (payload === null) {
      return null;
    }
    try {
      const session = await this.assertActiveSession({
        userId: payload.sub,
        sessionId: payload.sid,
        authVersion: payload.av,
        permissionVersion: payload.pv,
      });
      return { userId: session.userId, sessionId: session.sessionId };
    } catch (error) {
      if (error instanceof DomainHttpException) {
        return null;
      }
      throw error;
    }
  }

  async createCaptchaChallenge(input: {
    email: string;
    ip: string;
  }): Promise<{ challengeId: string; imageSvg: string; expiresIn: number }> {
    const email = input.email.trim().toLowerCase();
    await this.assertCaptchaIssueNotRateLimited(input.ip);

    const challenge = svgCaptcha.createMathExpr({
      mathMin: 1,
      mathMax: 9,
      mathOperator: '+',
      noise: 2,
      width: 160,
      height: 50,
      color: false,
    });
    const challengeId = randomUUID();
    const activeKey = this.captchaActiveKey(email, input.ip);
    const previous = await this.redis.getJson<{ challengeId: string }>(activeKey);
    // 同一邮箱+IP 只保留最新挑战，刷新时立刻作废旧图，避免 Redis 里堆未消费答案。
    if (previous?.challengeId) {
      await this.redis.del(this.captchaKey(previous.challengeId));
    }
    await this.redis.setJson(
      this.captchaKey(challengeId),
      {
        answerHash: this.tokenService.hashCaptchaAnswer(challenge.text),
        emailHash: this.tokenService.hashIdentifier(email),
        ipHash: this.tokenService.hashIdentifier(input.ip),
      },
      CAPTCHA_TTL_SECONDS,
    );
    await this.redis.setJson(activeKey, { challengeId }, CAPTCHA_TTL_SECONDS);
    await this.recordCaptchaIssue(input.ip);
    return {
      challengeId,
      imageSvg: challenge.data,
      expiresIn: CAPTCHA_TTL_SECONDS,
    };
  }

  async listSessions(userId: string, currentSessionId: string) {
    const sessions = await this.authRepository.findActiveSessionsByUserId(userId);
    return sessions.map((session) => {
      const summary = session.deviceName
        ? {
            deviceName: session.deviceName.split(' · ')[0] ?? session.deviceName,
            browser: session.deviceName.split(' · ')[1] ?? '浏览器',
          }
        : { deviceName: '未知设备', browser: '未知浏览器' };
      return {
        id: session.id,
        deviceName: summary.deviceName,
        browser: summary.browser,
        ipMasked: session.ipMasked,
        lastActiveAt: session.lastActiveAt.toISOString(),
        createdAt: session.createdAt.toISOString(),
        isCurrent: session.id === currentSessionId,
      };
    });
  }

  async revokeOwnSession(input: {
    userId: string;
    currentSessionId: string;
    targetSessionId: string;
    ip: string;
    requestId: string;
  }): Promise<void> {
    if (input.targetSessionId === input.currentSessionId) {
      throw new DomainHttpException(
        HttpStatus.BAD_REQUEST,
        'AUTH_CANNOT_REVOKE_CURRENT',
        '不能撤销当前会话，请使用退出登录',
      );
    }
    const sessions = await this.authRepository.findActiveSessionsByUserId(input.userId);
    const target = sessions.find((session) => session.id === input.targetSessionId);
    if (!target) {
      throw new DomainHttpException(
        HttpStatus.NOT_FOUND,
        'AUTH_SESSION_NOT_FOUND',
        '会话不存在或已失效',
      );
    }
    await this.authRepository.revokeSession(input.targetSessionId, 'USER_REVOKE');
    await this.redis.del(this.sessionCacheKey(input.targetSessionId));
    await this.authRepository.createAuditLog({
      action: 'AUTH_SESSION_REVOKED',
      actorId: input.userId,
      targetId: input.userId,
      requestId: input.requestId,
      ipHash: this.tokenService.hashIdentifier(input.ip),
      result: 'SUCCEEDED',
      detail: { sessionId: input.targetSessionId },
    });
  }

  async revokeOwnSessions(input: {
    userId: string;
    currentSessionId: string;
    keepCurrent: boolean;
    ip: string;
    requestId: string;
  }): Promise<{ revokedCount: number }> {
    const except = input.keepCurrent ? input.currentSessionId : null;
    const revokedIds = await this.prisma.$transaction((tx) =>
      this.authRepository.revokeActiveSessionsForUser(input.userId, 'USER_REVOKE_ALL', except, tx),
    );
    await Promise.all(
      revokedIds.map((sessionId) => this.redis.del(this.sessionCacheKey(sessionId))),
    );
    await this.authRepository.createAuditLog({
      action: 'AUTH_SESSIONS_REVOKED',
      actorId: input.userId,
      targetId: input.userId,
      requestId: input.requestId,
      ipHash: this.tokenService.hashIdentifier(input.ip),
      result: 'SUCCEEDED',
      detail: { keepCurrent: input.keepCurrent, count: revokedIds.length },
    });
    return { revokedCount: revokedIds.length };
  }

  /**
   * 修改密码后撤销全部会话并递增 authVersion，当前设备也必须重新登录。
   */
  async changePassword(input: {
    userId: string;
    currentPassword: string;
    newPassword: string;
    ip: string;
    requestId: string;
  }): Promise<{ passwordChanged: true }> {
    const user = await this.authRepository.findUserById(input.userId);
    if (user === null || user.status !== UserStatus.ACTIVE) {
      throw new DomainHttpException(HttpStatus.UNAUTHORIZED, 'AUTH_REQUIRED', '未登录或登录已失效');
    }
    const currentOk = await argon2.verify(user.passwordHash, input.currentPassword);
    if (!currentOk) {
      throw new DomainHttpException(
        HttpStatus.UNAUTHORIZED,
        'AUTH_INVALID_CREDENTIALS',
        '当前密码不正确',
      );
    }
    if (input.currentPassword === input.newPassword) {
      throw new DomainHttpException(
        HttpStatus.BAD_REQUEST,
        'AUTH_PASSWORD_UNCHANGED',
        '新密码不能与当前密码相同',
      );
    }

    const passwordHash = await hashPassword(input.newPassword);
    const revokedIds = await this.prisma.$transaction(async (tx) => {
      await this.authRepository.updatePasswordAfterChange(input.userId, passwordHash, tx);
      const ids = await this.authRepository.revokeActiveSessionsForUser(
        input.userId,
        'PASSWORD_CHANGED',
        null,
        tx,
      );
      await this.authRepository.createAuditLog(
        {
          action: 'AUTH_PASSWORD_CHANGED',
          actorId: input.userId,
          targetId: input.userId,
          requestId: input.requestId,
          ipHash: this.tokenService.hashIdentifier(input.ip),
          result: 'SUCCEEDED',
        },
        tx,
      );
      return ids;
    });
    await Promise.all(
      revokedIds.map((sessionId) => this.redis.del(this.sessionCacheKey(sessionId))),
    );
    return { passwordChanged: true };
  }

  /**
   * 公开注册只创建 PENDING_VERIFICATION MEMBER，不签发登录态。
   * 已存在邮箱一律 202，避免枚举；仅未验证账号会轮换 Token 并重发邮件。
   */
  async register(input: RegisterInput): Promise<{ accepted: true }> {
    const email = input.email.trim().toLowerCase();
    await this.assertRegisterNotRateLimited(email, input.ip);
    await this.recordRegisterAttempt(email, input.ip);

    const existing = await this.authRepository.findUserByEmail(email);
    if (existing !== null) {
      if (existing.status === UserStatus.PENDING_VERIFICATION) {
        await this.rotateVerificationTokenAndNotify(existing, input.ip, input.requestId);
      }
      return { accepted: true };
    }

    try {
      await this.createPendingMemberAndNotify(input, email);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        const raced = await this.authRepository.findUserByEmail(email);
        if (raced?.status === UserStatus.PENDING_VERIFICATION) {
          await this.rotateVerificationTokenAndNotify(raced, input.ip, input.requestId);
        }
        return { accepted: true };
      }
      throw error;
    }

    return { accepted: true };
  }

  async resendVerification(input: ResendVerificationInput): Promise<{ accepted: true }> {
    const email = input.email.trim().toLowerCase();
    await this.assertResendNotRateLimited(email, input.ip);
    await this.recordResendAttempt(email, input.ip);

    const user = await this.authRepository.findUserByEmail(email);
    if (user?.status === UserStatus.PENDING_VERIFICATION) {
      await this.rotateVerificationTokenAndNotify(user, input.ip, input.requestId);
    }
    return { accepted: true };
  }

  /**
   * 忘记密码始终 202，避免枚举。仅 ACTIVE 账号会轮换 Token 并发信。
   */
  async forgotPassword(input: { email: string; ip: string; requestId: string }): Promise<{
    accepted: true;
  }> {
    const email = input.email.trim().toLowerCase();
    await this.assertForgotNotRateLimited(email, input.ip);
    await this.recordForgotAttempt(email, input.ip);

    const user = await this.authRepository.findUserByEmail(email);
    if (user?.status === UserStatus.ACTIVE) {
      await this.rotatePasswordResetTokenAndNotify(user, input.ip, input.requestId);
    }
    return { accepted: true };
  }

  /**
   * 消费重置链接：改密、递增 authVersion、撤销全部会话。
   */
  async resetPassword(input: {
    token: string;
    newPassword: string;
    ip: string;
    requestId: string;
  }): Promise<{ passwordReset: true }> {
    const tokenHash = this.tokenService.hashPasswordResetToken(input.token);
    const record = await this.authRepository.findPasswordResetTokenByHash(tokenHash);
    if (record === null || record.user.status !== UserStatus.ACTIVE) {
      throw this.invalidResetToken();
    }

    const passwordHash = await hashPassword(input.newPassword);
    const revokedIds = await this.prisma.$transaction(async (tx) => {
      const consumed = await this.authRepository.consumePasswordResetToken(record.id, tx);
      if (consumed === 0) {
        throw this.invalidResetToken();
      }
      await this.authRepository.updatePasswordAfterChange(record.userId, passwordHash, tx);
      const ids = await this.authRepository.revokeActiveSessionsForUser(
        record.userId,
        'PASSWORD_RESET',
        null,
        tx,
      );
      await this.authRepository.createAuditLog(
        {
          action: 'AUTH_PASSWORD_RESET',
          actorId: record.userId,
          targetId: record.userId,
          requestId: input.requestId,
          ipHash: this.tokenService.hashIdentifier(input.ip),
          result: 'SUCCEEDED',
        },
        tx,
      );
      return ids;
    });
    await Promise.all(
      revokedIds.map((sessionId) => this.redis.del(this.sessionCacheKey(sessionId))),
    );
    return { passwordReset: true };
  }

  async getAdminUserOrThrow(userId: string) {
    const user = await this.authRepository.findUserById(userId);
    if (user === null) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'AUTH_USER_NOT_FOUND', '用户不存在');
    }
    return user;
  }

  async listAdminUsers(input: { page: number; pageSize: number; email?: string }) {
    const page = input.page;
    const pageSize = input.pageSize;
    const result = await this.authRepository.listUsers({
      page,
      pageSize,
      email: input.email,
    });
    return {
      list: result.users.map((user) => ({
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role.code,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
      })),
      total: result.total,
      page,
      pageSize,
    };
  }

  /** 后台角色列表，权限码来自当前 `role_permissions`，不是 mock 那套 `content:write`。 */
  async listAdminRoles() {
    const roles = await this.prisma.role.findMany({
      orderBy: { code: 'asc' },
      include: {
        permissions: {
          select: { permission: { select: { code: true } } },
        },
      },
    });
    return roles.map((role) => this.mapAdminRole(role));
  }

  /** 受控权限目录，给角色页按组勾选。 */
  listAdminPermissions() {
    return PERMISSION_CATALOG.map(({ code, group, label, description }) => ({
      code,
      group,
      label,
      description,
    }));
  }

  /**
   * 替换非受保护角色的权限关联。
   * 提升该角色用户的 permissionVersion 并清会话缓存，让旧 Access Token 下次请求失效。
   */
  async replaceRolePermissions(input: {
    actorId: string;
    roleCode: RoleCode;
    permissions: string[];
    version: number;
    requestId: string;
    ip: string;
  }) {
    const catalogCodes = new Set<string>(PERMISSION_CATALOG.map((item) => item.code));
    const unique = [...new Set(input.permissions)];
    const unknown = unique.filter((code) => !catalogCodes.has(code));
    if (unknown.length > 0) {
      throw new DomainHttpException(
        HttpStatus.BAD_REQUEST,
        'AUTH_PERMISSION_UNKNOWN',
        `未知权限：${unknown.join(', ')}`,
      );
    }

    const role = await this.prisma.role.findUnique({ where: { code: input.roleCode } });
    if (role === null) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'AUTH_ROLE_NOT_FOUND', '角色不存在');
    }
    if (role.isProtected) {
      throw new DomainHttpException(
        HttpStatus.FORBIDDEN,
        'AUTH_ROLE_PROTECTED',
        '不能修改系统所有者权限',
      );
    }

    const permissionRows =
      unique.length === 0
        ? []
        : await this.prisma.permission.findMany({
            where: { code: { in: unique } },
            select: { id: true, code: true },
          });
    if (permissionRows.length !== unique.length) {
      throw new DomainHttpException(
        HttpStatus.BAD_REQUEST,
        'AUTH_PERMISSION_UNKNOWN',
        '权限目录未同步，请先执行 seed',
      );
    }

    const userIds = await this.prisma.$transaction(async (tx) => {
      // 先按客户端读取到的 version 抢占角色，失败时整个事务不会覆盖别人的权限选择。
      const versionUpdated = await tx.role.updateMany({
        where: { id: role.id, version: input.version },
        data: { version: { increment: 1 } },
      });
      if (versionUpdated.count !== 1) {
        throw new DomainHttpException(
          HttpStatus.CONFLICT,
          'ROLE_VERSION_CONFLICT',
          '角色权限已被更新，请刷新后重试',
        );
      }
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      if (permissionRows.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionRows.map((item) => ({
            roleId: role.id,
            permissionId: item.id,
            dataScope: SYSTEM_ROLE_DATA_SCOPE[input.roleCode],
          })),
        });
      }
      const users = await tx.user.findMany({
        where: { roleId: role.id },
        select: { id: true },
      });
      if (users.length > 0) {
        await tx.user.updateMany({
          where: { roleId: role.id },
          data: { permissionVersion: { increment: 1 } },
        });
      }
      await this.authRepository.createAuditLog(
        {
          action: 'ADMIN_ROLE_PERMISSIONS_UPDATED',
          actorId: input.actorId,
          targetId: role.id,
          requestId: input.requestId,
          ipHash: this.tokenService.hashIdentifier(input.ip),
          result: 'SUCCEEDED',
          detail: { roleCode: input.roleCode, permissions: unique },
        },
        tx,
      );
      return users.map((user) => user.id);
    });

    const sessionIds = (
      await Promise.all(
        userIds.map((userId) => this.authRepository.findActiveSessionsByUserId(userId)),
      )
    ).flatMap((sessions) => sessions.map((session) => session.id));
    await Promise.all(sessionIds.map((sessionId) => this.redis.del(this.sessionCacheKey(sessionId))));

    const updated = await this.prisma.role.findUniqueOrThrow({
      where: { id: role.id },
      include: {
        permissions: {
          select: { permission: { select: { code: true } } },
        },
      },
    });
    return this.mapAdminRole(updated);
  }

  private mapAdminRole(role: {
    code: RoleCode;
    label: string;
    isProtected: boolean;
    version: number;
    permissions: Array<{ permission: { code: string } }>;
  }) {
    return {
      code: role.code,
      name: role.label,
      isProtected: role.isProtected,
      version: role.version,
      permissions: role.permissions.map((item) => item.permission.code),
    };
  }

  /**
   * 管理员踢指定用户全部设备。admin 不能踢 admin / super_admin；不能踢自己。
   */
  async revokeAllSessionsAsAdmin(input: {
    actorId: string;
    targetUserId: string;
    ip: string;
    requestId: string;
  }): Promise<{ revokedCount: number }> {
    const actor = await this.authRepository.findUserById(input.actorId);
    const target = await this.authRepository.findUserById(input.targetUserId);
    if (actor === null) {
      throw new DomainHttpException(HttpStatus.UNAUTHORIZED, 'AUTH_REQUIRED', '未登录或登录已失效');
    }
    if (target === null) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'AUTH_USER_NOT_FOUND', '用户不存在');
    }
    if (actor.id === target.id) {
      throw new DomainHttpException(
        HttpStatus.BAD_REQUEST,
        'AUTH_CANNOT_REVOKE_SELF',
        '不能通过后台踢自己，请使用登录设备页',
      );
    }
    if (
      actor.role.code !== RoleCode.SUPER_ADMIN &&
      (target.role.code === RoleCode.SUPER_ADMIN || target.role.code === RoleCode.ADMIN)
    ) {
      throw new DomainHttpException(
        HttpStatus.FORBIDDEN,
        'AUTH_FORBIDDEN',
        '无权撤销该用户的会话',
      );
    }

    const revokedIds = await this.prisma.$transaction(async (tx) => {
      await this.authRepository.incrementAuthVersion(target.id, tx);
      const ids = await this.authRepository.revokeActiveSessionsForUser(
        target.id,
        'ADMIN_REVOKE_ALL',
        null,
        tx,
      );
      await this.authRepository.createAuditLog(
        {
          action: 'ADMIN_SESSIONS_REVOKED',
          actorId: actor.id,
          targetId: target.id,
          requestId: input.requestId,
          ipHash: this.tokenService.hashIdentifier(input.ip),
          result: 'SUCCEEDED',
          detail: { count: ids.length },
        },
        tx,
      );
      return ids;
    });
    await Promise.all(
      revokedIds.map((sessionId) => this.redis.del(this.sessionCacheKey(sessionId))),
    );
    return { revokedCount: revokedIds.length };
  }

  /**
   * 消费一次性邮件链接。已激活账号重复点击同一 Token 视为成功，且不会二次 GRANT。
   */
  async verifyEmail(input: VerifyEmailInput): Promise<{ verified: true }> {
    const tokenHash = this.tokenService.hashEmailVerificationToken(input.token);
    const record = await this.authRepository.findVerificationTokenByHash(tokenHash);
    if (record === null) {
      throw this.invalidVerificationToken();
    }

    if (record.consumedAt !== null || record.expiresAt <= new Date()) {
      if (record.user.status === UserStatus.ACTIVE) {
        return { verified: true };
      }
      throw this.invalidVerificationToken();
    }

    if (record.user.status === UserStatus.ACTIVE) {
      await this.authRepository.consumeVerificationToken(record.id);
      return { verified: true };
    }

    if (record.user.status !== UserStatus.PENDING_VERIFICATION) {
      throw this.invalidVerificationToken();
    }

    const consumed = await this.prisma.$transaction(async (tx) => {
      const count = await this.authRepository.consumeVerificationToken(record.id, tx);
      if (count !== 1) {
        return false;
      }

      const latest = await this.authRepository.findUserById(record.userId, tx);
      if (latest === null) {
        throw this.invalidVerificationToken();
      }
      const user =
        latest.status === UserStatus.PENDING_VERIFICATION
          ? await this.authRepository.activateVerifiedUser(latest.id, tx)
          : latest;

      await this.grantVerificationQuotaIfNeeded(user, input.requestId, tx);
      await this.authRepository.createAuditLog(
        {
          action: 'AUTH_EMAIL_VERIFIED',
          actorId: user.id,
          targetId: user.id,
          requestId: input.requestId,
          ipHash: this.tokenService.hashIdentifier(input.ip),
          result: 'SUCCEEDED',
        },
        tx,
      );
      return true;
    });

    if (!consumed) {
      const latest = await this.authRepository.findUserById(record.userId);
      if (latest?.status === UserStatus.ACTIVE) {
        return { verified: true };
      }
      throw this.invalidVerificationToken();
    }

    return { verified: true };
  }

  async getCurrentUser(userId: string): Promise<AuthUserSummary> {
    const user = await this.authRepository.findUserById(userId);
    if (user === null || user.status !== UserStatus.ACTIVE) {
      throw new DomainHttpException(HttpStatus.UNAUTHORIZED, 'AUTH_REQUIRED', '未登录或登录已失效');
    }
    return this.toUserSummary(user);
  }

  /**
   * 当前会话的动作权限、数据范围和过滤后菜单。
   * 快照按 userId + permissionVersion 缓存；权限变更会提升 pv，自然错过旧缓存。
   */
  async getPermissionSnapshot(
    userId: string,
    permissionVersion: number,
  ): Promise<AuthPermissionSnapshot> {
    const epoch = (await this.redis.get('system:menu-epoch')) ?? '0';
    const cacheKey = this.permissionCacheKey(userId, permissionVersion, epoch);
    const cached = await this.readPermissionCache(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const snapshot = await this.loadPermissionSnapshot(userId);
    await this.writePermissionCache(cacheKey, snapshot);
    return snapshot;
  }

  async assertActiveSession(input: {
    userId: string;
    sessionId: string;
    authVersion: number;
    permissionVersion: number;
  }): Promise<CachedAuthSession> {
    const cached = await this.redis.getJson<CachedAuthSession>(
      this.sessionCacheKey(input.sessionId),
    );
    const session = cached ?? (await this.loadSessionFromDatabase(input.sessionId));
    if (
      session.userId !== input.userId ||
      session.authVersion !== input.authVersion ||
      session.permissionVersion !== input.permissionVersion ||
      session.status !== 'ACTIVE' ||
      new Date(session.expiresAt) <= new Date()
    ) {
      throw new DomainHttpException(HttpStatus.UNAUTHORIZED, 'AUTH_REQUIRED', '未登录或登录已失效');
    }
    return session;
  }

  private async loadSessionFromDatabase(sessionId: string): Promise<CachedAuthSession> {
    const record = await this.authRepository.findSessionById(sessionId);
    if (record === null || record.revokedAt !== null || record.expiresAt <= new Date()) {
      throw new DomainHttpException(HttpStatus.UNAUTHORIZED, 'AUTH_REQUIRED', '未登录或登录已失效');
    }

    const cached: CachedAuthSession = {
      userId: record.userId,
      sessionId: record.id,
      email: record.user.email,
      authVersion: record.user.authVersion,
      permissionVersion: record.user.permissionVersion,
      status: record.user.status,
      mustChangePassword: record.user.mustChangePassword,
      expiresAt: record.expiresAt.toISOString(),
    };
    await this.cacheSession(cached);
    return cached;
  }

  private async cacheSession(session: CachedAuthSession): Promise<void> {
    const ttlSeconds = Math.max(
      1,
      Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000),
    );
    try {
      await this.redis.setJson(this.sessionCacheKey(session.sessionId), session, ttlSeconds);
    } catch (error) {
      this.logger.warn(
        { err: error, sessionId: session.sessionId },
        '写入会话缓存失败，Guard 将回退到数据库',
      );
    }
  }

  private sessionCacheKey(sessionId: string): string {
    return `auth:session:${sessionId}`;
  }

  private permissionCacheKey(
    userId: string,
    permissionVersion: number,
    menuEpoch: string,
  ): string {
    return `auth:permission:${userId}:${permissionVersion}:${menuEpoch}`;
  }

  private async readPermissionCache(key: string): Promise<AuthPermissionSnapshot | null> {
    try {
      return await this.redis.getJson<AuthPermissionSnapshot>(key);
    } catch (error) {
      this.logger.warn({ err: error }, '读取权限快照缓存失败，将回退到数据库');
      return null;
    }
  }

  private async writePermissionCache(key: string, snapshot: AuthPermissionSnapshot): Promise<void> {
    try {
      await this.redis.setJson(key, snapshot, PERMISSION_CACHE_TTL_SECONDS);
    } catch (error) {
      this.logger.warn({ err: error }, '写入权限快照缓存失败');
    }
  }

  private async loadPermissionSnapshot(userId: string): Promise<AuthPermissionSnapshot> {
    const user = await this.authRepository.findRolePermissionsByUserId(userId);
    if (user === null || user.status !== UserStatus.ACTIVE) {
      throw new DomainHttpException(HttpStatus.UNAUTHORIZED, 'AUTH_REQUIRED', '未登录或登录已失效');
    }

    const permissions = user.role.permissions.map((item) => ({
      code: item.permission.code,
      dataScope: item.dataScope,
    }));
    const grantedCodes = new Set(permissions.map((item) => item.code));
    const menuRows = await this.authRepository.findVisibleMenus();
    const menus: MenuSnapshotRecord[] = menuRows.map((menu) => ({
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

    const snapshot: PermissionSnapshot = {
      permissions,
      menus: buildFilteredMenuTree(menus, grantedCodes),
    };
    return snapshot;
  }

  private loginFailAccountKey(email: string, ip: string): string {
    return `auth:login-fail:${this.tokenService.hashIdentifier(email)}:${this.tokenService.hashIdentifier(ip)}`;
  }

  private loginFailIpKey(ip: string): string {
    return `auth:login-ip:${this.tokenService.hashIdentifier(ip)}`;
  }

  private captchaKey(challengeId: string): string {
    return `auth:captcha:${challengeId}`;
  }

  private captchaActiveKey(email: string, ip: string): string {
    return `auth:captcha-active:${this.tokenService.hashIdentifier(email)}:${this.tokenService.hashIdentifier(ip)}`;
  }

  private captchaIssueIpKey(ip: string): string {
    return `auth:captcha-issue:${this.tokenService.hashIdentifier(ip)}`;
  }

  private registerAttemptKey(email: string, ip: string): string {
    return `auth:register:${this.tokenService.hashIdentifier(email)}:${this.tokenService.hashIdentifier(ip)}`;
  }

  private registerIpKey(ip: string): string {
    return `auth:register-ip:${this.tokenService.hashIdentifier(ip)}`;
  }

  private resendAttemptKey(email: string, ip: string): string {
    return `auth:resend:${this.tokenService.hashIdentifier(email)}:${this.tokenService.hashIdentifier(ip)}`;
  }

  private forgotAttemptKey(email: string, ip: string): string {
    return `auth:forgot:${this.tokenService.hashIdentifier(email)}:${this.tokenService.hashIdentifier(ip)}`;
  }

  private forgotIpKey(ip: string): string {
    return `auth:forgot-ip:${this.tokenService.hashIdentifier(ip)}`;
  }

  private async createPendingMemberAndNotify(input: RegisterInput, email: string): Promise<void> {
    const role = await this.authRepository.findRoleByCode(RoleCode.MEMBER);
    if (role === null) {
      throw new DomainHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'INTERNAL_SERVER_ERROR',
        '服务暂时不可用，请稍后重试',
      );
    }

    const passwordHash = await hashPassword(input.password);
    const issued = this.tokenService.createEmailVerificationToken();
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await this.authRepository.createPendingMember(
        {
          email,
          passwordHash,
          nickname: input.nickname?.trim() || null,
          roleId: role.id,
        },
        tx,
      );
      await this.authRepository.createVerificationToken(
        {
          userId: created.id,
          tokenHash: issued.tokenHash,
          expiresAt: issued.expiresAt,
        },
        tx,
      );
      await this.authRepository.createAuditLog(
        {
          action: 'AUTH_REGISTERED',
          actorId: created.id,
          targetId: created.id,
          requestId: input.requestId,
          ipHash: this.tokenService.hashIdentifier(input.ip),
          result: 'SUCCEEDED',
        },
        tx,
      );
      return created;
    });

    await this.trySendVerificationEmail(user.email, issued.token);
  }

  private async rotateVerificationTokenAndNotify(
    user: UserWithRole,
    ip: string,
    requestId: string,
  ): Promise<void> {
    const issued = this.tokenService.createEmailVerificationToken();
    await this.prisma.$transaction(async (tx) => {
      await this.authRepository.invalidateOpenVerificationTokens(user.id, tx);
      await this.authRepository.createVerificationToken(
        {
          userId: user.id,
          tokenHash: issued.tokenHash,
          expiresAt: issued.expiresAt,
        },
        tx,
      );
      await this.authRepository.createAuditLog(
        {
          action: 'AUTH_VERIFICATION_RESENT',
          actorId: user.id,
          targetId: user.id,
          requestId,
          ipHash: this.tokenService.hashIdentifier(ip),
          result: 'SUCCEEDED',
        },
        tx,
      );
    });
    await this.trySendVerificationEmail(user.email, issued.token);
  }

  private async grantVerificationQuotaIfNeeded(
    user: UserWithRole,
    requestId: string,
    db: Parameters<AuthRepository['upsertQuotaAccount']>[1],
  ): Promise<void> {
    const idempotencyKey = `email-verify-grant:${user.id}`;
    const existing = await this.authRepository.findQuotaTransactionByIdempotencyKey(
      idempotencyKey,
      db,
    );
    if (existing !== null) {
      return;
    }

    const entitlement = await this.authRepository.findEntitlementByRoleId(user.roleId, db);
    const amount = entitlement?.verificationGrantAmount ?? 0n;
    const account = await this.authRepository.upsertQuotaAccount(user.id, db);
    if (amount <= 0n) {
      return;
    }

    try {
      await this.authRepository.grantVerificationQuota(
        {
          accountId: account.id,
          currentAvailable: account.availableAmount,
          currentReserved: account.reservedAmount,
          amount,
          idempotencyKey,
          requestId,
        },
        db,
      );
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        return;
      }
      throw error;
    }
  }

  private async trySendVerificationEmail(email: string, token: string): Promise<void> {
    const origin = this.config.getOrThrow('PUBLIC_APP_ORIGIN');
    const verifyUrl = `${origin}/user/verify-email?token=${encodeURIComponent(token)}`;
    try {
      await this.mailService.sendVerificationEmail({ to: email, verifyUrl });
    } catch (error) {
      this.logger.warn(
        { err: error, emailHash: this.tokenService.hashIdentifier(email) },
        '发送验证邮件失败，用户可稍后重发',
      );
    }
  }

  private async rotatePasswordResetTokenAndNotify(
    user: UserWithRole,
    ip: string,
    requestId: string,
  ): Promise<void> {
    const issued = this.tokenService.createPasswordResetToken();
    await this.prisma.$transaction(async (tx) => {
      await this.authRepository.invalidateOpenPasswordResetTokens(user.id, tx);
      await this.authRepository.createPasswordResetToken(
        {
          userId: user.id,
          tokenHash: issued.tokenHash,
          expiresAt: issued.expiresAt,
        },
        tx,
      );
      await this.authRepository.createAuditLog(
        {
          action: 'AUTH_PASSWORD_RESET_REQUESTED',
          actorId: user.id,
          targetId: user.id,
          requestId,
          ipHash: this.tokenService.hashIdentifier(ip),
          result: 'SUCCEEDED',
        },
        tx,
      );
    });
    await this.trySendPasswordResetEmail(user.email, issued.token);
  }

  private async trySendPasswordResetEmail(email: string, token: string): Promise<void> {
    const origin = this.config.getOrThrow('PUBLIC_APP_ORIGIN');
    const resetUrl = `${origin}/user/reset-password?token=${encodeURIComponent(token)}`;
    try {
      await this.mailService.sendPasswordResetEmail({ to: email, resetUrl });
    } catch (error) {
      this.logger.warn(
        { err: error, emailHash: this.tokenService.hashIdentifier(email) },
        '发送重置密码邮件失败，用户可稍后重试',
      );
    }
  }

  private invalidResetToken(): DomainHttpException {
    return new DomainHttpException(
      HttpStatus.BAD_REQUEST,
      'AUTH_RESET_TOKEN_INVALID',
      '重置链接无效或已过期',
    );
  }

  private async assertForgotNotRateLimited(email: string, ip: string): Promise<void> {
    const emailFails = await this.readCounter(this.forgotAttemptKey(email, ip));
    const ipFails = await this.readCounter(this.forgotIpKey(ip));
    if (emailFails >= FORGOT_ATTEMPT_EMAIL_IP_LIMIT || ipFails >= FORGOT_ATTEMPT_IP_LIMIT) {
      throw new DomainHttpException(
        HttpStatus.TOO_MANY_REQUESTS,
        'AUTH_RATE_LIMITED',
        '尝试过于频繁，请稍后再试',
        [],
        { retryAfterSeconds: REGISTER_ATTEMPT_WINDOW_SECONDS },
      );
    }
  }

  private async recordForgotAttempt(email: string, ip: string): Promise<void> {
    try {
      await Promise.all([
        this.redis.incrWithTtl(this.forgotAttemptKey(email, ip), REGISTER_ATTEMPT_WINDOW_SECONDS),
        this.redis.incrWithTtl(this.forgotIpKey(ip), REGISTER_ATTEMPT_WINDOW_SECONDS),
      ]);
    } catch (error) {
      this.logger.warn({ err: error }, '记录忘记密码限流计数失败');
    }
  }

  private invalidVerificationToken(): DomainHttpException {
    return new DomainHttpException(
      HttpStatus.BAD_REQUEST,
      'AUTH_VERIFICATION_TOKEN_INVALID',
      '验证链接无效或已过期',
    );
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private async assertRegisterNotRateLimited(email: string, ip: string): Promise<void> {
    const emailFails = await this.readCounter(this.registerAttemptKey(email, ip));
    const ipFails = await this.readCounter(this.registerIpKey(ip));
    if (emailFails >= REGISTER_ATTEMPT_EMAIL_IP_LIMIT || ipFails >= REGISTER_ATTEMPT_IP_LIMIT) {
      throw new DomainHttpException(
        HttpStatus.TOO_MANY_REQUESTS,
        'AUTH_RATE_LIMITED',
        '尝试过于频繁，请稍后再试',
        [],
        { retryAfterSeconds: REGISTER_ATTEMPT_WINDOW_SECONDS },
      );
    }
  }

  private async recordRegisterAttempt(email: string, ip: string): Promise<void> {
    try {
      await Promise.all([
        this.redis.incrWithTtl(this.registerAttemptKey(email, ip), REGISTER_ATTEMPT_WINDOW_SECONDS),
        this.redis.incrWithTtl(this.registerIpKey(ip), REGISTER_ATTEMPT_WINDOW_SECONDS),
      ]);
    } catch (error) {
      this.logger.warn({ err: error }, '记录注册限流计数失败');
    }
  }

  private async assertResendNotRateLimited(email: string, ip: string): Promise<void> {
    const count = await this.readCounter(this.resendAttemptKey(email, ip));
    if (count >= RESEND_ATTEMPT_EMAIL_IP_LIMIT) {
      throw new DomainHttpException(
        HttpStatus.TOO_MANY_REQUESTS,
        'AUTH_RATE_LIMITED',
        '尝试过于频繁，请稍后再试',
        [],
        { retryAfterSeconds: REGISTER_ATTEMPT_WINDOW_SECONDS },
      );
    }
  }

  private async recordResendAttempt(email: string, ip: string): Promise<void> {
    try {
      await this.redis.incrWithTtl(
        this.resendAttemptKey(email, ip),
        REGISTER_ATTEMPT_WINDOW_SECONDS,
      );
    } catch (error) {
      this.logger.warn({ err: error }, '记录重发验证邮件限流计数失败');
    }
  }

  private async assertLoginNotRateLimited(email: string, ip: string): Promise<void> {
    const accountFails = await this.readCounter(this.loginFailAccountKey(email, ip));
    const ipFails = await this.readCounter(this.loginFailIpKey(ip));
    if (accountFails >= LOGIN_FAIL_ACCOUNT_IP_LIMIT || ipFails >= LOGIN_FAIL_IP_LIMIT) {
      throw new DomainHttpException(
        HttpStatus.TOO_MANY_REQUESTS,
        'AUTH_RATE_LIMITED',
        '登录尝试过于频繁，请稍后再试',
        [],
        { retryAfterSeconds: LOGIN_FAIL_WINDOW_SECONDS },
      );
    }
  }

  /**
   * 同一账号+IP 连续失败达到阈值后，必须提交一次性验证码。
   * 错码会立刻作废挑战，避免重放；缺码不计入失败次数，避免未出码就被限流。
   */
  private async assertCaptchaIfRequired(
    email: string,
    ip: string,
    challengeId: string | undefined,
    captchaAnswer: string | undefined,
  ): Promise<void> {
    const accountFails = await this.readCounter(this.loginFailAccountKey(email, ip));
    if (accountFails < LOGIN_CAPTCHA_AFTER_FAILURES) {
      return;
    }
    if (!challengeId || captchaAnswer === undefined || captchaAnswer.trim().length === 0) {
      throw this.captchaRequired();
    }

    const record = await this.redis.getJson<{
      answerHash: string;
      emailHash: string;
      ipHash: string;
    }>(this.captchaKey(challengeId));
    await this.redis.del(this.captchaKey(challengeId));
    const active = await this.redis.getJson<{ challengeId: string }>(
      this.captchaActiveKey(email, ip),
    );
    if (active?.challengeId === challengeId) {
      await this.redis.del(this.captchaActiveKey(email, ip));
    }
    const expectedEmail = this.tokenService.hashIdentifier(email);
    const expectedIp = this.tokenService.hashIdentifier(ip);
    const expectedAnswer = this.tokenService.hashCaptchaAnswer(captchaAnswer);
    if (
      record === null ||
      record.emailHash !== expectedEmail ||
      record.ipHash !== expectedIp ||
      record.answerHash !== expectedAnswer
    ) {
      await this.recordLoginFailure(email, ip);
      throw this.captchaRequired();
    }
  }

  private captchaRequired(): DomainHttpException {
    return new DomainHttpException(
      HttpStatus.FORBIDDEN,
      'AUTH_CAPTCHA_REQUIRED',
      '请完成验证码后重试',
    );
  }

  private async assertCaptchaIssueNotRateLimited(ip: string): Promise<void> {
    const count = await this.readCounter(this.captchaIssueIpKey(ip));
    if (count >= CAPTCHA_CHALLENGE_IP_LIMIT) {
      throw new DomainHttpException(
        HttpStatus.TOO_MANY_REQUESTS,
        'AUTH_RATE_LIMITED',
        '尝试过于频繁，请稍后再试',
        [],
        { retryAfterSeconds: LOGIN_FAIL_WINDOW_SECONDS },
      );
    }
  }

  private async recordCaptchaIssue(ip: string): Promise<void> {
    try {
      await this.redis.incrWithTtl(this.captchaIssueIpKey(ip), LOGIN_FAIL_WINDOW_SECONDS);
    } catch (error) {
      this.logger.warn({ err: error }, '记录验证码签发计数失败');
    }
  }

  private async recordLoginFailure(email: string, ip: string): Promise<void> {
    try {
      await Promise.all([
        this.redis.incrWithTtl(this.loginFailAccountKey(email, ip), LOGIN_FAIL_WINDOW_SECONDS),
        this.redis.incrWithTtl(this.loginFailIpKey(ip), LOGIN_FAIL_WINDOW_SECONDS),
      ]);
    } catch (error) {
      this.logger.warn({ err: error }, '记录登录失败计数失败');
    }
  }

  private async clearLoginFailures(email: string, ip: string): Promise<void> {
    try {
      await Promise.all([
        this.redis.del(this.loginFailAccountKey(email, ip)),
        this.redis.del(this.loginFailIpKey(ip)),
      ]);
    } catch (error) {
      this.logger.warn({ err: error }, '清理登录失败计数失败');
    }
  }

  private async readCounter(key: string): Promise<number> {
    try {
      const raw = await this.redis.get(key);
      if (raw === null) {
        return 0;
      }
      const parsed = Number.parseInt(raw, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    } catch {
      return 0;
    }
  }

  private toUserSummary(user: UserWithRole): AuthUserSummary {
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      role: user.role.code,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      avatarFileId: user.avatarFileId,
      bio: user.bio,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
