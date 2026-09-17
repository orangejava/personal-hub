import { PrismaClient, RoleCode, UserStatus } from '@prisma/client';
import { normalizeEmail } from '../modules/auth/email';
import { assertPasswordPolicy, hashPassword } from '../modules/auth/password';
import { grantVerificationQuotaIfMissing } from '../../prisma/ai-quota';

const prisma = new PrismaClient();
const BOOTSTRAP_LOCK_KEY = 20_260_809_001n;

export interface SuperAdminBootstrapInput {
  email: string;
  temporaryPassword: string;
}

export interface SuperAdminBootstrapResult {
  userId: string;
  created: boolean;
}

/**
 * 部署人员首次创建或受控提升系统所有者。
 *
 * 事务锁和 active super_admin 检查必须同时存在：前者避免并发部署都通过检查，
 * 后者确保重复执行不会被误判为成功并额外创建第二个系统所有者。
 */
export async function bootstrapSuperAdmin(
  client: PrismaClient,
  input: SuperAdminBootstrapInput,
): Promise<SuperAdminBootstrapResult> {
  const email = normalizeEmail(input.email);
  assertPasswordPolicy(input.temporaryPassword, 'SUPER_ADMIN_TEMP_PASSWORD');
  const passwordHash = await hashPassword(input.temporaryPassword);

  return client.$transaction(async (tx) => {
    // 会话级应用锁无法跨多进程保护“先检查再创建”；事务级 advisory lock 可以。
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BOOTSTRAP_LOCK_KEY})`;

    const superAdminRole = await tx.role.findUnique({
      where: { code: RoleCode.SUPER_ADMIN },
      select: { id: true },
    });
    if (superAdminRole === null) {
      throw new Error('未找到 SUPER_ADMIN 系统角色；请先运行 prisma:seed。');
    }

    const activeSuperAdminCount = await tx.user.count({
      where: {
        roleId: superAdminRole.id,
        status: UserStatus.ACTIVE,
      },
    });
    if (activeSuperAdminCount > 0) {
      throw new Error('已有 active super_admin；拒绝重复执行 bootstrap。');
    }

    const existingUser = await tx.user.findUnique({
      where: { email },
      select: { id: true },
    });
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    const user = await (existingUser === null
      ? tx.user.create({
          data: {
            email,
            passwordHash,
            status: UserStatus.ACTIVE,
            roleId: superAdminRole.id,
            emailVerifiedAt: now,
            mustChangePassword: true,
          },
        })
      : tx.user.update({
          where: { id: existingUser.id },
          data: {
            passwordHash,
            status: UserStatus.ACTIVE,
            roleId: superAdminRole.id,
            authVersion: { increment: 1 },
            permissionVersion: { increment: 1 },
            emailVerifiedAt: now,
            mustChangePassword: true,
          },
        }));

    // 被提升账号不能保留旧会话，避免旧身份版本在后续 Auth 模块接入时继续可用。
    await tx.authSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: now, revokedReason: 'SUPER_ADMIN_BOOTSTRAP' },
    });
    await tx.auditLog.create({
      data: {
        category: 'SECURITY',
        action: 'AUTH_SUPER_ADMIN_BOOTSTRAPPED',
        actorId: user.id,
        targetType: 'USER',
        targetId: user.id,
        detail: { source: 'deployment-cli', created: existingUser === null },
        expiresAt,
      },
    });

    await grantVerificationQuotaIfMissing(tx, user, 'SUPER_ADMIN_BOOTSTRAP');

    return { userId: user.id, created: existingUser === null };
  });
}

async function main(): Promise<void> {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const temporaryPassword = process.env.SUPER_ADMIN_TEMP_PASSWORD;
  if (email === undefined || temporaryPassword === undefined) {
    throw new Error('必须设置 SUPER_ADMIN_EMAIL 和 SUPER_ADMIN_TEMP_PASSWORD。');
  }

  const result = await bootstrapSuperAdmin(prisma, { email, temporaryPassword });
  console.info(
    `super_admin bootstrap 成功：${result.created ? '已创建新账号' : '已受控提升已有账号'}（${result.userId}）。`,
  );
}

if (require.main === module) {
  main()
    .catch((error: unknown) => {
      // 避免把环境变量中的临时密码写入部署日志。
      console.error('super_admin bootstrap 失败。', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
