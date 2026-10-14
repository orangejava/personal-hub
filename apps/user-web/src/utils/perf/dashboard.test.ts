import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDashboard, currentPageCells, homeSummary } from './aggregate';
import { beginApiTiming, finishApiTiming } from './apiTiming';
import {
  appendPageSample,
  latestVitalSamples,
  readPageSamples,
  resetPerfMemory,
  upsertRecentPageSample,
} from './store';

describe('perf store and dashboard', () => {
  beforeEach(() => {
    localStorage.clear();
    resetPerfMemory();
  });

  it('drops expired samples and keeps other pages when one metric repeats', () => {
    const now = Date.now();
    appendPageSample(
      {
        route: '/',
        metric: 'LCP',
        value: 1000,
        at: now - 8 * 24 * 60 * 60 * 1000,
      },
      now,
    );
    appendPageSample(
      { route: '/about', metric: 'route', value: 120, at: now },
      now,
    );
    for (let index = 0; index < 30; index += 1) {
      appendPageSample(
        { route: '/', metric: 'CLS', value: index, at: now + index },
        now,
      );
    }
    const samples = readPageSamples(now + 30);
    expect(samples.some((sample) => sample.value === 1000)).toBe(false);
    expect(samples.filter((sample) => sample.metric === 'CLS')).toHaveLength(8);
    expect(
      samples.some(
        (sample) => sample.route === '/about' && sample.metric === 'route',
      ),
    ).toBe(true);
  });

  it('folds repeated vitals from the same visit into one record', () => {
    const now = Date.now();
    upsertRecentPageSample(
      { route: '/', metric: 'CLS', value: 0.01, at: now },
      now,
    );
    upsertRecentPageSample(
      { route: '/', metric: 'CLS', value: 0.04, at: now + 1000 },
      now + 1000,
    );
    const samples = readPageSamples(now + 1000);
    expect(samples).toEqual([
      expect.objectContaining({ metric: 'CLS', value: 0.04 }),
    ]);
  });

  it('groups api timings without concrete ids and ignores a second finish', () => {
    const config = beginApiTiming({
      method: 'get',
      url: '/api/v1/content/6f1c9c3e-1b2a-4d5e-8f90-123456789abc',
    });
    finishApiTiming(config, { ok: false });
    finishApiTiming(config, { ok: true });
    const dashboard = buildDashboard();
    expect(dashboard.apis).toEqual([
      expect.objectContaining({
        name: 'GET /api/v1/content/:id',
        count: 1,
        errorRate: 1,
      }),
    ]);
  });

  it('上报只带这次打开之后的指标，几天前的 TTFB 不带上', () => {
    const now = Date.now();
    appendPageSample(
      {
        route: '/',
        metric: 'TTFB',
        value: 40,
        at: now - 3 * 24 * 60 * 60 * 1000,
      },
      now,
    );
    appendPageSample({ route: '/', metric: 'LCP', value: 1800, at: now }, now);
    expect(
      latestVitalSamples('/', now - 1000).map((sample) => sample.metric),
    ).toEqual(['LCP']);
  });

  it('Beacon 只使用本标签内存样本，不读取其他标签写入的存储值', () => {
    const now = Date.now();
    appendPageSample({ route: '/', metric: 'LCP', value: 1800, at: now }, now);
    localStorage.setItem(
      'ph-perf-pages',
      JSON.stringify([{ route: '/', metric: 'LCP', value: 9000, at: now }]),
    );
    expect(latestVitalSamples('/', now - 1000)).toEqual([
      { metric: 'LCP', value: 1800 },
    ]);
  });

  it('shows a stored visit and leaves unopened pages empty', () => {
    const now = Date.now();
    appendPageSample({ route: '/', metric: 'LCP', value: 2000, at: now }, now);
    const home = currentPageCells('/').cells.find((cell) => cell.key === 'LCP');
    const about = buildDashboard().pages.find(
      (page) => page.template === '/about',
    );
    expect(home?.display).toBe('2.00 s');
    expect(about?.cells.find((cell) => cell.key === 'LCP')?.display).toBe(
      '数据不足',
    );
  });

  it('counts js and route in the homepage score, not in the page card', () => {
    const now = Date.now();
    appendPageSample({ route: '/', metric: 'LCP', value: 1000, at: now }, now);
    appendPageSample(
      { route: '/', metric: 'js', value: 2 * 1024 * 1024, at: now },
      now,
    );
    const card = buildDashboard().pages.find((page) => page.template === '/');
    expect(card?.score).toBe(100);
    expect(homeSummary().score).toBe(71);
  });

  it('does not throw when localStorage rejects the write', () => {
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota');
      });
    expect(() =>
      appendPageSample({
        route: '/',
        metric: 'FCP',
        value: 10,
        at: Date.now(),
      }),
    ).not.toThrow();
    setItem.mockRestore();
  });
});
