import { afterEach, describe, expect, it } from 'vitest';
import {
  getReadingCheckpointDistance,
  getReadingProgress,
  setReadingProgress,
  shouldPersistReadingProgress,
} from './clientPreferences';

afterEach(() => localStorage.clear());

describe('阅读进度检查点', () => {
  it('按四分之一视口计算阈值，并限制在 160 到 240px', () => {
    expect(getReadingCheckpointDistance(500)).toBe(160);
    expect(getReadingCheckpointDistance(800)).toBe(200);
    expect(getReadingCheckpointDistance(1200)).toBe(240);
  });

  it('跨过滚动距离、切章或切页时才需要写入', () => {
    const previous = {
      scrollY: 1000,
      percent: 30,
      chapterId: 'chapter-a',
      kind: 'scroll' as const,
      updatedAt: '2026-10-23T00:00:00.000Z',
    };
    expect(
      shouldPersistReadingProgress(previous, { ...previous, scrollY: 1199 }, 800),
    ).toBe(false);
    expect(
      shouldPersistReadingProgress(previous, { ...previous, scrollY: 1200 }, 800),
    ).toBe(true);
    expect(
      shouldPersistReadingProgress(previous, { ...previous, chapterId: 'chapter-b' }, 800),
    ).toBe(true);
    expect(
      shouldPersistReadingProgress(
        { ...previous, kind: 'page', page: 2, totalPages: 10 },
        { ...previous, kind: 'page', page: 3, totalPages: 10 },
        800,
      ),
    ).toBe(true);
  });

  it('保留 PDF 页码，同时兼容原有 scrollY 阅读记录', () => {
    setReadingProgress('pdf', {
      scrollY: 0,
      percent: 40,
      page: 4,
      totalPages: 10,
      kind: 'page',
    });
    setReadingProgress('legacy', { scrollY: 320, percent: 20 });

    expect(getReadingProgress('pdf')).toMatchObject({
      scrollY: 0,
      percent: 40,
      page: 4,
      totalPages: 10,
      kind: 'page',
    });
    expect(getReadingProgress('legacy')).toMatchObject({ scrollY: 320, percent: 20 });
  });
});
