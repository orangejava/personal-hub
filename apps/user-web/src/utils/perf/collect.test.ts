import { describe, expect, it } from 'vitest';
import { claimVitalBeacon, sampleSession } from './collect';

describe('全站上报名额', () => {
  it('同一次打开里同一路由只占一次，换路由可以再占', () => {
    const sent = new Set<string>();
    expect(claimVitalBeacon(sent, '/')).toBe(true);
    expect(claimVitalBeacon(sent, '/')).toBe(false);
    expect(claimVitalBeacon(sent, '/content')).toBe(true);
  });
});

describe('会话抽样比例变更', () => {
  it('旧会话已抽中，刷新拿到 0% 后停止上报；100% 不沿用旧未抽中结果', () => {
    sessionStorage.clear();
    sessionStorage.setItem('ph.perf.sample', '1');
    expect(sampleSession(0, sessionStorage, () => 0.1)).toBe(false);
    sessionStorage.setItem('ph.perf.sample', '0');
    expect(sampleSession(1, sessionStorage, () => 0.9)).toBe(true);
  });
  it('中间比例共享一个随机分位，并随新比例重新判断', () => {
    sessionStorage.clear();
    expect(sampleSession(0.2, sessionStorage, () => 0.3)).toBe(false);
    expect(sampleSession(0.5, sessionStorage, () => 0.9)).toBe(true);
    expect(sessionStorage.getItem('ph.perf.sample.seed')).toBe('0.3');
  });
});
