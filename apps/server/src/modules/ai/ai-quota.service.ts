import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AiQuotaTransactionType,
  AiReservationStatus,
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

  async settle(reservationId: string, actual: bigint, requestId: string) {
    await this.prisma.$transaction((tx) =>
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
  ) {
    const actualAmount = actual < 0n ? 0n : actual;
    const reservation = await tx.aiQuotaReservation.findFirst({
      where: { id: reservationId, status: AiReservationStatus.PENDING },
    });
    if (!reservation) {
      return;
    }
    const claimed = await tx.aiQuotaReservation.updateMany({
      where: { id: reservationId, status: AiReservationStatus.PENDING },
      data: { status: AiReservationStatus.SETTLED, settledAmount: actualAmount },
    });
    if (claimed.count !== 1) {
      return;
    }
    const release =
      reservation.reservedAmount > actualAmount ? reservation.reservedAmount - actualAmount : 0n;
    const extra = actualAmount > reservation.reservedAmount ? actualAmount - reservation.reservedAmount : 0n;
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
      await tx.aiQuotaAccount.updateMany({
        where: { id: reservation.accountId, availableAmount: { gte: extra } },
        data: {
          availableAmount: { decrement: extra },
          version: { increment: 1 },
        },
      });
    }
    const next = await tx.aiQuotaAccount.findUniqueOrThrow({ where: { id: reservation.accountId } });
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
    });
    for (const row of stale) {
      await this.release(row.id, row.requestId ?? row.id);
      await this.prisma.aiQuotaReservation.updateMany({
        where: { id: row.id, status: AiReservationStatus.RELEASED },
        data: { status: AiReservationStatus.EXPIRED },
      });
    }
    return stale.length;
  }
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
