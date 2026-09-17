import { AiQuotaTransactionType, Prisma, PrismaClient } from '@prisma/client';

type DbClient = PrismaClient | Prisma.TransactionClient;

export interface VerificationQuotaUser {
  id: string;
  roleId: string;
}

/**
 * 为已经具备有效角色的用户补齐一次邮箱验证同等额度。
 *
 * 账号由部署 CLI 创建时不会经过邮箱验证，但它同样应获得该角色的首发额度。
 * 复用邮箱验证的幂等键，使 bootstrap、修复 CLI 和后续验证流程最多只会写一笔赠送账本。
 */
export async function grantVerificationQuotaIfMissing(
  db: DbClient,
  user: VerificationQuotaUser,
  source: string,
): Promise<{ granted: boolean; amount: bigint }> {
  const idempotencyKey = `email-verify-grant:${user.id}`;
  const existing = await db.aiQuotaTransaction.findUnique({ where: { idempotencyKey } });
  if (existing !== null) {
    return { granted: false, amount: 0n };
  }

  const entitlement = await db.aiEntitlement.findUnique({ where: { roleId: user.roleId } });
  const amount = entitlement?.verificationGrantAmount ?? 0n;
  const account = await db.aiQuotaAccount.upsert({
    where: { userId: user.id },
    create: { userId: user.id, availableAmount: 0n, reservedAmount: 0n },
    update: {},
  });
  if (amount <= 0n) {
    return { granted: false, amount: 0n };
  }

  const nextAvailable = account.availableAmount + amount;
  await db.aiQuotaAccount.update({
    where: { id: account.id },
    data: { availableAmount: nextAvailable, version: { increment: 1 } },
  });
  await db.aiQuotaTransaction.create({
    data: {
      accountId: account.id,
      type: AiQuotaTransactionType.GRANT,
      amount,
      availableBalanceAfter: nextAvailable,
      reservedBalanceAfter: account.reservedAmount,
      source,
      idempotencyKey,
    },
  });
  return { granted: true, amount };
}
