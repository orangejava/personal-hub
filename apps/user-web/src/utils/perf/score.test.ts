import { describe, expect, it } from 'vitest';
import { buildScoreTip, compositeScore, percentile, scoreMetric } from './score';

const lcp = { good: 2500, poor: 4000 };

describe('scoreMetric', () => {
  it('keeps the top band at 100 until half of the good threshold', () => {
    expect(scoreMetric(0, lcp)).toBe(100);
    expect(scoreMetric(1250, lcp)).toBe(100);
  });

  it('lands on the documented knots', () => {
    expect(scoreMetric(2500, lcp)).toBe(90);
    expect(scoreMetric(4000, lcp)).toBe(50);
    expect(scoreMetric(8000, lcp)).toBe(0);
    expect(scoreMetric(9000, lcp)).toBe(0);
  });
});

describe('compositeScore', () => {
  it('renormalizes when a metric has no samples', () => {
    const result = compositeScore([
      { value: 100, weight: 25 },
      { value: null, weight: 15 },
    ]);
    expect(result.score).toBe(100);
    expect(result.missing).toBe(true);
  });

  it('returns null when every metric is missing', () => {
    expect(compositeScore([{ value: null, weight: 25 }])).toEqual({
      score: null,
      missing: true,
    });
  });
});

describe('buildScoreTip', () => {
  it('shows the weighted formula and keeps page cards out of the headline', () => {
    const tip = buildScoreTip('headline', [
      { label: 'LCP', weight: 25, score: 100 },
      { label: 'TTFB', weight: 15, score: 90 },
    ]);
    expect(tip.summary).toContain('不是下面页面卡片的平均分');
    expect(tip.formula).toBe('96 = (100×25 + 90×15) / 40');
    expect(tip.note).toContain('首屏 JS');
  });

  it('uses the current page scope in the drawer', () => {
    const tip = buildScoreTip('current', [{ label: 'LCP', weight: 25, score: 80 }]);
    expect(tip.kicker).toBe('当前页');
    expect(tip.formula).toBe('80 = (80×25) / 25');
  });
});

describe('percentile', () => {
  it('uses the nearest rank', () => {
    expect(percentile([10, 20, 30, 40], 0.5)).toBe(20);
    expect(percentile([10, 20, 30, 40], 0.95)).toBe(40);
    expect(percentile([], 0.95)).toBeNull();
  });
});
