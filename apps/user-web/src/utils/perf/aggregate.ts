import { PERF_PAGES, perfPageLabel } from '@/config/pageRegistry';
import { matchPageTemplate } from '@/utils/perf/routeTemplate';
import {
  buildScoreTip,
  compositeScore,
  HEADLINE_WEIGHTS,
  MIN_METRIC_SAMPLES,
  PAGE_CARD_WEIGHTS,
  PAGE_THRESHOLDS,
  percentile,
  scoreMetric,
  tierFor,
  type MetricTier,
  type ScoreFactor,
  type ScoreTip,
} from '@/utils/perf/score';
import {
  readApiSamples,
  readJsBundles,
  readPageSamples,
  type PageMetricName,
  type PageSample,
} from '@/utils/perf/store';

export interface MetricCell {
  key: string;
  label: string;
  hint: string;
  display: string;
  tier: MetricTier | 'unknown';
  sufficient: boolean;
  samples: number;
}

export interface PageCardModel {
  template: string;
  label: string;
  score: number | null;
  scoreTip: ScoreTip;
  missing: boolean;
  cells: MetricCell[];
}

export interface ApiRowModel {
  name: string;
  count: number;
  p50: number;
  p95: number;
  errorRate: number;
  tier: MetricTier;
}

export interface ChartPoint {
  time: string;
  value: number;
  page?: string;
}

export interface DashboardModel {
  sourceLabel: '本机';
  headlineScore: number | null;
  headlineTip: ScoreTip;
  headlineMissing: boolean;
  pages: PageCardModel[];
  apis: ApiRowModel[];
  slowestApis: ApiRowModel[];
  lcpSeries: ChartPoint[];
  apiSeries: ChartPoint[];
  jsBundles: { name: string; kb: number }[];
}

export const METRIC_HINTS: Record<string, string> = {
  TTFB: '首字节时间。整页刷新记文档；站内跳转记这次新请求的首字节。这一跳没有新请求时仍是数据不足。良好 ≤ 800 ms，差 > 1800 ms。',
  FCP: '首次内容绘制。整页刷新用浏览器官方值；站内跳转记新页面内容第一次出现在主区域的时间。良好 ≤ 1.8 s，差 > 3 s。',
  LCP: '最大内容绘制。整页刷新用浏览器官方值；站内跳转记主区域里最大一块内容出现的时间。良好 ≤ 2.5 s，差 > 4 s。',
  CLS: '这一页上的累计布局偏移，不含用户输入后的位移。良好 ≤ 0.1，差 > 0.25。',
  INP: '交互到下一帧的延迟，使用 web-vitals 官方计算。良好 ≤ 200 ms，差 > 500 ms。',
  route: '站内跳转到新页面挂载后的下一帧。良好 ≤ 300 ms，差 > 1000 ms。阈值是本项目自定的。',
  js: '这次导航实际观察到的 JS 传输体积。良好 ≤ 300 KB，差 > 1 MB。缓存命中时用编码体积。',
  apiP95: '本次会话最近 500 条请求的 p95。良好 ≤ 300 ms，差 > 800 ms。不与页面 7 天记录混成一个窗口。',
};

const CELL_LABELS: Record<string, string> = {
  TTFB: 'TTFB',
  FCP: 'FCP',
  LCP: 'LCP',
  CLS: 'CLS',
  INP: 'INP',
  route: '路由切换',
  js: '首屏 JS',
  apiP95: '接口 p95',
};

function formatMs(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(2)} s`;
  return `${Math.round(value)} ms`;
}

function formatMetric(key: string, value: number): string {
  if (key === 'CLS') return value.toFixed(3);
  if (key === 'js') {
    if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)} MB`;
    return `${Math.round(value / 1024)} KB`;
  }
  return formatMs(value);
}

function formatClock(timestamp: number): string {
  const date = new Date(timestamp);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
}

function valuesOf(samples: PageSample[], route: string | null, metric: PageMetricName): number[] {
  return samples
    .filter((sample) => sample.metric === metric && (route == null || sample.route === route))
    .map((sample) => sample.value);
}

function cellFromValues(key: string, values: number[]): MetricCell & { raw: number | null } {
  const threshold = PAGE_THRESHOLDS[key as keyof typeof PAGE_THRESHOLDS];
  const sufficient = values.length >= MIN_METRIC_SAMPLES;
  const raw = sufficient ? percentile(values, 0.75) : null;
  return {
    key,
    label: CELL_LABELS[key] ?? key,
    hint: METRIC_HINTS[key] ?? '',
    display: raw == null ? '数据不足' : formatMetric(key, raw),
    tier: raw == null || !threshold ? 'unknown' : tierFor(raw, threshold),
    sufficient,
    samples: values.length,
    raw,
  };
}

function scoreParts(
  cells: Record<string, MetricCell & { raw: number | null }>,
  weights: Record<string, number>,
) {
  return Object.entries(weights).map(([key, weight]) => {
    const raw = cells[key]?.raw;
    const threshold = PAGE_THRESHOLDS[key as keyof typeof PAGE_THRESHOLDS];
    return {
      weight,
      value: raw == null || !threshold ? null : scoreMetric(raw, threshold),
    };
  });
}

function factorsFor(
  cells: Record<string, MetricCell & { raw: number | null }>,
  weights: Record<string, number>,
  extra: ScoreFactor[] = [],
): ScoreFactor[] {
  const fromCells = Object.entries(weights).map(([key, weight]) => {
    const raw = cells[key]?.raw;
    const threshold = PAGE_THRESHOLDS[key as keyof typeof PAGE_THRESHOLDS];
    return {
      label: CELL_LABELS[key] ?? key,
      weight,
      score: raw == null || !threshold ? null : Math.round(scoreMetric(raw, threshold)),
    };
  });
  return [...fromCells, ...extra];
}

function buildApiRows(): ApiRowModel[] {
  const groups = new Map<string, { durations: number[]; errors: number }>();
  readApiSamples().forEach((sample) => {
    const name = `${sample.method} ${sample.route}`;
    const group = groups.get(name) ?? { durations: [], errors: 0 };
    group.durations.push(sample.duration);
    if (!sample.ok) group.errors += 1;
    groups.set(name, group);
  });

  return [...groups.entries()]
    .map(([name, group]) => {
      const p95 = percentile(group.durations, 0.95) ?? 0;
      return {
        name,
        count: group.durations.length,
        p50: percentile(group.durations, 0.5) ?? 0,
        p95,
        errorRate: group.durations.length === 0 ? 0 : group.errors / group.durations.length,
        tier: tierFor(p95, PAGE_THRESHOLDS.apiP95),
      };
    })
    .sort((left, right) => right.p95 - left.p95);
}

function buildLcpSeries(samples: PageSample[], selected: string[]): ChartPoint[] {
  return samples
    .filter((sample) => sample.metric === 'LCP' && selected.includes(sample.route))
    .sort((left, right) => left.at - right.at)
    .slice(-80)
    .map((sample) => ({
      time: formatClock(sample.at),
      value: Math.round(sample.value),
      page: perfPageLabel(sample.route),
    }));
}

function buildApiSeries(): ChartPoint[] {
  const buckets = new Map<number, number[]>();
  readApiSamples().forEach((sample) => {
    const minute = Math.floor(sample.at / 60000);
    const list = buckets.get(minute) ?? [];
    list.push(sample.duration);
    buckets.set(minute, list);
  });
  return [...buckets.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([minute, durations]) => ({
      time: formatClock(minute * 60000),
      value: Math.round(percentile(durations, 0.95) ?? 0),
    }));
}

/** 组装面板。页面指标来自 7 天 localStorage，接口指标来自本次会话最近 500 条。 */
export function buildDashboard(selectedTemplates?: string[]): DashboardModel {
  const selected = selectedTemplates ?? PERF_PAGES.map((page) => page.template);
  const samples = readPageSamples();
  const headlineCells = {
    LCP: cellFromValues('LCP', valuesOf(samples, null, 'LCP')),
    TTFB: cellFromValues('TTFB', valuesOf(samples, null, 'TTFB')),
    CLS: cellFromValues('CLS', valuesOf(samples, null, 'CLS')),
    INP: cellFromValues('INP', valuesOf(samples, null, 'INP')),
    FCP: cellFromValues('FCP', valuesOf(samples, null, 'FCP')),
  };
  const apiRows = buildApiRows();
  const apiDurations = readApiSamples().map((sample) => sample.duration);
  const apiP95 = apiDurations.length >= MIN_METRIC_SAMPLES ? percentile(apiDurations, 0.95) : null;
  const apiFactor: ScoreFactor = {
    label: CELL_LABELS.apiP95,
    weight: HEADLINE_WEIGHTS.apiP95,
    score: apiP95 == null ? null : Math.round(scoreMetric(apiP95, PAGE_THRESHOLDS.apiP95)),
  };
  const headlineFactors = factorsFor(
    headlineCells,
    {
      LCP: HEADLINE_WEIGHTS.LCP,
      TTFB: HEADLINE_WEIGHTS.TTFB,
      CLS: HEADLINE_WEIGHTS.CLS,
      INP: HEADLINE_WEIGHTS.INP,
      FCP: HEADLINE_WEIGHTS.FCP,
    },
    [apiFactor],
  );
  const headline = compositeScore(
    headlineFactors.map((factor) => ({ weight: factor.weight, value: factor.score })),
  );

  const pages = PERF_PAGES.filter((page) => selected.includes(page.template)).map((page) => {
    const lcp = cellFromValues('LCP', valuesOf(samples, page.template, 'LCP'));
    const ttfb = cellFromValues('TTFB', valuesOf(samples, page.template, 'TTFB'));
    const route = cellFromValues('route', valuesOf(samples, page.template, 'route'));
    const cardCells = { LCP: lcp, TTFB: ttfb, route };
    const card = compositeScore(scoreParts(cardCells, PAGE_CARD_WEIGHTS));
    return {
      template: page.template,
      label: page.label,
      score: card.score,
      scoreTip: buildScoreTip('page', factorsFor(cardCells, PAGE_CARD_WEIGHTS)),
      missing: card.missing || card.score == null,
      cells: [lcp, ttfb, route],
    };
  });

  return {
    sourceLabel: '本机',
    headlineScore: headline.score,
    headlineTip: buildScoreTip('headline', headlineFactors),
    headlineMissing: headline.missing || headline.score == null,
    pages,
    apis: apiRows,
    slowestApis: apiRows.slice(0, 5),
    lcpSeries: buildLcpSeries(samples, selected),
    apiSeries: buildApiSeries(),
    jsBundles: readJsBundles()
      .slice(0, 8)
      .map((file) => ({ name: file.name, kb: Math.round(file.bytes / 1024) })),
  };
}

export function currentPageCells(pathname: string): {
  template: string | null;
  label: string;
  score: number | null;
  scoreTip: ScoreTip;
  missing: boolean;
  cells: MetricCell[];
} {
  const template = matchPageTemplate(pathname);
  const samples = readPageSamples();
  const keys: PageMetricName[] = ['TTFB', 'FCP', 'LCP', 'CLS', 'INP', 'route', 'js'];
  const measured = Object.fromEntries(
    keys.map((key) => [key, cellFromValues(key, valuesOf(samples, template, key))]),
  ) as Record<string, MetricCell & { raw: number | null }>;
  const apiDurations = readApiSamples().map((sample) => sample.duration);
  const apiP95 = apiDurations.length >= MIN_METRIC_SAMPLES ? percentile(apiDurations, 0.95) : null;
  const apiCell: MetricCell = {
    key: 'apiP95',
    label: CELL_LABELS.apiP95,
    hint: METRIC_HINTS.apiP95,
    display: apiP95 == null ? '数据不足' : formatMs(apiP95),
    tier: apiP95 == null ? 'unknown' : tierFor(apiP95, PAGE_THRESHOLDS.apiP95),
    sufficient: apiP95 != null,
    samples: apiDurations.length,
  };
  const apiFactor: ScoreFactor = {
    label: CELL_LABELS.apiP95,
    weight: HEADLINE_WEIGHTS.apiP95,
    score: apiP95 == null ? null : Math.round(scoreMetric(apiP95, PAGE_THRESHOLDS.apiP95)),
  };
  const headlineFactors = factorsFor(
    measured,
    {
      LCP: HEADLINE_WEIGHTS.LCP,
      TTFB: HEADLINE_WEIGHTS.TTFB,
      CLS: HEADLINE_WEIGHTS.CLS,
      INP: HEADLINE_WEIGHTS.INP,
      FCP: HEADLINE_WEIGHTS.FCP,
    },
    [apiFactor],
  );
  const headline = compositeScore(
    headlineFactors.map((factor) => ({ weight: factor.weight, value: factor.score })),
  );

  return {
    template,
    label: template ? perfPageLabel(template) : '未登记页面',
    score: headline.score,
    scoreTip: buildScoreTip('current', headlineFactors),
    missing: headline.missing || headline.score == null,
    cells: [...keys.map((key) => measured[key]), apiCell],
  };
}
