import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readPageSamples } from './store';
import { applyLayoutShift, beginSpaRoute, resourceTtfb } from './spaVitals';

describe('resourceTtfb', () => {
  it('uses the first request that starts after this navigation', () => {
    const value = resourceTtfb(
      [
        { initiatorType: 'fetch', startTime: 10, responseStart: 40 },
        { initiatorType: 'fetch', startTime: 80, responseStart: 100 },
        { initiatorType: 'script', startTime: 80, responseStart: 90 },
      ],
      50,
    );
    expect(value).toBe(20);
  });

  it('returns null when this navigation made no request', () => {
    expect(resourceTtfb([{ initiatorType: 'fetch', startTime: 10, responseStart: 40 }], 50)).toBe(
      null,
    );
  });
});

describe('applyLayoutShift', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes the current page CLS before leaving', () => {
    beginSpaRoute('/about');
    applyLayoutShift(0.2);
    expect(readPageSamples().some((sample) => sample.metric === 'CLS')).toBe(false);
    vi.advanceTimersByTime(400);
    expect(readPageSamples()).toEqual([
      expect.objectContaining({ route: '/about', metric: 'CLS', value: 0.2 }),
    ]);
  });

  it('flushes the previous page immediately when the route changes', () => {
    beginSpaRoute('/about');
    applyLayoutShift(0.2);
    beginSpaRoute('/');
    expect(readPageSamples()).toEqual([
      expect.objectContaining({ route: '/about', metric: 'CLS', value: 0.2 }),
    ]);
  });
});
