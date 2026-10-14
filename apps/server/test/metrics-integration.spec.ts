import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GenericContainer } from 'testcontainers';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { MetricsRepository } from '../src/modules/metrics/metrics.repository';
import { MetricsRollup } from '../src/modules/metrics/metrics-rollup';
import { MetricsService } from '../src/modules/metrics/metrics.service';
import { minuteKey } from '../src/modules/metrics/metrics-histogram';
import type { MetricsRedis } from '../src/modules/metrics/metrics.redis';
import type { SystemService } from '../src/modules/system/system.service';
import type { RedisService } from '../src/infrastructure/redis/redis.service';

const now = new Date('2026-10-14T12:00:00Z');
const oldHour = new Date('2026-10-12T23:00:00Z');
const freshHour = new Date('2026-10-14T10:00:00Z');
const row = (bucketStart: Date, count = 3) => ({
  bucketStart,
  template: '/',
  metric: 'LCP',
  histogram: { '2000': count },
});

describe('性能汇总 PostgreSQL 事务', () => {
  let prisma: PrismaService;
  let repository: MetricsRepository;
  let stop: (() => Promise<unknown>) | undefined;

  beforeAll(async () => {
    const postgres = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({
        POSTGRES_DB: 'metrics_test',
        POSTGRES_USER: 'metrics_test',
        POSTGRES_PASSWORD: 'metrics_test',
      })
      .withExposedPorts(5432)
      .start();
    stop = () => postgres.stop();
    const url = `postgresql://metrics_test:metrics_test@${postgres.getHost()}:${postgres.getMappedPort(5432)}/metrics_test`;
    // 直接用当前 Node 执行 Prisma，测试不需要 pnpm 联网切换版本。
    execFileSync(
      process.execPath,
      [resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
      {
        cwd: resolve(__dirname, '..'),
        env: { ...process.env, DATABASE_URL: url },
        stdio: 'pipe',
      },
    );
    prisma = new PrismaService({ datasources: { db: { url } } });
    repository = new MetricsRepository(prisma);
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await stop?.();
  });
  beforeEach(async () => {
    await prisma.metricHttpHour.deleteMany();
    await prisma.metricVitalHour.deleteMany();
    await prisma.metricHttpDay.deleteMany();
    await prisma.metricVitalDay.deleteMany();
    await prisma.metricRollupState.update({
      where: { id: 1 },
      data: { closedBefore: new Date(0), hoursSince: new Date(0) },
    });
  });

  it('升级已有小时数据时回填日行和进度，并保留更早的日历史', async () => {
    await prisma.metricVitalHour.createMany({
      data: [
        {
          bucketStart: oldHour,
          routeTemplate: '/',
          metric: 'LCP',
          histogram: { '2000': 3 },
          count: 3,
        },
        {
          bucketStart: new Date(oldHour.getTime() - 3_600_000),
          routeTemplate: '/',
          metric: 'LCP',
          histogram: { '5000': 2 },
          count: 2,
        },
      ],
    });
    await prisma.metricVitalDay.createMany({
      data: [
        {
          bucketDate: new Date('2026-10-12T00:00:00Z'),
          routeTemplate: '/',
          metric: 'LCP',
          histogram: { '2000': 1 },
          count: 1,
        },
        {
          bucketDate: new Date('2026-10-01T00:00:00Z'),
          routeTemplate: '/',
          metric: 'LCP',
          histogram: { '2000': 7 },
          count: 7,
        },
      ],
    });
    // 只在独立测试库中重建进度表，复现上一版已有数据的迁移入口。
    await prisma.$executeRawUnsafe('DROP TABLE metric_rollup_state');
    const sql = readFileSync(
      resolve(__dirname, '../prisma/migrations/20261014120000_metrics_checkpoint/migration.sql'),
      'utf8',
    );
    for (const statement of sql.split(';').filter((part) => part.trim())) {
      await prisma.$executeRawUnsafe(statement);
    }
    const state = await prisma.metricRollupState.findUniqueOrThrow({ where: { id: 1 } });
    expect(state.closedBefore).toEqual(new Date('2026-10-13T00:00:00Z'));
    expect(state.hoursSince).toEqual(new Date('2026-10-12T00:00:00Z'));
    const days = await prisma.metricVitalDay.findMany({ orderBy: { bucketDate: 'asc' } });
    expect(days.map((day) => day.count)).toEqual([7, 5]);
    expect(days[1].histogram).toEqual({ '2000': 3, '5000': 2 });
    const history = await repository.readRange(new Date('2026-10-01T00:00:00Z'));
    expect(
      history.vitals.reduce(
        (sum, item) => sum + Object.values(item.histogram).reduce((n, count) => n + count, 0),
        0,
      ),
    ).toBe(12);
  });

  it('停机补跑 37 小时前的数据，1 天保留期清理后日表仍保留全部样本', async () => {
    const redis = {
      tryLock: vi.fn().mockResolvedValue('token'),
      releaseLock: vi.fn(),
      drop: vi.fn(),
      readOpen: vi.fn().mockResolvedValue([
        { key: minuteKey('vital', freshHour), counts: { ['/\u001fLCP\u001f2000']: 2 } },
        { key: minuteKey('vital', oldHour), counts: { ['/\u001fLCP\u001f2000']: 3 } },
      ]),
    } as unknown as MetricsRedis;
    const system = {
      getMetricsSettings: vi.fn().mockResolvedValue({ hourRetentionDays: 1 }),
    } as unknown as SystemService;
    await new MetricsRollup(redis, repository, system).run(now);
    expect(await prisma.metricVitalHour.count()).toBe(1);
    expect((await prisma.metricVitalDay.findMany()).reduce((sum, day) => sum + day.count, 0)).toBe(
      5,
    );
    // 管理员延长保留期，已清理的小时不会重生，仍需使用日行。
    await repository.pruneHours(new Date('2026-07-16T00:00:00Z'));
    const result = await repository.readRange(new Date('2026-10-07T00:00:00Z'));
    expect(result.vitals.reduce((sum, item) => sum + item.histogram['2000'], 0)).toBe(5);
  });

  it('同一小时并发提交与 Redis 删除失败重试，都不会重复累计日行', async () => {
    await Promise.all([
      repository.commitHour(oldHour, [], [row(oldHour)]),
      repository.commitHour(oldHour, [], [row(oldHour)]),
    ]);
    await repository.commitHour(oldHour, [], [row(oldHour)]);
    expect(await prisma.metricVitalHour.count()).toBe(1);
    expect((await prisma.metricVitalDay.findFirstOrThrow()).count).toBe(3);
  });

  it('半途写库失败会回滚小时、日表和水位，重试后完整提交', async () => {
    await expect(
      repository.commitHour(
        oldHour,
        [],
        [row(oldHour), { ...row(oldHour), template: 'x'.repeat(201) }],
      ),
    ).rejects.toThrow();
    expect(await prisma.metricVitalHour.count()).toBe(0);
    expect(await prisma.metricVitalDay.count()).toBe(0);
    expect(
      (await prisma.metricRollupState.findUniqueOrThrow({ where: { id: 1 } })).closedBefore,
    ).toEqual(new Date(0));
    await repository.commitHour(oldHour, [], [row(oldHour)]);
    expect((await prisma.metricVitalDay.findFirstOrThrow()).count).toBe(3);
  });

  it('先读取 Redis 时恰逢 worker 提交，随后概览仍只计算一次', async () => {
    const current = new Date(Date.now() - 2 * 60 * 60 * 1000);
    current.setUTCMinutes(0, 0, 0);
    const redis = {
      readOpen: vi.fn(async () => {
        await repository.commitHour(current, [], [row(current)]);
        return [{ key: minuteKey('vital', current), counts: { ['/\u001fLCP\u001f2000']: 3 } }];
      }),
    } as unknown as MetricsRedis;
    const system = {
      getMetricsSettings: vi.fn().mockResolvedValue({ sampleRate: 0.2, hourRetentionDays: 90 }),
    } as unknown as SystemService;
    const result = await new MetricsService(redis, {} as RedisService, repository, system).overview(
      '24h',
    );
    expect(result.vitals[0].count).toBe(3);
  });
});
