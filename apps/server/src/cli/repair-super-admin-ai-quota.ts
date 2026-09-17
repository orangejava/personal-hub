import { PrismaClient, RoleCode, UserStatus } from '@prisma/client';
import { grantVerificationQuotaIfMissing } from '../../prisma/ai-quota';
import { normalizeEmail } from '../modules/auth/email';

const AI_QUOTA_REPAIR_LOCK_KEY = 20_260_917_001n;

/**
 * 为早于额度修复上线的生产超级管理员补齐首发额度。
 *
 * 只接受明确指定的 active super_admin；使用与邮箱验证相同的幂等键，重复执行不会再次赠送。
 */
export async function repairSuperAdminAiQuota(client: PrismaClient, email: string) {
  const normalizedEmail = normalizeEmail(email);
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AI_QUOTA_REPAIR_LOCK_KEY})`;
    const user = await tx.user.findFirst({
      where: {
        email: normalizedEmail,
        status: UserStatus.ACTIVE,
        role: { code: RoleCode.SUPER_ADMIN },
      },
      select: { id: true, roleId: true },
    });
    if (user === null) {
      throw new Error('未找到指定的 active super_admin；请确认 SUPER_ADMIN_EMAIL。');
    }
    return grantVerificationQuotaIfMissing(tx, user, 'SUPER_ADMIN_QUOTA_REPAIR');
  });
}

async function main(): Promise<void> {
  const email = process.env.SUPER_ADMIN_EMAIL;
  if (!email) {
    throw new Error('必须设置 SUPER_ADMIN_EMAIL。');
  }
  const prisma = new PrismaClient();
  try {
    const result = await repairSuperAdminAiQuota(prisma, email);
    console.info(
      result.granted
        ? `已补齐超级管理员额度：${result.amount} Token。`
        : '超级管理员额度已存在，无需补发。',
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error('超级管理员额度修复失败。', error);
    process.exitCode = 1;
  });
}
