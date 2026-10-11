/**
 * 同一指标至少有这么多条才展示。
 * 打开过一次就要能在抽屉和性能页看到，所以是 1；没有样本才显示「数据不足」。
 */
export const MIN_METRIC_SAMPLES = 1;

export type MetricTier = 'good' | 'needs-improvement' | 'poor';

export interface MetricThreshold {
  good: number;
  poor: number;
}

export const PAGE_THRESHOLDS = {
  TTFB: { good: 800, poor: 1800 },
  FCP: { good: 1800, poor: 3000 },
  LCP: { good: 2500, poor: 4000 },
  CLS: { good: 0.1, poor: 0.25 },
  INP: { good: 200, poor: 500 },
  route: { good: 300, poor: 1000 },
  js: { good: 300 * 1024, poor: 1024 * 1024 },
  apiP95: { good: 300, poor: 800 },
} as const satisfies Record<string, MetricThreshold>;

/** 顶部综合分权重。路由切换和首屏 JS 只展示，不进这张权重表。 */
export const HEADLINE_WEIGHTS = {
  LCP: 25,
  TTFB: 15,
  CLS: 15,
  INP: 15,
  FCP: 10,
  apiP95: 20,
} as const;

/**
 * 页面卡片只展示 LCP、TTFB、路由切换。
 * 路由切换没有全局权重，卡片本地给它与 TTFB 相同的 15，缺样本时按剩余权重归一。
 */
export const PAGE_CARD_WEIGHTS = {
  LCP: 25,
  TTFB: 15,
  route: 15,
} as const;

/**
 * 首页摘要把展示出来的八项都计入。
 * 前六项沿用顶部综合分。路由切换沿用页面卡片的 15。
 * 首屏 JS 原来不进任何综合分；这里给和 FCP 一样的 10，避免体积一项压过 LCP。
 * 缺样本的项不进分子，并从分母拿掉权重。八项都有数时分母是 125。
 */
export const HOME_SUMMARY_WEIGHTS = {
  LCP: HEADLINE_WEIGHTS.LCP,
  TTFB: HEADLINE_WEIGHTS.TTFB,
  CLS: HEADLINE_WEIGHTS.CLS,
  INP: HEADLINE_WEIGHTS.INP,
  FCP: HEADLINE_WEIGHTS.FCP,
  apiP95: HEADLINE_WEIGHTS.apiP95,
  route: PAGE_CARD_WEIGHTS.route,
  js: 10,
} as const;

function lerp(
  value: number,
  from: number,
  to: number,
  start: number,
  end: number,
): number {
  if (to === from) return end;
  const ratio = (value - from) / (to - from);
  return start + ratio * (end - start);
}

/**
 * 把一个「越小越好」的指标换算成 0–100。
 * 良好阈值一半及更好为 100，之后分段降到 90、50、0。
 */
export function scoreMetric(value: number, threshold: MetricThreshold): number {
  const halfGood = threshold.good / 2;
  const doublePoor = threshold.poor * 2;
  if (value <= halfGood) return 100;
  if (value <= threshold.good)
    return lerp(value, halfGood, threshold.good, 100, 90);
  if (value <= threshold.poor)
    return lerp(value, threshold.good, threshold.poor, 90, 50);
  if (value <= doublePoor)
    return lerp(value, threshold.poor, doublePoor, 50, 0);
  return 0;
}

export function tierFor(value: number, threshold: MetricThreshold): MetricTier {
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

export interface WeightedScorePart {
  value: number | null;
  weight: number;
}

export interface ScoreFactor {
  label: string;
  weight: number;
  /** 这一项自己的 0–100 分。没有样本时为 null，不参与综合分。 */
  score: number | null;
}

export type ScoreScope = 'headline' | 'current' | 'page';

export interface ScoreTip {
  kicker: string;
  summary: string;
  rows: ScoreFactor[];
  /** 例如 98 = (100×25 + 90×15) / 40 */
  formula: string;
  note: string;
}

/**
 * 悬停分数时的结构化说明。
 * 顶部总分是指标加权，不是页面卡片的平均；抽屉只看当前页。
 */
export function buildScoreTip(
  scope: ScoreScope,
  factors: ScoreFactor[],
): ScoreTip {
  const used = factors.filter(
    (factor) => factor.score != null && factor.weight > 0,
  );
  const weight = used.reduce((sum, factor) => sum + factor.weight, 0);
  const total = used.reduce(
    (sum, factor) => sum + (factor.score as number) * factor.weight,
    0,
  );
  const score = weight > 0 ? Math.round(total / weight) : null;
  const formula =
    score == null
      ? '没有可计入的指标'
      : `${score} = (${used.map((factor) => `${factor.score}×${factor.weight}`).join(' + ')}) / ${weight}`;
  if (scope === 'headline') {
    return {
      kicker: '全部记录',
      summary:
        '同一项指标先把各次访问合在一起，再按权重平均。不是下面页面卡片的平均分。',
      rows: factors,
      formula,
      note: '分母是计入项的权重之和。六项都有数时是 100。某一项不计，分母就少掉它的权重。首屏 JS 不计入。',
    };
  }
  if (scope === 'current') {
    return {
      kicker: '当前页',
      summary: '只统计正在看的这一页，再加上本次会话的接口。',
      rows: factors,
      formula,
      note: '性能页顶部是全部记录的总分，两个数字可以不同。首屏 JS 和路由切换不计入。',
    };
  }
  return {
    kicker: '本页卡片',
    summary: '只看这一页的 LCP、TTFB、路由切换。',
    rows: factors,
    formula,
    note: '分母是计入项的权重之和。LCP 25、TTFB 15、路由切换 15，三项都有数时分母是 55。某一项不计，就从分母拿掉它的权重。',
  };
}

/** 给读屏用的一行口径，和提示卡是同一套数字。 */
export function scoreTipText(tip: ScoreTip): string {
  return `${tip.kicker}。${tip.summary}${tip.formula}。${tip.note}`;
}

/**
 * 有数据的项按权重归一。没有任何样本时返回 null，调用方显示「数据不足」。
 */
export function compositeScore(parts: WeightedScorePart[]): {
  score: number | null;
  missing: boolean;
} {
  const present = parts.filter((part) => part.value != null && part.weight > 0);
  const weight = present.reduce((sum, part) => sum + part.weight, 0);
  if (weight <= 0) return { score: null, missing: true };
  const total = present.reduce(
    (sum, part) => sum + (part.value as number) * part.weight,
    0,
  );
  return {
    score: Math.round(total / weight),
    missing: present.length !== parts.filter((part) => part.weight > 0).length,
  };
}

/** 最近秩百分位。p = 0.75 表示 p75，p = 0.95 表示 p95。 */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.ceil(p * sorted.length);
  const index = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[index] ?? null;
}
