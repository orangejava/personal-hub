import { HttpStatus, Injectable } from '@nestjs/common';
import { AiQuotaTransactionType, Prisma, RoleCode } from '@prisma/client';
import { DomainHttpException } from '../../common/errors/domain-http.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export function shanghaiDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function previousDate(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
}

@Injectable()
export class AiRewardService {
  constructor(private readonly prisma: PrismaService) {}

  async rules() {
    return this.prisma.aiRewardRule.findMany({ orderBy: { code: 'asc' } });
  }

  async patchRule(
    code: string,
    input: {
      amount?: number;
      bonusEvery?: number;
      bonusAmount?: number;
      label?: string;
      enabled?: boolean;
    },
    actorId: string,
  ) {
    const actor = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { role: { select: { code: true } } },
    });
    if (actor?.role.code !== RoleCode.SUPER_ADMIN) {
      throw new DomainHttpException(
        HttpStatus.FORBIDDEN,
        'AI_REWARD_RULE_FORBIDDEN',
        '仅超级管理员可修改奖励规则',
      );
    }
    const rule = await this.prisma.aiRewardRule.findUnique({ where: { code } });
    if (!rule)
      throw new DomainHttpException(
        HttpStatus.NOT_FOUND,
        'AI_REWARD_RULE_NOT_FOUND',
        '奖励规则不存在',
      );
    return this.prisma.aiRewardRule.update({ where: { code }, data: input });
  }

  /** 登录或 refresh 成功后调用。规则关闭或同日已发放时正常返回，不影响认证。 */
  async grantDailyLogin(userId: string, source: 'login' | 'refresh' = 'login') {
    const rule = await this.prisma.aiRewardRule.findUnique({ where: { code: 'DAILY_LOGIN' } });
    if (!rule?.enabled || rule.amount <= 0) return { granted: false, reason: 'RULE_DISABLED' };
    const date = shanghaiDate();
    const key = `daily-login:${userId}:${date}`;
    if (await this.prisma.aiQuotaTransaction.findUnique({ where: { idempotencyKey: key } })) {
      return { granted: false, reason: 'ALREADY_GRANTED' };
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        const account = await tx.aiQuotaAccount.upsert({
          where: { userId },
          create: { userId },
          update: {},
        });
        const next = await tx.aiQuotaAccount.update({
          where: { id: account.id },
          data: {
            availableAmount: { increment: BigInt(rule.amount) },
            version: { increment: 1 },
          },
        });
        await tx.aiQuotaTransaction.create({
          data: {
            accountId: account.id,
            type: AiQuotaTransactionType.GRANT,
            amount: BigInt(rule.amount),
            availableBalanceAfter: next.availableAmount,
            reservedBalanceAfter: next.reservedAmount,
            source: 'daily-login',
            idempotencyKey: key,
            detail: { localDate: date, ruleCode: rule.code, label: rule.label, source },
          },
        });
      });
      return { granted: true, amount: rule.amount, date };
    } catch (error) {
      if (isUnique(error)) return { granted: false, reason: 'ALREADY_GRANTED' };
      throw error;
    }
  }

  async calendar(userId: string, month: string) {
    const today = shanghaiDate();
    const [rule, records, latest, todayRecord] = await Promise.all([
      this.prisma.aiRewardRule.findUnique({ where: { code: 'CHECKIN' } }),
      this.prisma.aiCheckin.findMany({
        where: { userId, localDate: { startsWith: month } },
        orderBy: { localDate: 'asc' },
      }),
      this.prisma.aiCheckin.findFirst({ where: { userId }, orderBy: { localDate: 'desc' } }),
      this.prisma.aiCheckin.findUnique({
        where: { userId_localDate: { userId, localDate: today } },
      }),
    ]);
    return {
      today,
      todayClaimed: Boolean(todayRecord),
      // 零额度规则可用于暂停发放；按钮状态须与签到入口的执行条件一致。
      enabled: Boolean(rule?.enabled && rule.amount > 0),
      label: rule?.label ?? '签到',
      streak:
        latest && (latest.localDate === today || latest.localDate === previousDate(today))
          ? latest.streak
          : 0,
      records: records.map((row) => ({
        date: row.localDate,
        streak: row.streak,
        baseAmount: row.baseAmount,
        bonusAmount: row.bonusAmount,
        totalAmount: row.totalAmount,
      })),
    };
  }

  /** 唯一签到记录与唯一账本键处于同一事务，竞争失败的一方不会多加余额。 */
  async checkin(userId: string) {
    const rule = await this.prisma.aiRewardRule.findUnique({ where: { code: 'CHECKIN' } });
    if (!rule?.enabled || rule.amount <= 0) {
      throw new DomainHttpException(HttpStatus.CONFLICT, 'AI_CHECKIN_DISABLED', '签到规则未生效');
    }
    const date = shanghaiDate();
    const existing = await this.prisma.aiCheckin.findUnique({
      where: { userId_localDate: { userId, localDate: date } },
    });
    if (existing)
      return {
        claimed: false,
        reason: 'ALREADY_CLAIMED',
        date,
        streak: existing.streak,
        amount: existing.totalAmount,
      };
    try {
      return await this.prisma.$transaction(async (tx) => {
        const yesterday = await tx.aiCheckin.findUnique({
          where: { userId_localDate: { userId, localDate: previousDate(date) } },
        });
        const streak = (yesterday?.streak ?? 0) + 1;
        const bonusAmount =
          rule.bonusEvery > 0 && streak % rule.bonusEvery === 0 ? rule.bonusAmount : 0;
        const amount = rule.amount + bonusAmount;
        const record = await tx.aiCheckin.create({
          data: {
            userId,
            localDate: date,
            streak,
            baseAmount: rule.amount,
            bonusAmount,
            totalAmount: amount,
          },
        });
        const account = await tx.aiQuotaAccount.upsert({
          where: { userId },
          create: { userId },
          update: {},
        });
        const next = await tx.aiQuotaAccount.update({
          where: { id: account.id },
          data: {
            availableAmount: { increment: BigInt(amount) },
            version: { increment: 1 },
          },
        });
        await tx.aiQuotaTransaction.create({
          data: {
            accountId: account.id,
            type: AiQuotaTransactionType.GRANT,
            amount: BigInt(amount),
            availableBalanceAfter: next.availableAmount,
            reservedBalanceAfter: next.reservedAmount,
            source: 'checkin',
            idempotencyKey: `checkin:${userId}:${date}`,
            detail: {
              localDate: date,
              streak,
              baseAmount: rule.amount,
              bonusAmount,
              label: rule.label,
            },
          },
        });
        return { claimed: true, date, streak, amount, recordId: record.id };
      });
    } catch (error) {
      if (isUnique(error)) {
        const replay = await this.prisma.aiCheckin.findUnique({
          where: { userId_localDate: { userId, localDate: date } },
        });
        if (replay)
          return {
            claimed: false,
            reason: 'ALREADY_CLAIMED',
            date,
            streak: replay.streak,
            amount: replay.totalAmount,
          };
      }
      throw error;
    }
  }
}

function isUnique(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
