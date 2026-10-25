import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getReadingProgress } from '@/utils/clientPreferences';
import { useReadingProgressCheckpoint } from './useReadingProgressCheckpoint';

afterEach(() => {
  localStorage.clear();
});

type Reader = () => {
  scrollY: number;
  percent: number;
  kind: 'scroll';
};

describe('useReadingProgressCheckpoint 生命周期', () => {
  it('pagehide 使用当前渲染的读取函数保存最新位置', () => {
    const { result, rerender } = renderHook(
      ({ readLatest }: { readLatest?: Reader }) =>
        useReadingProgressCheckpoint({
          contentId: 'content-a',
          enabled: true,
          readLatest,
        }),
      { initialProps: { readLatest: undefined as Reader | undefined } },
    );

    act(() => {
      result.current.report({ scrollY: 200, percent: 20, kind: 'scroll' });
    });
    rerender({
      readLatest: () => ({
        scrollY: 350,
        percent: 35,
        kind: 'scroll' as const,
      }),
    });

    act(() => window.dispatchEvent(new Event('pagehide')));

    expect(getReadingProgress('content-a')).toMatchObject({
      scrollY: 350,
      percent: 35,
    });
  });

  it('内容切换时旧快照仍同步给旧内容', async () => {
    const syncA = vi.fn(async () => undefined);
    const syncB = vi.fn(async () => undefined);
    const { result, rerender } = renderHook(
      ({
        contentId,
        sync,
      }: {
        contentId: string;
        sync: (progress: { percent: number }) => Promise<void>;
      }) => useReadingProgressCheckpoint({ contentId, enabled: true, sync }),
      { initialProps: { contentId: 'content-a', sync: syncA } },
    );

    act(() => {
      result.current.report({ scrollY: 400, percent: 40, kind: 'scroll' });
    });
    rerender({ contentId: 'content-b', sync: syncB });

    await waitFor(() => expect(syncA).toHaveBeenCalledOnce());
    expect(syncA).toHaveBeenCalledWith(
      expect.objectContaining({ percent: 40 }),
    );
    expect(syncB).not.toHaveBeenCalled();
  });

  it('卸载清理只收口已采集快照，不从新页面读取位置', () => {
    let liveScrollY = 640;
    const readLatest = vi.fn(() => ({
      scrollY: liveScrollY,
      percent: 64,
      kind: 'scroll' as const,
    }));
    const { result, unmount } = renderHook(() =>
      useReadingProgressCheckpoint({
        contentId: 'content-a',
        enabled: true,
        readLatest,
      }),
    );

    act(() => {
      result.current.report({ scrollY: 640, percent: 64, kind: 'scroll' });
    });
    liveScrollY = 0;
    unmount();

    expect(readLatest).not.toHaveBeenCalled();
    expect(getReadingProgress('content-a')).toMatchObject({
      scrollY: 640,
      percent: 64,
    });
  });

  it('小册切章提交快照时不读取新章节的实时滚动位置', async () => {
    const sync = vi.fn(async () => undefined);
    const readLatest = vi.fn(() => ({
      chapterId: 'chapter-b',
      scrollY: 0,
      percent: 0,
      kind: 'scroll' as const,
    }));
    const { result } = renderHook(() =>
      useReadingProgressCheckpoint({
        contentId: 'booklet-a',
        enabled: true,
        sync,
        readLatest,
      }),
    );

    act(() => {
      result.current.report({
        chapterId: 'chapter-a',
        scrollY: 640,
        percent: 64,
        kind: 'scroll',
      });
      result.current.flushSnapshot();
    });

    await waitFor(() => expect(sync).toHaveBeenCalledOnce());
    expect(readLatest).not.toHaveBeenCalled();
    expect(getReadingProgress('booklet-a')).toMatchObject({
      chapterId: 'chapter-a',
      scrollY: 640,
      percent: 64,
    });
  });
});
