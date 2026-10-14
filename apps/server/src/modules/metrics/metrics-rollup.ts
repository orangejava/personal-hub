import { Injectable, Logger } from '@nestjs/common';
import { SystemService } from '../system/system.service';
import {
  hourRetentionStart,
  hourStart,
  parseHttpField,
  parseMinuteKey,
  parseVitalField,
} from './metrics-histogram';
import { MetricsRedis } from './metrics.redis';
import { MetricsRepository, type HourHttpWrite, type HourVitalWrite } from './metrics.repository';
const RETRY_MS = 5 * 60 * 1000;

/**
 * 把已经结束的分钟桶收成小时行，再收成日行。当前这一小时留在 Redis。
 */
@Injectable()
export class MetricsRollup {
  private readonly logger = new Logger(MetricsRollup.name);
  private timer: NodeJS.Timeout | null = null;
  private lastMaintenanceHour: number | null = null;

  constructor(
    private readonly redis: MetricsRedis,
    private readonly repository: MetricsRepository,
    private readonly system: SystemService,
  ) {}

  start(): void {
    if (this.timer) return;
    void this.run().catch((error: unknown) => {
      this.logger.warn(`性能汇总失败: ${error instanceof Error ? error.message : String(error)}`);
    });
    this.timer = setInterval(() => {
      void this.run().catch((error: unknown) => {
        this.logger.warn(`性能汇总失败: ${error instanceof Error ? error.message : String(error)}`);
      });
    }, RETRY_MS);
  }

  async run(now = new Date()): Promise<void> {
    const lockKey = 'metrics:rollup-lock';
    const token = await this.redis.tryLock(lockKey, 10 * 60);
    if (!token) return;
    try {
      const currentHour = hourStart(now).getTime();
      const open = await this.redis.readOpen(undefined, new Date(currentHour));
      const httpGroups = new Map<string, HourHttpWrite>();
      const vitalGroups = new Map<string, HourVitalWrite>();
      const finishedKeys: string[] = [];

      for (const bucket of open) {
        const parsed = parseMinuteKey(bucket.key);
        if (!parsed || hourStart(parsed.at).getTime() >= currentHour) continue;
        finishedKeys.push(bucket.key);
        const start = hourStart(parsed.at);
        for (const [field, count] of Object.entries(bucket.counts)) {
          if (parsed.kind === 'http') {
            const row = parseHttpField(field, count);
            if (!row) continue;
            const key = `${start.toISOString()}\u001f${row.method}\u001f${row.template}\u001f${row.statusClass}`;
            const current = httpGroups.get(key) ?? {
              bucketStart: start,
              method: row.method,
              template: row.template,
              statusClass: row.statusClass,
              histogram: {},
            };
            current.histogram = {
              ...current.histogram,
              [String(row.edge)]: (current.histogram[String(row.edge)] ?? 0) + row.count,
            };
            httpGroups.set(key, current);
          } else {
            const row = parseVitalField(field, count);
            if (!row) continue;
            const key = `${start.toISOString()}\u001f${row.template}\u001f${row.metric}`;
            const current = vitalGroups.get(key) ?? {
              bucketStart: start,
              template: row.template,
              metric: row.metric,
              histogram: {},
            };
            current.histogram = {
              ...current.histogram,
              [String(row.edge)]: (current.histogram[String(row.edge)] ?? 0) + row.count,
            };
            vitalGroups.set(key, current);
          }
        }
      }

      // 按时间先后提交，水位以前的小时即使残留 Redis 也不会再次累计。
      const hours = [
        ...new Set([
          ...[...httpGroups.values()].map((row) => row.bucketStart.getTime()),
          ...[...vitalGroups.values()].map((row) => row.bucketStart.getTime()),
        ]),
      ].sort((left, right) => left - right);
      for (const hour of hours) {
        await this.repository.commitHour(
          new Date(hour),
          [...httpGroups.values()].filter((row) => row.bucketStart.getTime() === hour),
          [...vitalGroups.values()].filter((row) => row.bucketStart.getTime() === hour),
        );
      }
      await this.redis.drop(finishedKeys);
      if (this.lastMaintenanceHour !== currentHour) {
        const settings = await this.system.getMetricsSettings();
        await this.repository.pruneHours(hourRetentionStart(now, settings.hourRetentionDays));
        this.lastMaintenanceHour = currentHour;
      }
    } finally {
      await this.redis.releaseLock(lockKey, token);
    }
  }
}
