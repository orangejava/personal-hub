import {
  asHistogram,
  histogramCount,
  mergeHistograms,
  percentileFromHistogram,
  type HttpCount,
  type VitalCount,
} from './metrics-histogram';

export interface StoredHttpRow {
  method: string;
  template: string;
  statusClass: string;
  histogram: Record<string, number>;
}

export interface StoredVitalRow {
  template: string;
  metric: string;
  histogram: Record<string, number>;
}

export interface PublicHttpRow {
  label: string;
  method: string;
  statusClass: string;
  p50: number;
  p95: number;
  count: number;
}

export interface PublicVitalRow {
  route: string;
  metric: string;
  p50: number;
  p95: number;
  count: number;
}

/** 管理接口不进公开结果。登录和鉴权只显示分组名。 */
export function publicHttpLabel(template: string): string | null {
  if (template.startsWith('/api/v1/admin') || template.includes('/admin/')) return null;
  if (template === '/auth' || template.startsWith('/auth/') || template.includes('/auth/'))
    return '认证';
  return template;
}

export function countsToHttpRows(counts: HttpCount[]): StoredHttpRow[] {
  const grouped = new Map<string, StoredHttpRow>();
  for (const count of counts) {
    const key = `${count.method}\u001f${count.template}\u001f${count.statusClass}`;
    const current = grouped.get(key) ?? {
      method: count.method,
      template: count.template,
      statusClass: count.statusClass,
      histogram: {},
    };
    current.histogram = {
      ...current.histogram,
      [String(count.edge)]: (current.histogram[String(count.edge)] ?? 0) + count.count,
    };
    grouped.set(key, current);
  }
  return [...grouped.values()];
}

export function countsToVitalRows(counts: VitalCount[]): StoredVitalRow[] {
  const grouped = new Map<string, StoredVitalRow>();
  for (const count of counts) {
    const key = `${count.template}\u001f${count.metric}`;
    const current = grouped.get(key) ?? {
      template: count.template,
      metric: count.metric,
      histogram: {},
    };
    current.histogram = {
      ...current.histogram,
      [String(count.edge)]: (current.histogram[String(count.edge)] ?? 0) + count.count,
    };
    grouped.set(key, current);
  }
  return [...grouped.values()];
}

export function shapePublicHttp(rows: StoredHttpRow[]): PublicHttpRow[] {
  const grouped = new Map<
    string,
    { label: string; method: string; statusClass: string; histograms: Record<string, number>[] }
  >();
  for (const row of rows) {
    const label = publicHttpLabel(row.template);
    if (!label) continue;
    const key = `${label}\u001f${row.method}\u001f${row.statusClass}`;
    const current = grouped.get(key) ?? {
      label,
      method: row.method,
      statusClass: row.statusClass,
      histograms: [],
    };
    current.histograms.push(asHistogram(row.histogram));
    grouped.set(key, current);
  }
  return [...grouped.values()].flatMap((item) => {
    const histogram = mergeHistograms(item.histograms);
    const p50 = percentileFromHistogram(histogram, 0.5);
    const p95 = percentileFromHistogram(histogram, 0.95);
    const count = histogramCount(histogram);
    if (p50 == null || p95 == null || count <= 0) return [];
    return [
      { label: item.label, method: item.method, statusClass: item.statusClass, p50, p95, count },
    ];
  });
}

/**
 * 多个小时和当前 Redis 桶合成一行。概览要的是所选时间范围的合计，不是每个小时各一行。
 */
export function shapePublicVitals(rows: StoredVitalRow[]): PublicVitalRow[] {
  const grouped = new Map<
    string,
    { route: string; metric: string; histograms: Record<string, number>[] }
  >();
  for (const row of rows) {
    const key = `${row.template}\u001f${row.metric}`;
    const current = grouped.get(key) ?? { route: row.template, metric: row.metric, histograms: [] };
    current.histograms.push(asHistogram(row.histogram));
    grouped.set(key, current);
  }
  return [...grouped.values()].flatMap((item) => {
    const histogram = mergeHistograms(item.histograms);
    const p50 = percentileFromHistogram(histogram, 0.5);
    const p95 = percentileFromHistogram(histogram, 0.95);
    const count = histogramCount(histogram);
    if (p50 == null || p95 == null || count <= 0) return [];
    return [{ route: item.route, metric: item.metric, p50, p95, count }];
  });
}

export function percentileOfMetric(
  rows: StoredVitalRow[],
  metric: string,
  ratio: number,
): number | null {
  const histogram = mergeHistograms(
    rows.filter((row) => row.metric === metric).map((row) => asHistogram(row.histogram)),
  );
  return percentileFromHistogram(histogram, ratio);
}

export function percentileOfHttp(rows: StoredHttpRow[], ratio: number): number | null {
  const histogram = mergeHistograms(
    rows.filter((row) => publicHttpLabel(row.template)).map((row) => asHistogram(row.histogram)),
  );
  return percentileFromHistogram(histogram, ratio);
}
