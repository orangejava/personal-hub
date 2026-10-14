import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { asHistogram, dayStart, mergeHistograms } from './metrics-histogram';
import type { StoredHttpRow, StoredVitalRow } from './metrics-shape';

export interface HourHttpWrite {
  bucketStart: Date;
  method: string;
  template: string;
  statusClass: string;
  histogram: Record<string, number>;
}

export interface HourVitalWrite {
  bucketStart: Date;
  template: string;
  metric: string;
  histogram: Record<string, number>;
}

export interface DayHttpWrite extends Omit<HourHttpWrite, 'bucketStart'> {
  bucketDate: Date;
}

export interface DayVitalWrite extends Omit<HourVitalWrite, 'bucketStart'> {
  bucketDate: Date;
}

@Injectable()
export class MetricsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 每个小时在同一事务中写小时、日和完成边界。
   * 数据库行锁才是幂等保证：即使 Redis 租约超时，第二个 worker 也不会再次累加日行。
   */
  async commitHour(
    bucketStart: Date,
    http: HourHttpWrite[],
    vitals: HourVitalWrite[],
  ): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        const [state] = await tx.$queryRaw<Array<{ closed_before: Date }>>`
        SELECT closed_before FROM metric_rollup_state WHERE id = 1 FOR UPDATE`;
        if (!state) throw new Error('性能汇总进度不存在，请先执行 migration');
        if (bucketStart < state.closed_before) return;
        const bucketDate = dayStart(bucketStart);
        for (const row of http) {
          await this.upsertHttpHour(row, tx);
          const existing = await tx.metricHttpDay.findUnique({
            where: {
              bucketDate_method_routeTemplate_statusClass: {
                bucketDate,
                method: row.method,
                routeTemplate: row.template,
                statusClass: row.statusClass,
              },
            },
          });
          await this.upsertHttpDay(
            {
              ...row,
              bucketDate,
              histogram: mergeHistograms([asHistogram(existing?.histogram), row.histogram]),
            },
            tx,
          );
        }
        for (const row of vitals) {
          await this.upsertVitalHour(row, tx);
          const existing = await tx.metricVitalDay.findUnique({
            where: {
              bucketDate_routeTemplate_metric: {
                bucketDate,
                routeTemplate: row.template,
                metric: row.metric,
              },
            },
          });
          await this.upsertVitalDay(
            {
              ...row,
              bucketDate,
              histogram: mergeHistograms([asHistogram(existing?.histogram), row.histogram]),
            },
            tx,
          );
        }
        await tx.metricRollupState.update({
          where: { id: 1 },
          data: {
            closedBefore: new Date(bucketStart.getTime() + 60 * 60 * 1000),
          },
        });
      },
      { timeout: 60_000 },
    );
  }

  /** 只删已成功归入日表的小时；实际清理边界只前进，不随管理员增大保留天数而倒退。 */
  async pruneHours(cutoff: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const [state] = await tx.$queryRaw<Array<{ closed_before: Date; hours_since: Date }>>`
        SELECT closed_before, hours_since FROM metric_rollup_state WHERE id = 1 FOR UPDATE`;
      if (!state) throw new Error('性能汇总进度不存在，请先执行 migration');
      const before = new Date(Math.min(cutoff.getTime(), dayStart(state.closed_before).getTime()));
      if (before <= state.hours_since) return;
      await tx.metricHttpHour.deleteMany({ where: { bucketStart: { lt: before } } });
      await tx.metricVitalHour.deleteMany({ where: { bucketStart: { lt: before } } });
      await tx.metricRollupState.update({ where: { id: 1 }, data: { hoursSince: before } });
    });
  }

  /**
   * 在一致的数据库快照中读取水位、日表和小时表，避免碰上清理时漏数。
   * 调用方必须先读取 Redis，再读此快照；快照水位以前的 Redis 副本一律排除。
   */
  async readRange(start: Date, end?: Date) {
    return this.prisma.$transaction(
      async (tx) => {
        const state = await tx.metricRollupState.findUniqueOrThrow({ where: { id: 1 } });
        const since = new Date(Math.max(start.getTime(), state.hoursSince.getTime()));
        const dayEnd = end && end < state.hoursSince ? dayStart(end) : state.hoursSince;
        const [httpHours, vitalHours, httpDays, vitalDays] = await Promise.all([
          tx.metricHttpHour.findMany({ where: { bucketStart: { gte: since, lt: end } } }),
          tx.metricVitalHour.findMany({ where: { bucketStart: { gte: since, lt: end } } }),
          start < dayEnd
            ? tx.metricHttpDay.findMany({
                where: { bucketDate: { gte: dayStart(start), lt: dayEnd } },
              })
            : [],
          start < dayEnd
            ? tx.metricVitalDay.findMany({
                where: { bucketDate: { gte: dayStart(start), lt: dayEnd } },
              })
            : [],
        ]);
        return {
          closedBefore: state.closedBefore,
          http: [...httpDays, ...httpHours].map((row): StoredHttpRow => ({
            method: row.method,
            template: row.routeTemplate,
            statusClass: row.statusClass,
            histogram: asHistogram(row.histogram),
          })),
          vitals: [...vitalDays, ...vitalHours].map((row): StoredVitalRow => ({
            template: row.routeTemplate,
            metric: row.metric,
            histogram: asHistogram(row.histogram),
          })),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private async upsertHttpHour(row: HourHttpWrite, tx: Prisma.TransactionClient): Promise<void> {
    await tx.metricHttpHour.upsert({
      where: {
        bucketStart_method_routeTemplate_statusClass: {
          bucketStart: row.bucketStart,
          method: row.method,
          routeTemplate: row.template,
          statusClass: row.statusClass,
        },
      },
      create: {
        bucketStart: row.bucketStart,
        method: row.method,
        routeTemplate: row.template,
        statusClass: row.statusClass,
        histogram: row.histogram as Prisma.InputJsonValue,
        count: total(row.histogram),
      },
      update: {
        histogram: row.histogram as Prisma.InputJsonValue,
        count: total(row.histogram),
      },
    });
  }

  private async upsertVitalHour(row: HourVitalWrite, tx: Prisma.TransactionClient): Promise<void> {
    await tx.metricVitalHour.upsert({
      where: {
        bucketStart_routeTemplate_metric: {
          bucketStart: row.bucketStart,
          routeTemplate: row.template,
          metric: row.metric,
        },
      },
      create: {
        bucketStart: row.bucketStart,
        routeTemplate: row.template,
        metric: row.metric,
        histogram: row.histogram as Prisma.InputJsonValue,
        count: total(row.histogram),
      },
      update: {
        histogram: row.histogram as Prisma.InputJsonValue,
        count: total(row.histogram),
      },
    });
  }

  private async upsertHttpDay(row: DayHttpWrite, tx: Prisma.TransactionClient): Promise<void> {
    await tx.metricHttpDay.upsert({
      where: {
        bucketDate_method_routeTemplate_statusClass: {
          bucketDate: row.bucketDate,
          method: row.method,
          routeTemplate: row.template,
          statusClass: row.statusClass,
        },
      },
      create: {
        bucketDate: row.bucketDate,
        method: row.method,
        routeTemplate: row.template,
        statusClass: row.statusClass,
        histogram: row.histogram as Prisma.InputJsonValue,
        count: total(row.histogram),
      },
      update: {
        histogram: row.histogram as Prisma.InputJsonValue,
        count: total(row.histogram),
      },
    });
  }

  private async upsertVitalDay(row: DayVitalWrite, tx: Prisma.TransactionClient): Promise<void> {
    await tx.metricVitalDay.upsert({
      where: {
        bucketDate_routeTemplate_metric: {
          bucketDate: row.bucketDate,
          routeTemplate: row.template,
          metric: row.metric,
        },
      },
      create: {
        bucketDate: row.bucketDate,
        routeTemplate: row.template,
        metric: row.metric,
        histogram: row.histogram as Prisma.InputJsonValue,
        count: total(row.histogram),
      },
      update: {
        histogram: row.histogram as Prisma.InputJsonValue,
        count: total(row.histogram),
      },
    });
  }

  async listDeploys(limit: number) {
    return this.prisma.deployMarker.findMany({ orderBy: { deployedAt: 'desc' }, take: limit });
  }

  /**
   * 同一个提交号只记一次。已有备注留着，避免重启把人工备注清掉。
   */
  async recordDeploy(gitSha: string): Promise<void> {
    await this.prisma.deployMarker.upsert({
      where: { gitSha },
      create: { gitSha },
      update: {},
    });
  }
}

function total(histogram: Record<string, number>): number {
  return Object.values(histogram).reduce((sum, count) => sum + count, 0);
}
