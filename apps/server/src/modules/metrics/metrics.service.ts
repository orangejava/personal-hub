import { HttpStatus, Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { DomainHttpException } from '../../common/errors/domain-http.exception';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { SystemService } from '../system/system.service';
import {
  DURATION_BUCKETS,
  bucketFor,
  httpField,
  minuteKey,
  parseHttpField,
  parseMinuteKey,
  parseVitalField,
  statusClassOf,
  vitalField,
} from './metrics-histogram';
import { parseVitalPayload } from './metrics-payload';
import { MetricsRedis } from './metrics.redis';
import { MetricsRepository } from './metrics.repository';
import {
  countsToHttpRows,
  countsToVitalRows,
  percentileOfHttp,
  percentileOfMetric,
  shapePublicHttp,
  shapePublicVitals,
  type StoredHttpRow,
  type StoredVitalRow,
} from './metrics-shape';

const COMPARE_MS = 7 * 24 * 60 * 60 * 1000;
const RATE_LIMIT = 60;
const RATE_WINDOW_SECONDS = 60;

export type MetricsRange = '24h' | '7d' | '30d';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    private readonly redis: MetricsRedis,
    private readonly counters: RedisService,
    private readonly repository: MetricsRepository,
    private readonly system: SystemService,
  ) {}

  async recordDeployFromEnv(gitSha: string | undefined): Promise<void> {
    if (!gitSha) return;
    await this.repository.recordDeploy(gitSha.slice(0, 64));
  }

  async sampleRate(): Promise<number> {
    const settings = await this.system.getMetricsSettings();
    return settings.sampleRate;
  }

  async acceptVitals(raw: unknown, ip: string): Promise<void> {
    await this.assertRateLimit(ip);
    let samples;
    try {
      samples = parseVitalPayload(raw);
    } catch (error) {
      const details = error instanceof ZodError ? error.issues : [];
      throw new DomainHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'METRICS_INVALID',
        '上报字段不正确',
        details,
      );
    }
    const key = minuteKey('vital', new Date());
    for (const sample of samples) {
      await this.redis.increment(key, vitalField(sample.route, sample.metric, sample.edge));
    }
  }

  async overview(range: MetricsRange) {
    const hours = range === '24h' ? 24 : range === '7d' ? 24 * 7 : 24 * 30;
    const now = new Date();
    const since = new Date(now.getTime() - hours * 60 * 60 * 1000);
    const settings = await this.system.getMetricsSettings();
    // 必须先读 Redis：若期间 worker 提交/删除，随后数据库快照的水位可剔除重复副本。
    let open: Awaited<ReturnType<MetricsRedis['readOpen']>> = [];
    let unavailable = false;
    try {
      open = await this.redis.readOpen(since);
    } catch (error) {
      unavailable = true;
      this.logger.warn(
        `读取 Redis 分钟桶失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const stored = await this.repository.readRange(since);
    const live = this.readLive(open, since, stored.closedBefore);
    const http = shapePublicHttp([...stored.http, ...live.http]);
    const vitals = shapePublicVitals([...stored.vitals, ...live.vitals]);
    const deploys = await this.repository.listDeploys(20);
    const latest = deploys[0];
    const compare = latest ? await this.compareAround(latest.deployedAt) : null;
    return {
      range,
      partial: unavailable || live.partial,
      sampleRate: settings.sampleRate,
      vitals,
      http,
      deploys: deploys.map((item) => ({
        gitSha: item.gitSha,
        deployedAt: item.deployedAt.toISOString(),
        note: item.note,
      })),
      compare: latest
        ? {
            marker: {
              gitSha: latest.gitSha,
              deployedAt: latest.deployedAt.toISOString(),
              note: latest.note,
            },
            before: compare?.before ?? { lcpP95: null, httpP95: null },
            after: compare?.after ?? { lcpP95: null, httpP95: null },
          }
        : null,
    };
  }

  private async assertRateLimit(ip: string): Promise<void> {
    const count = await this.counters.incrWithTtl(`metrics:rl:${ip}`, RATE_WINDOW_SECONDS);
    if (count > RATE_LIMIT) {
      throw new DomainHttpException(
        HttpStatus.TOO_MANY_REQUESTS,
        'METRICS_RATE_LIMITED',
        '上报过于频繁',
        [],
        {
          retryAfterSeconds: RATE_WINDOW_SECONDS,
        },
      );
    }
  }

  private readLive(
    open: Awaited<ReturnType<MetricsRedis['readOpen']>>,
    since: Date,
    closedBefore: Date,
  ): { http: StoredHttpRow[]; vitals: StoredVitalRow[]; partial: boolean } {
    const httpCounts = [];
    const vitalCounts = [];
    for (const bucket of open) {
      const parsed = parseMinuteKey(bucket.key);
      if (!parsed || parsed.at < since || parsed.at < closedBefore) continue;
      for (const [field, count] of Object.entries(bucket.counts)) {
        if (parsed.kind === 'http') {
          const row = parseHttpField(field, count);
          if (row) httpCounts.push(row);
        } else {
          const row = parseVitalField(field, count);
          if (row) vitalCounts.push(row);
        }
      }
    }
    return {
      http: countsToHttpRows(httpCounts),
      vitals: countsToVitalRows(vitalCounts),
      partial: httpCounts.length > 0 || vitalCounts.length > 0,
    };
  }

  private async compareAround(deployedAt: Date) {
    const beforeStart = new Date(deployedAt.getTime() - COMPARE_MS);
    const afterEnd = new Date(deployedAt.getTime() + COMPARE_MS);
    const [before, after] = await Promise.all([
      this.repository.readRange(beforeStart, deployedAt),
      this.repository.readRange(deployedAt, afterEnd),
    ]);
    return {
      before: {
        lcpP95: percentileOfMetric(before.vitals, 'LCP', 0.95),
        httpP95: percentileOfHttp(before.http, 0.95),
      },
      after: {
        lcpP95: percentileOfMetric(after.vitals, 'LCP', 0.95),
        httpP95: percentileOfHttp(after.http, 0.95),
      },
    };
  }
}

@Injectable()
export class MetricsTimingMiddleware implements NestMiddleware {
  constructor(private readonly redis: MetricsRedis) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const started = process.hrtime.bigint();
    response.on('finish', () => {
      const path = (request.originalUrl ?? request.path).split('?')[0] ?? '';
      if (path.startsWith('/api/v1/health') || path.startsWith('/api/v1/metrics')) return;
      const route = request.route as { path?: string } | undefined;
      if (!route?.path) return;
      const suffix = route.path === '/' ? '' : route.path;
      const template = `${request.baseUrl ?? ''}${suffix}` || path;
      const duration = Number(process.hrtime.bigint() - started) / 1_000_000;
      const edge = bucketFor(duration, DURATION_BUCKETS);
      const field = httpField(request.method, template, statusClassOf(response.statusCode), edge);
      void this.redis.increment(minuteKey('http', new Date()), field).catch(() => undefined);
    });
    next();
  }
}
