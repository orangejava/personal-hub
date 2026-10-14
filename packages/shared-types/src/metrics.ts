export type MetricsRange = '24h' | '7d' | '30d';

export interface MetricsOverview {
  range: MetricsRange;
  /** 包含未收口的分钟数据，或 Redis 不可用导致实时部分缺失。 */
  partial: boolean;
  sampleRate: number;
  vitals: { route: string; metric: string; p50: number; p95: number; count: number }[];
  http: {
    label: string;
    method: string;
    statusClass: string;
    p50: number;
    p95: number;
    count: number;
  }[];
  deploys: { gitSha: string; deployedAt: string; note: string | null }[];
  compare: {
    marker: { gitSha: string; deployedAt: string; note: string | null };
    before: { lcpP95: number | null; httpP95: number | null };
    after: { lcpP95: number | null; httpP95: number | null };
  } | null;
}
