import { describe, expect, it, vi } from 'vitest';
import {
  bucketFor,
  CLS_BUCKETS,
  DURATION_BUCKETS,
  METRICS_KEY_TTL_SECONDS,
  closedMinuteKeys,
  dayStart,
  hourRetentionStart,
  hourStart,
  minuteKey,
  parseMinuteKey,
  percentileFromHistogram,
} from '../src/modules/metrics/metrics-histogram';
import {
  parseVitalPayload,
  REPORTABLE_PAGE_TEMPLATES,
} from '../src/modules/metrics/metrics-payload';
import { PERF_PAGES } from '../../user-web/src/config/pageRegistry';
import { MetricsRollup } from '../src/modules/metrics/metrics-rollup';
import { MetricsService } from '../src/modules/metrics/metrics.service';
import type { MetricsRedis } from '../src/modules/metrics/metrics.redis';
import type { MetricsRepository } from '../src/modules/metrics/metrics.repository';
import type { RedisService } from '../src/infrastructure/redis/redis.service';
import type { SystemService } from '../src/modules/system/system.service';
import {
  publicHttpLabel,
  shapePublicHttp,
  shapePublicVitals,
} from '../src/modules/metrics/metrics-shape';

describe('性能直方图', () => {
  it('耗时落到不超过自己的那一档', () => {
    expect(bucketFor(12, DURATION_BUCKETS)).toBe(25);
    expect(bucketFor(5000, DURATION_BUCKETS)).toBe(5000);
    expect(bucketFor(9000, DURATION_BUCKETS)).toBe(120_000);
    expect(METRICS_KEY_TTL_SECONDS).toBe(48 * 60 * 60);
    expect(bucketFor(0.02, CLS_BUCKETS)).toBe(0.05);
  });

  it('p95 取累计次数跨过 95% 的上界', () => {
    expect(percentileFromHistogram({ '100': 95, '500': 5 }, 0.95)).toBe(100);
    expect(percentileFromHistogram({ '100': 90, '500': 10 }, 0.95)).toBe(500);
    expect(percentileFromHistogram({}, 0.95)).toBeNull();
  });

  it('分钟桶用 UTC，当前小时内的桶不收口', () => {
    const at = new Date(Date.UTC(2026, 9, 11, 12, 7));
    const key = minuteKey('http', at);
    expect(parseMinuteKey(key)?.at.toISOString()).toBe(at.toISOString());
    expect(
      closedMinuteKeys(
        [key, minuteKey('vital', new Date(Date.UTC(2026, 9, 11, 11, 59)))],
        hourStart(at),
      ),
    ).toEqual([minuteKey('vital', new Date(Date.UTC(2026, 9, 11, 11, 59)))]);
  });

  it('保留起点按天对齐，同一天上午连续两次不会丢掉边界日的凌晨小时', () => {
    const retentionDays = 90;
    const morning = new Date(Date.UTC(2026, 9, 13, 2, 0));
    const later = new Date(Date.UTC(2026, 9, 13, 3, 0));
    const cutoff = hourRetentionStart(morning, retentionDays);
    expect(hourRetentionStart(later, retentionDays).toISOString()).toBe(cutoff.toISOString());
    expect(cutoff.toISOString()).toBe(dayStart(cutoff).toISOString());

    const hours = Array.from({ length: 24 }, (_, hour) => ({
      at: new Date(cutoff.getTime() + hour * 60 * 60 * 1000),
      count: 1,
    }));
    const keptAfterMorning = hours.filter((hour) => hour.at.getTime() >= cutoff.getTime());
    const keptAfterLater = keptAfterMorning.filter(
      (hour) => hour.at.getTime() >= hourRetentionStart(later, retentionDays).getTime(),
    );
    expect(keptAfterLater).toHaveLength(24);

    const exactCutoff = new Date(later.getTime() - retentionDays * 24 * 60 * 60 * 1000);
    const keptByExactClock = hours.filter((hour) => hour.at.getTime() >= exactCutoff.getTime());
    expect(keptByExactClock.length).toBeLessThan(24);
  });
});

describe('性能公开结果', () => {
  it('匿名上报白名单与前端页面清单同步', () => {
    expect([...REPORTABLE_PAGE_TEMPLATES].sort()).toEqual(
      PERF_PAGES.map((page) => page.template).sort(),
    );
  });
  it('管理路径不出现，认证路径收成一组', () => {
    expect(publicHttpLabel('/api/v1/admin/users')).toBeNull();
    expect(publicHttpLabel('/api/v1/auth/login')).toBe('认证');
    const rows = shapePublicHttp([
      {
        method: 'POST',
        template: '/api/v1/auth/login',
        statusClass: '2xx',
        histogram: { '100': 1 },
      },
      {
        method: 'POST',
        template: '/api/v1/auth/refresh',
        statusClass: '2xx',
        histogram: { '200': 1 },
      },
      {
        method: 'GET',
        template: '/api/v1/admin/users',
        statusClass: '2xx',
        histogram: { '50': 4 },
      },
      {
        method: 'GET',
        template: '/api/v1/public/site-config',
        statusClass: '2xx',
        histogram: { '25': 2 },
      },
    ]);
    expect(rows.map((row) => row.label).sort()).toEqual(['/api/v1/public/site-config', '认证']);
    expect(rows.find((row) => row.label === '认证')?.count).toBe(2);
  });

  it('同一页面同一指标的多个小时合成一行', () => {
    const rows = shapePublicVitals([
      { template: '/', metric: 'LCP', histogram: { '2000': 1 } },
      { template: '/', metric: 'LCP', histogram: { '5000': 1 } },
      { template: '/content', metric: 'LCP', histogram: { '1200': 2 } },
    ]);
    const home = rows.filter((row) => row.route === '/' && row.metric === 'LCP');
    expect(home).toHaveLength(1);
    expect(home[0]?.count).toBe(2);
    expect(home[0]?.p50).toBe(2000);
    expect(home[0]?.p95).toBe(5000);
    expect(rows.find((row) => row.route === '/content')?.count).toBe(2);
  });

  it('拒绝完整地址和超范围指标', () => {
    expect(() =>
      parseVitalPayload({ route: 'https://example.com/', samples: [{ metric: 'LCP', value: 1 }] }),
    ).toThrow();
    expect(() =>
      parseVitalPayload({ route: '/content/:id', samples: [{ metric: 'LCP', value: 999999 }] }),
    ).toThrow();
    expect(() =>
      parseVitalPayload({ route: '/random-xyz', samples: [{ metric: 'LCP', value: 100 }] }),
    ).toThrow();
    expect(
      parseVitalPayload({
        route: '/content/:id',
        samples: [
          { metric: 'LCP', value: 1800 },
          { metric: 'CLS', value: 0.02 },
        ],
      }),
    ).toEqual([
      { route: '/content/:id', metric: 'LCP', edge: 2000 },
      { route: '/content/:id', metric: 'CLS', edge: 0.05 },
    ]);
  });
});

describe('性能上报和汇总', () => {
  it('非法模板返回 422，超出限流返回 429，且两者都不写入分钟桶', async () => {
    const increment = vi.fn();
    const redis = { increment } as unknown as MetricsRedis;
    const counters = {
      incrWithTtl: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(61),
    } as unknown as RedisService;
    const service = new MetricsService(
      redis,
      counters,
      {} as MetricsRepository,
      {} as SystemService,
    );
    const payload = { route: '/random-xyz', samples: [{ metric: 'LCP', value: 100 }] };
    await expect(service.acceptVitals(payload, '127.0.0.1')).rejects.toMatchObject({ status: 422 });
    await expect(service.acceptVitals(payload, '127.0.0.1')).rejects.toMatchObject({ status: 429 });
    expect(increment).not.toHaveBeenCalled();
  });

  it('写库失败后重试仍汇总原分钟桶，并释放锁', async () => {
    const bucket = minuteKey('vital', new Date('2026-10-11T12:00:00.000Z'));
    const counts = { ['/\u001fLCP\u001f2000']: 3 };
    const readOpen = vi.fn().mockResolvedValue([{ key: bucket, counts }]);
    const releaseLock = vi.fn().mockResolvedValue(undefined);
    const drop = vi.fn().mockResolvedValue(undefined);
    const redis = {
      tryLock: vi.fn().mockResolvedValue('lock-token'),
      readOpen,
      releaseLock,
      drop,
    } as unknown as MetricsRedis;
    const commitHour = vi
      .fn()
      .mockRejectedValueOnce(new Error('db unavailable'))
      .mockResolvedValue(undefined);
    const repository = {
      commitHour,
      pruneHours: vi.fn().mockResolvedValue(undefined),
    } as unknown as MetricsRepository;
    const system = {
      getMetricsSettings: vi.fn().mockResolvedValue({ hourRetentionDays: 90 }),
    } as unknown as SystemService;
    const rollup = new MetricsRollup(redis, repository, system);
    await expect(rollup.run(new Date('2026-10-11T13:05:00.000Z'))).rejects.toThrow(
      'db unavailable',
    );
    expect(drop).not.toHaveBeenCalled();
    expect(releaseLock).toHaveBeenCalledWith('metrics:rollup-lock', 'lock-token');
    await rollup.run(new Date('2026-10-11T14:05:00.000Z'));
    expect(commitHour).toHaveBeenLastCalledWith(
      new Date('2026-10-11T12:00:00.000Z'),
      [],
      [expect.objectContaining({ histogram: { '2000': 3 } })],
    );
    expect(drop).toHaveBeenCalledWith([bucket]);
    expect(releaseLock).toHaveBeenCalledTimes(2);
  });

  it('Redis 清理失败时，概览不重复计入已经提交的小时', async () => {
    const now = new Date();
    const bucketStart = new Date(hourStart(now).getTime() - 60 * 60 * 1000);
    const repository = {
      readRange: vi.fn().mockResolvedValue({
        closedBefore: hourStart(now),
        http: [],
        vitals: [{ template: '/', metric: 'LCP', histogram: { '2000': 3 } }],
      }),
      listDeploys: vi.fn().mockResolvedValue([]),
    } as unknown as MetricsRepository;
    const redis = {
      readOpen: vi
        .fn()
        .mockResolvedValue([
          { key: minuteKey('vital', bucketStart), counts: { ['/\u001fLCP\u001f2000']: 3 } },
        ]),
    } as unknown as MetricsRedis;
    const system = {
      getMetricsSettings: vi.fn().mockResolvedValue({ sampleRate: 0.2 }),
    } as unknown as SystemService;
    const service = new MetricsService(redis, {} as RedisService, repository, system);
    const overview = await service.overview('24h');
    expect(overview.vitals[0].count).toBe(3);
    expect(redis.readOpen).toHaveBeenCalledBefore(vi.mocked(repository.readRange));
  });
});
