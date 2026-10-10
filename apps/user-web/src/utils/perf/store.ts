const PAGE_STORAGE_KEY = 'ph-perf-pages';
const MAX_PAGE_RECORDS = 200;
/** 同一页面同一指标只留最近几条，避免 CLS 连续上报把别的页面挤出 200 条上限。 */
const MAX_SAMPLES_PER_METRIC = 8;
/** 这段时间内的同页同指标视为同一次访问的更新，只保留最新值。 */
const REPEAT_WINDOW_MS = 60_000;
const PAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_API_RECORDS = 500;

export type PageMetricName = 'TTFB' | 'FCP' | 'LCP' | 'CLS' | 'INP' | 'route' | 'js';

export interface PageSample {
  route: string;
  metric: PageMetricName;
  value: number;
  at: number;
}

export interface ApiSample {
  method: string;
  route: string;
  duration: number;
  ok: boolean;
  at: number;
}

export interface JsBundleStat {
  name: string;
  bytes: number;
  duration: number;
}

const apiSamples: ApiSample[] = [];
const jsBundles = new Map<string, JsBundleStat>();
const listeners = new Set<() => void>();

const PAGE_METRICS = new Set<PageMetricName>([
  'TTFB',
  'FCP',
  'LCP',
  'CLS',
  'INP',
  'route',
  'js',
]);

function emit(): void {
  listeners.forEach((listener) => {
    listener();
  });
}

function isPageSample(value: unknown): value is PageSample {
  if (!value || typeof value !== 'object') return false;
  const sample = value as PageSample;
  return (
    typeof sample.route === 'string' &&
    PAGE_METRICS.has(sample.metric) &&
    typeof sample.value === 'number' &&
    Number.isFinite(sample.value) &&
    typeof sample.at === 'number'
  );
}

function readStoredPages(): PageSample[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const text = localStorage.getItem(PAGE_STORAGE_KEY);
    if (!text) return [];
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPageSample);
  } catch {
    return [];
  }
}

/** 订阅本机样本变化。抽屉和完整页用来刷新，不把存储本身做成全局状态库。 */
export function subscribePerf(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 7 天内的页面样本，最多 200 条。接口样本不在这里。 */
export function readPageSamples(now = Date.now()): PageSample[] {
  const cutoff = now - PAGE_TTL_MS;
  return readStoredPages()
    .filter((sample) => sample.at >= cutoff)
    .slice(-MAX_PAGE_RECORDS);
}

function metricKey(sample: PageSample): string {
  return `${sample.route}\0${sample.metric}`;
}

/** 每个页面指标留住最近几次，再按全局 200 条丢掉最旧的。 */
function trimPageSamples(samples: PageSample[]): PageSample[] {
  const grouped = new Map<string, PageSample[]>();
  samples.forEach((sample) => {
    const key = metricKey(sample);
    const list = grouped.get(key) ?? [];
    list.push(sample);
    grouped.set(key, list);
  });
  const kept: PageSample[] = [];
  grouped.forEach((list) => {
    const sorted = [...list].sort((left, right) => left.at - right.at);
    kept.push(...sorted.slice(-MAX_SAMPLES_PER_METRIC));
  });
  kept.sort((left, right) => left.at - right.at);
  return kept.slice(-MAX_PAGE_RECORDS);
}

function writePageSamples(samples: PageSample[]): void {
  try {
    localStorage.setItem(PAGE_STORAGE_KEY, JSON.stringify(trimPageSamples(samples)));
  } catch {
    // 无痕模式或配额满：放弃持久化。
  }
  emit();
}

/**
 * 写入一条页面指标。localStorage 不可用或配额满时丢掉这一条，不影响页面。
 * 只保存路由模板和数值，刷新或离开页面后仍然能读到。
 */
export function appendPageSample(sample: PageSample, now = Date.now()): void {
  if (!Number.isFinite(sample.value) || sample.value < 0) return;
  const cutoff = now - PAGE_TTL_MS;
  if (sample.at < cutoff) return;
  const next = readStoredPages().filter((item) => item.at >= cutoff);
  next.push(sample);
  writePageSamples(next);
}

/**
 * 连续上报时改写最近一条，而不是再追加。
 * CLS、INP 会在同一次停留里反复回调，全部追加会把已经打开过的页面记录挤掉。
 */
export function upsertRecentPageSample(sample: PageSample, now = Date.now()): void {
  if (!Number.isFinite(sample.value) || sample.value < 0) return;
  const cutoff = now - PAGE_TTL_MS;
  if (sample.at < cutoff) return;
  const next = readStoredPages().filter((item) => item.at >= cutoff);
  const previous = [...next]
    .reverse()
    .find((item) => item.route === sample.route && item.metric === sample.metric);
  if (previous && sample.at - previous.at <= REPEAT_WINDOW_MS) {
    previous.value = sample.value;
    previous.at = sample.at;
  } else {
    next.push(sample);
  }
  writePageSamples(next);
}

/** 内存中的最近 500 条接口记录，刷新页面即清空。 */
export function pushApiSample(sample: ApiSample): void {
  apiSamples.push(sample);
  if (apiSamples.length > MAX_API_RECORDS) {
    apiSamples.splice(0, apiSamples.length - MAX_API_RECORDS);
  }
  emit();
}

export function readApiSamples(): ApiSample[] {
  return apiSamples.slice();
}

/** 按文件名保留见过的最大体积，供分包柱状图使用。不写 localStorage。 */
export function rememberJsBundles(files: JsBundleStat[]): void {
  files.forEach((file) => {
    const current = jsBundles.get(file.name);
    if (!current || file.bytes > current.bytes) {
      jsBundles.set(file.name, file);
    }
  });
  emit();
}

export function readJsBundles(): JsBundleStat[] {
  return [...jsBundles.values()].sort((left, right) => right.bytes - left.bytes);
}

/** 单测清空内存样本。不触碰调用方自己的 localStorage 模拟。 */
export function resetPerfMemory(): void {
  apiSamples.splice(0, apiSamples.length);
  jsBundles.clear();
}
