import { AiReservationStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AiQuotaService } from '../src/modules/ai/ai-quota.service';

function fixture() {
  const reservation = {
    id: 'reservation',
    accountId: 'account',
    requestId: 'request',
    status: AiReservationStatus.PENDING as AiReservationStatus,
    reservedAmount: 800n,
    settledAmount: 0n,
    expiresAt: new Date(Date.now() - 60_000),
    jobs: [] as Array<{ status: string }>,
    messages: [] as Array<{ id: string; content: string }>,
  };
  const account = { id: 'account', availableAmount: 200n, reservedAmount: 800n };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: reservation.id }]),
    aiQuotaReservation: {
      findFirst: vi.fn(async ({ where }: { where: { expiresAt?: { lte: Date } } }) =>
        reservation.status === AiReservationStatus.PENDING &&
        (!where.expiresAt || reservation.expiresAt <= where.expiresAt.lte)
          ? reservation
          : null,
      ),
      findUnique: vi.fn(async () => reservation),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { expiresAt?: { lte: Date } };
          data: Record<string, unknown>;
        }) => {
          if (
            reservation.status !== AiReservationStatus.PENDING ||
            (where.expiresAt && reservation.expiresAt > where.expiresAt.lte)
          )
            return { count: 0 };
          Object.assign(reservation, data);
          return { count: 1 };
        },
      ),
    },
    aiUsageRecord: { findFirst: vi.fn().mockResolvedValue(null) },
    aiQuotaAccount: {
      update: vi.fn(
        async ({
          data,
        }: {
          data: { reservedAmount: { decrement: bigint }; availableAmount: { increment: bigint } };
        }) => {
          account.reservedAmount -= data.reservedAmount.decrement;
          account.availableAmount += data.availableAmount.increment;
          return account;
        },
      ),
      findUniqueOrThrow: vi.fn(async () => account),
    },
    aiQuotaTransaction: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    ...tx,
    aiQuotaReservation: {
      ...tx.aiQuotaReservation,
      findMany: vi.fn(async () => [{ id: reservation.id }]),
    },
    $transaction: vi.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)),
  };
  return { service: new AiQuotaService(prisma as never), reservation, account, tx, prisma };
}

describe('AI 预占到期与结算', () => {
  it('读取过期快照后已续租，不释放新租约', async () => {
    const f = fixture();
    f.tx.aiQuotaReservation.findFirst.mockImplementationOnce(async () => {
      f.reservation.expiresAt = new Date(Date.now() + 300_000);
      return null;
    });
    await f.service.expireStale();
    expect(f.reservation.status).toBe(AiReservationStatus.PENDING);
    expect(f.tx.aiQuotaAccount.update).not.toHaveBeenCalled();
  });

  it('排队任务超过预占 TTL 时继续保留额度', async () => {
    const f = fixture();
    f.reservation.jobs.push({ status: 'QUEUED' });
    await f.service.expireStale();
    expect(f.reservation.status).toBe(AiReservationStatus.PENDING);
    expect(f.reservation.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(f.tx.aiQuotaAccount.update).not.toHaveBeenCalled();
  });

  it('成功消息的补偿先完成同金额结算时，原调用幂等成功', async () => {
    const f = fixture();
    f.reservation.status = AiReservationStatus.SETTLED;
    f.reservation.settledAmount = 800n;
    expect(await f.service.settle('reservation', 800n, 'request')).toBe(true);
    expect(f.tx.aiQuotaAccount.update).not.toHaveBeenCalled();
  });

  it('读取 PENDING 后补偿抢先结算，同金额仍视为成功', async () => {
    const f = fixture();
    f.tx.aiQuotaReservation.updateMany.mockImplementationOnce(async () => {
      f.reservation.status = AiReservationStatus.SETTLED;
      f.reservation.settledAmount = 120n;
      return { count: 0 };
    });
    expect(await f.service.settle('reservation', 120n, 'request')).toBe(true);
    expect(f.tx.aiQuotaAccount.update).not.toHaveBeenCalled();
  });

  it('读取 PENDING 后被不同金额结算，不误报本次实扣成功', async () => {
    const f = fixture();
    f.tx.aiQuotaReservation.updateMany.mockImplementationOnce(async () => {
      f.reservation.status = AiReservationStatus.SETTLED;
      f.reservation.settledAmount = 90n;
      return { count: 0 };
    });
    expect(await f.service.settle('reservation', 120n, 'request')).toBe(false);
  });

  it('无活跃任务的过期预占仅释放一次', async () => {
    const f = fixture();
    await f.service.expireStale();
    await f.service.expireStale();
    expect(f.reservation.status).toBe(AiReservationStatus.EXPIRED);
    expect(f.account).toMatchObject({ availableAmount: 1000n, reservedAmount: 0n });
    expect(f.tx.aiQuotaTransaction.create).toHaveBeenCalledTimes(1);
  });

  it('零价格成功回答缺少 usage 时仍能结算并归还预占', async () => {
    const f = fixture();
    f.reservation.messages.push({ id: 'answer', content: '已回答' });
    await f.service.expireStale();
    expect(f.reservation.status).toBe(AiReservationStatus.SETTLED);
    expect(f.reservation.settledAmount).toBe(0n);
    expect(f.account).toMatchObject({ availableAmount: 1000n, reservedAmount: 0n });
  });
});
