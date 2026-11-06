import { HttpStatus, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  AiMessageRole,
  AiMessageStatus,
  AiQuotaTransactionType,
  AiReservationStatus,
  RoleCode,
  Prisma,
} from '@prisma/client';
import { DomainHttpException } from '../../common/errors/domain-http.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const RESERVE_TTL_MS = 5 * 60 * 1000;

/**
 * 平台额度预占 / 结算 / 释放。禁止进程内锁，一律条件更新。
 */
@Injectable()
export class AiQuotaService {
  constructor(private readonly prisma: PrismaService) {}

  async account(userId: string, actorId: string) {
    await this.assertSuperAdmin(actorId);
    const row = await this.prisma.aiQuotaAccount.findUnique({ where: { userId } });
    if (!row)
      throw new DomainHttpException(
        HttpStatus.NOT_FOUND,
        'AI_QUOTA_ACCOUNT_NOT_FOUND',
        '用户额度账户不存在',
      );
    return {
      userId,
      availableAmount: Number(row.availableAmount),
      reservedAmount: Number(row.reservedAmount),
    };
  }

  private async assertSuperAdmin(actorId: string) {
    const actor = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { role: { select: { code: true } } },
    });
    if (actor?.role.code !== RoleCode.SUPER_ADMIN) {
      throw new DomainHttpException(
        HttpStatus.FORBIDDEN,
        'AI_QUOTA_ADJUST_FORBIDDEN',
        '仅超级管理员可调整额度',
      );
    }
  }

  /** 管理员调整采用条件更新和唯一幂等键；扣减失败时事务整体回滚。 */
  async adjust(input: {
    userId: string;
    actorId: string;
    direction: 'CREDIT' | 'DEBIT';
    amount: number;
    reason: string;
    idempotencyKey: string;
  }) {
    await this.assertSuperAdmin(input.actorId);
    const key = `admin-adjustment:${createHash('sha256').update(input.idempotencyKey).digest('hex')}`;
    // 兼容修复前写入的短键；长键旧版会超过数据库长度，无法存在。
    const legacyKey =
      input.idempotencyKey.length <= 111 ? `admin-adjustment:${input.idempotencyKey}` : null;
    const existing =
      (await this.findAdjustment(key)) ?? (legacyKey ? await this.findAdjustment(legacyKey) : null);
    if (existing) return this.replayAdjustment(existing, input);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const account = await tx.aiQuotaAccount.findUnique({ where: { userId: input.userId } });
        if (!account)
          throw new DomainHttpException(
            HttpStatus.NOT_FOUND,
            'AI_QUOTA_ACCOUNT_NOT_FOUND',
            '用户额度账户不存在',
          );
        const amount = BigInt(input.amount);
        const updated = await tx.aiQuotaAccount.updateMany({
          where: {
            id: account.id,
            ...(input.direction === 'DEBIT' ? { availableAmount: { gte: amount } } : {}),
          },
          data: {
            availableAmount:
              input.direction === 'CREDIT' ? { increment: amount } : { decrement: amount },
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1)
          throw new DomainHttpException(
            HttpStatus.CONFLICT,
            'AI_QUOTA_INSUFFICIENT',
            '可用额度不足，整笔扣减未执行',
          );
        const next = await tx.aiQuotaAccount.findUniqueOrThrow({ where: { id: account.id } });
        const ledger = await tx.aiQuotaTransaction.create({
          data: {
            accountId: account.id,
            type: AiQuotaTransactionType.ADJUSTMENT,
            amount: input.direction === 'CREDIT' ? amount : -amount,
            availableBalanceAfter: next.availableAmount,
            reservedBalanceAfter: next.reservedAmount,
            source: 'admin.adjustment',
            idempotencyKey: key,
            detail: { actorId: input.actorId, reason: input.reason, direction: input.direction },
          },
        });
        return quotaAdjustmentResult(ledger);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const replay =
          (await this.findAdjustment(key)) ??
          (legacyKey ? await this.findAdjustment(legacyKey) : null);
        if (replay) return this.replayAdjustment(replay, input);
      }
      throw error;
    }
  }

  private findAdjustment(idempotencyKey: string) {
    return this.prisma.aiQuotaTransaction.findUnique({
      where: { idempotencyKey },
      include: { account: { select: { userId: true } } },
    });
  }

  /** 业务幂等键必须绑定原始调整参数，避免错误重放到其他用户或金额。 */
  private replayAdjustment(
    row: NonNullable<Awaited<ReturnType<AiQuotaService['findAdjustment']>>>,
    input: {
      userId: string;
      actorId: string;
      direction: 'CREDIT' | 'DEBIT';
      amount: number;
      reason: string;
    },
  ) {
    const detail =
      row.detail && typeof row.detail === 'object' && !Array.isArray(row.detail)
        ? (row.detail as Record<string, unknown>)
        : {};
    const expectedAmount = BigInt(input.direction === 'CREDIT' ? input.amount : -input.amount);
    if (
      row.type !== AiQuotaTransactionType.ADJUSTMENT ||
      row.source !== 'admin.adjustment' ||
      row.account.userId !== input.userId ||
      row.amount !== expectedAmount ||
      detail.actorId !== input.actorId ||
      detail.direction !== input.direction ||
      detail.reason !== input.reason
    ) {
      throw new DomainHttpException(
        HttpStatus.CONFLICT,
        'AI_QUOTA_ADJUSTMENT_KEY_REUSED',
        '额度调整幂等键已用于不同参数，请生成新的幂等键',
      );
    }
    return quotaAdjustmentResult(row);
  }

  async reserve(input: {
    userId: string;
    amount: bigint;
    requestId: string;
    messageId?: string;
    jobId?: string;
  }) {
    if (input.amount <= 0n) {
      throw new DomainHttpException(HttpStatus.BAD_REQUEST, 'AI_INVALID_RESERVE', '预占额度无效');
    }
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.aiQuotaAccount.findUnique({ where: { userId: input.userId } });
      if (!account) {
        throw new DomainHttpException(
          HttpStatus.CONFLICT,
          'AI_QUOTA_INSUFFICIENT',
          '额度账户不存在或余额不足',
        );
      }
      const updated = await tx.aiQuotaAccount.updateMany({
        where: {
          id: account.id,
          version: account.version,
          availableAmount: { gte: input.amount },
        },
        data: {
          availableAmount: { decrement: input.amount },
          reservedAmount: { increment: input.amount },
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new DomainHttpException(
          HttpStatus.CONFLICT,
          'AI_QUOTA_INSUFFICIENT',
          '额度不足，无法发起生成',
        );
      }
      const next = await tx.aiQuotaAccount.findUniqueOrThrow({ where: { id: account.id } });
      await tx.aiQuotaTransaction.create({
        data: {
          accountId: account.id,
          type: AiQuotaTransactionType.RESERVE,
          amount: input.amount,
          availableBalanceAfter: next.availableAmount,
          reservedBalanceAfter: next.reservedAmount,
          source: 'ai.reserve',
          requestId: input.requestId,
        },
      });
      return tx.aiQuotaReservation.create({
        data: {
          accountId: account.id,
          userId: input.userId,
          reservedAmount: input.amount,
          requestId: input.requestId,
          messageId: input.messageId,
          jobId: input.jobId,
          expiresAt: new Date(Date.now() + RESERVE_TTL_MS),
        },
      });
    });
  }

  async settle(reservationId: string, actual: bigint, requestId: string): Promise<boolean> {
    return this.prisma.$transaction((tx) =>
      this.settleInTransaction(tx, reservationId, actual, requestId),
    );
  }

  /** 长时间运行的流式/异步任务续租预占，终态记录不会被重新打开。 */
  async renew(reservationId: string): Promise<void> {
    await this.prisma.aiQuotaReservation.updateMany({
      where: { id: reservationId, status: AiReservationStatus.PENDING },
      data: { expiresAt: new Date(Date.now() + RESERVE_TTL_MS) },
    });
  }

  /** 在调用方事务内结算，保证额度状态和 usage 记录一起提交或回滚。 */
  async settleInTransaction(
    tx: Prisma.TransactionClient,
    reservationId: string,
    actual: bigint,
    requestId: string,
  ): Promise<boolean> {
    const actualAmount = actual < 0n ? 0n : actual;
    const reservation = await tx.aiQuotaReservation.findFirst({
      where: { id: reservationId, status: AiReservationStatus.PENDING },
    });
    if (!reservation) {
      const finalized = await tx.aiQuotaReservation.findUnique({ where: { id: reservationId } });
      // 到期补偿可能先完成相同金额的结算；此时调用方仍应报告已实扣。
      return (
        finalized?.status === AiReservationStatus.SETTLED &&
        finalized.settledAmount === actualAmount
      );
    }
    const claimed = await tx.aiQuotaReservation.updateMany({
      where: { id: reservationId, status: AiReservationStatus.PENDING },
      data: { status: AiReservationStatus.SETTLED, settledAmount: actualAmount },
    });
    if (claimed.count !== 1) {
      // 条件更新失败可能是补偿事务刚完成结算；再次确认终态，避免账本已扣但 usage 误报 0。
      const finalized = await tx.aiQuotaReservation.findUnique({ where: { id: reservationId } });
      return (
        finalized?.status === AiReservationStatus.SETTLED &&
        finalized.settledAmount === actualAmount
      );
    }
    const release =
      reservation.reservedAmount > actualAmount ? reservation.reservedAmount - actualAmount : 0n;
    const extra =
      actualAmount > reservation.reservedAmount ? actualAmount - reservation.reservedAmount : 0n;
    // 结算可能和新的预占/释放并发发生，账户字段必须使用原子增减，不能把旧快照重新写回。
    await tx.aiQuotaAccount.update({
      where: { id: reservation.accountId },
      data: {
        reservedAmount: { decrement: reservation.reservedAmount },
        availableAmount: { increment: release },
        version: { increment: 1 },
      },
    });
    if (extra > 0n) {
      const charged = await tx.aiQuotaAccount.updateMany({
        where: { id: reservation.accountId, availableAmount: { gte: extra } },
        data: {
          availableAmount: { decrement: extra },
          version: { increment: 1 },
        },
      });
      // 实际费用超出预占额度时，差额也必须成功扣除；否则不能写入已结算账本。
      // 抛错会让整个事务回滚，预占仍保持可补偿状态，避免账户与账本不一致。
      if (charged.count !== 1) {
        throw new DomainHttpException(
          HttpStatus.CONFLICT,
          'AI_QUOTA_INSUFFICIENT',
          '实际消耗超过可用额度，结算未完成',
        );
      }
    }
    const next = await tx.aiQuotaAccount.findUniqueOrThrow({
      where: { id: reservation.accountId },
    });
    await tx.aiQuotaTransaction.create({
      data: {
        accountId: reservation.accountId,
        type: AiQuotaTransactionType.SETTLE,
        amount: actualAmount,
        availableBalanceAfter: next.availableAmount,
        reservedBalanceAfter: next.reservedAmount,
        source: 'ai.settle',
        requestId,
      },
    });
    if (release > 0n) {
      await tx.aiQuotaTransaction.create({
        data: {
          accountId: reservation.accountId,
          type: AiQuotaTransactionType.RELEASE,
          amount: release,
          availableBalanceAfter: next.availableAmount,
          reservedBalanceAfter: next.reservedAmount,
          source: 'ai.settle.release',
          requestId,
        },
      });
    }
    return true;
  }

  async release(reservationId: string, requestId: string) {
    await this.prisma.$transaction(async (tx) => {
      const reservation = await tx.aiQuotaReservation.findFirst({
        where: { id: reservationId, status: AiReservationStatus.PENDING },
      });
      if (!reservation) {
        return;
      }
      const claimed = await tx.aiQuotaReservation.updateMany({
        where: { id: reservationId, status: AiReservationStatus.PENDING },
        data: { status: AiReservationStatus.RELEASED },
      });
      if (claimed.count !== 1) {
        return;
      }
      await tx.aiQuotaAccount.update({
        where: { id: reservation.accountId },
        data: {
          reservedAmount: { decrement: reservation.reservedAmount },
          availableAmount: { increment: reservation.reservedAmount },
          version: { increment: 1 },
        },
      });
      const next = await tx.aiQuotaAccount.findUniqueOrThrow({
        where: { id: reservation.accountId },
      });
      await tx.aiQuotaTransaction.create({
        data: {
          accountId: reservation.accountId,
          type: AiQuotaTransactionType.RELEASE,
          amount: reservation.reservedAmount,
          availableBalanceAfter: next.availableAmount,
          reservedBalanceAfter: next.reservedAmount,
          source: 'ai.release',
          requestId,
        },
      });
    });
  }

  async expireStale(): Promise<number> {
    const stale = await this.prisma.aiQuotaReservation.findMany({
      where: { status: AiReservationStatus.PENDING, expiresAt: { lte: new Date() } },
      take: 50,
      select: { id: true },
    });
    for (const row of stale) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const now = new Date();
          // 与生成终态使用同一行锁；拿到锁后再读取消息和任务状态。
          await tx.$queryRaw`SELECT id FROM ai_quota_reservations WHERE id = ${row.id}::uuid FOR UPDATE`;
          const current = await tx.aiQuotaReservation.findFirst({
            where: { id: row.id, status: AiReservationStatus.PENDING, expiresAt: { lte: now } },
            include: {
              jobs: { where: { status: { in: ['QUEUED', 'PROCESSING'] } }, take: 1 },
              messages: {
                where: {
                  role: AiMessageRole.ASSISTANT,
                  OR: [
                    { status: AiMessageStatus.DONE },
                    { status: AiMessageStatus.STOPPED, content: { not: '' } },
                  ],
                },
                take: 1,
              },
            },
          });
          if (!current) return;
          // 排队和运行中的任务仍持有预占；worker 恢复或终态会负责最终结算。
          if (current.jobs.length) {
            await tx.aiQuotaReservation.updateMany({
              where: { id: row.id, status: AiReservationStatus.PENDING, expiresAt: { lte: now } },
              data: { expiresAt: new Date(Date.now() + RESERVE_TTL_MS) },
            });
            return;
          }
          const successfulMessage = current.messages[0];
          if (successfulMessage) {
            const usage = await tx.aiUsageRecord.findFirst({
              where: { messageId: successfulMessage.id },
            });
            // 0 也可能是合法价格，不能因 usage 尚未写入而永久挂起预占。
            const actual =
              usage?.estimatedPlatformCost != null
                ? BigInt(usage.estimatedPlatformCost)
                : current.settledAmount;
            const settled = await this.settleInTransaction(
              tx,
              row.id,
              actual,
              current.requestId ?? row.id,
            );
            if (settled && usage) {
              await tx.aiUsageRecord.update({
                where: { id: usage.id },
                data: { platformCost: Number(actual) },
              });
            }
            return;
          }
          const claimed = await tx.aiQuotaReservation.updateMany({
            where: { id: row.id, status: AiReservationStatus.PENDING, expiresAt: { lte: now } },
            data: { status: AiReservationStatus.EXPIRED },
          });
          if (claimed.count !== 1) return;
          await tx.aiQuotaAccount.update({
            where: { id: current.accountId },
            data: {
              reservedAmount: { decrement: current.reservedAmount },
              availableAmount: { increment: current.reservedAmount },
              version: { increment: 1 },
            },
          });
          const account = await tx.aiQuotaAccount.findUniqueOrThrow({
            where: { id: current.accountId },
          });
          await tx.aiQuotaTransaction.create({
            data: {
              accountId: current.accountId,
              type: AiQuotaTransactionType.RELEASE,
              amount: current.reservedAmount,
              availableBalanceAfter: account.availableAmount,
              reservedBalanceAfter: account.reservedAmount,
              source: 'ai.expire',
              requestId: current.requestId ?? row.id,
            },
          });
        });
      } catch {
        // 结算资料不全或数据库冲突时维持预占，下一轮重试。
        await this.prisma.aiQuotaReservation.updateMany({
          where: {
            id: row.id,
            status: AiReservationStatus.PENDING,
            expiresAt: { lte: new Date() },
          },
          data: { expiresAt: new Date(Date.now() + RESERVE_TTL_MS) },
        });
      }
    }
    return stale.length;
  }
}

function quotaAdjustmentResult(row: {
  id: string;
  amount: bigint;
  availableBalanceAfter: bigint;
  reservedBalanceAfter: bigint;
}) {
  return {
    id: row.id,
    amount: Number(row.amount),
    availableAmount: Number(row.availableBalanceAfter),
    reservedAmount: Number(row.reservedBalanceAfter),
  };
}

export function estimateTextTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function platformCost(input: {
  inputTokens: number;
  outputTokens: number;
  inputPricePer1k: number;
  outputPricePer1k: number;
  fixedPlatformCost: number | null;
}): number {
  if (input.fixedPlatformCost != null) {
    return input.fixedPlatformCost;
  }
  return (
    Math.ceil((input.inputTokens / 1000) * input.inputPricePer1k) +
    Math.ceil((input.outputTokens / 1000) * input.outputPricePer1k)
  );
}
