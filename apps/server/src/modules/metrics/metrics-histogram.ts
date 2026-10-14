/** 末档表示大于 5 秒，不能把慢请求伪装成恰好 5 秒。 */
export const DURATION_BUCKETS = [
  10, 25, 50, 100, 200, 300, 500, 800, 1200, 2000, 5000, 120_000,
] as const;

/** CLS 没有毫秒，单独用位移档。 */
export const CLS_BUCKETS = [0.01, 0.05, 0.1, 0.25, 0.5, 1] as const;

export const VITAL_METRICS = ['TTFB', 'FCP', 'LCP', 'CLS', 'INP'] as const;
export type VitalMetric = (typeof VITAL_METRICS)[number];

const FIELD_SEP = '\u001f';
const OPEN_SET = 'metrics:open';
const KEY_TTL_SECONDS = 48 * 60 * 60;

export function bucketFor(value: number, edges: readonly number[]): number {
  for (const edge of edges) {
    if (value <= edge) return edge;
  }
  return edges[edges.length - 1];
}

export function statusClassOf(code: number): string {
  if (code >= 200 && code < 300) return '2xx';
  if (code >= 400 && code < 500) return '4xx';
  if (code >= 500 && code < 600) return '5xx';
  return 'other';
}

export function minuteKey(kind: 'http' | 'vital', date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  return `metrics:${kind}:${year}${month}${day}${hour}${minute}`;
}

export function parseMinuteKey(key: string): { kind: 'http' | 'vital'; at: Date } | null {
  const match = /^metrics:(http|vital):(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(key);
  if (!match) return null;
  const at = new Date(
    Date.UTC(
      Number(match[2]),
      Number(match[3]) - 1,
      Number(match[4]),
      Number(match[5]),
      Number(match[6]),
    ),
  );
  if (Number.isNaN(at.getTime())) return null;
  return { kind: match[1] as 'http' | 'vital', at };
}

export function hourStart(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours()),
  );
}

export function dayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * 小时删除和日重建共用的起点，按 UTC 日对齐。
 * 若用「此刻减去保留天数」，上午会先删掉边界日凌晨的小时，再用剩下的小时覆盖原本完整的日行。
 *
 * @param now 本次收口时刻
 * @param retentionDays 小时行保留天数
 * @returns 这一天 00:00 UTC；早于它的小时可以删，从它开始的整天仍可重建
 */
export function hourRetentionStart(now: Date, retentionDays: number): Date {
  const today = dayStart(now);
  return new Date(today.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}

export function httpField(
  method: string,
  template: string,
  statusClass: string,
  edge: number,
): string {
  return [method.toUpperCase(), template, statusClass, String(edge)].join(FIELD_SEP);
}

export function vitalField(template: string, metric: string, edge: number): string {
  return [template, metric, String(edge)].join(FIELD_SEP);
}

export interface HttpCount {
  method: string;
  template: string;
  statusClass: string;
  edge: number;
  count: number;
}

export interface VitalCount {
  template: string;
  metric: string;
  edge: number;
  count: number;
}

export function parseHttpField(field: string, count: number): HttpCount | null {
  const [method, template, statusClass, edgeText] = field.split(FIELD_SEP);
  const edge = Number(edgeText);
  if (!method || !template || !statusClass || !Number.isFinite(edge) || count <= 0) return null;
  return { method, template, statusClass, edge, count };
}

export function parseVitalField(field: string, count: number): VitalCount | null {
  const [template, metric, edgeText] = field.split(FIELD_SEP);
  const edge = Number(edgeText);
  if (!template || !metric || !Number.isFinite(edge) || count <= 0) return null;
  return { template, metric, edge, count };
}

export function addCount(
  histogram: Record<string, number>,
  edge: number,
  count: number,
): Record<string, number> {
  const key = String(edge);
  return { ...histogram, [key]: (histogram[key] ?? 0) + count };
}

export function mergeHistograms(items: Record<string, number>[]): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const item of items) {
    for (const [key, count] of Object.entries(item)) {
      if (!Number.isFinite(count) || count <= 0) continue;
      merged[key] = (merged[key] ?? 0) + count;
    }
  }
  return merged;
}

export function histogramCount(histogram: Record<string, number>): number {
  return Object.values(histogram).reduce((sum, count) => sum + (count > 0 ? count : 0), 0);
}

/**
 * 用直方图上界近似百分位。次数为 0 时返回 null。
 */
export function percentileFromHistogram(
  histogram: Record<string, number>,
  ratio: number,
): number | null {
  const entries = Object.entries(histogram)
    .map(([edge, count]) => ({ edge: Number(edge), count }))
    .filter((item) => Number.isFinite(item.edge) && item.count > 0)
    .sort((left, right) => left.edge - right.edge);
  const total = entries.reduce((sum, item) => sum + item.count, 0);
  if (total <= 0) return null;
  const target = Math.ceil(total * ratio);
  let seen = 0;
  for (const item of entries) {
    seen += item.count;
    if (seen >= target) return item.edge;
  }
  return entries[entries.length - 1]?.edge ?? null;
}

export function asHistogram(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const histogram: Record<string, number> = {};
  for (const [key, count] of Object.entries(value)) {
    if (typeof count === 'number' && Number.isFinite(count) && count > 0) histogram[key] = count;
  }
  return histogram;
}

export const METRICS_OPEN_SET = OPEN_SET;
export const METRICS_KEY_TTL_SECONDS = KEY_TTL_SECONDS;

/** 当前小时还没结束，这些分钟桶留给下一次收口。 */
export function closedMinuteKeys(keys: string[], now: Date): string[] {
  const current = hourStart(now).getTime();
  return keys.filter((key) => {
    const parsed = parseMinuteKey(key);
    return parsed != null && hourStart(parsed.at).getTime() < current;
  });
}
