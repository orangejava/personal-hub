import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setReadingProgress } from '@/utils/clientPreferences';

const fixture = vi.hoisted(() => ({
  route: { id: 'book-a', chapterId: 'chapter-a' },
  chapter: { id: 'chapter-a', title: 'A', body: '# A' },
  bookIndexState: 'current' as 'current' | 'empty' | 'stale',
  readLatest: undefined as undefined | (() => unknown),
  requestIndex: 0,
}));

vi.mock('@umijs/max', () => ({
  history: { push: vi.fn() },
  useModel: () => ({ initialState: {} }),
  useParams: () => fixture.route,
}));
vi.mock('@/hooks/usePublicTheme', () => ({
  usePublicTheme: () => ({ menuTheme: 'light' }),
}));
vi.mock('@/hooks/useViewportBand', () => ({
  useViewportBand: () => ({ band: 'desktop', readerSheets: false }),
}));
vi.mock('@/hooks/useReadingProgressCheckpoint', () => ({
  useReadingProgressCheckpoint: ({
    readLatest,
  }: {
    readLatest: () => unknown;
  }) => {
    fixture.readLatest = readLatest;
    return { report: vi.fn(), flushSnapshot: vi.fn() };
  },
}));
vi.mock('@/hooks/useRequest', () => ({
  useRequest: () => {
    const position = fixture.requestIndex++ % 3;
    if (position === 0) {
      if (fixture.bookIndexState === 'empty')
        return { data: undefined, loading: true };
      const isStale = fixture.bookIndexState === 'stale';
      return {
        data: {
          booklet: {
            id: isStale ? 'book-a' : fixture.route.id,
            title: fixture.route.id,
          },
          detail: { title: fixture.route.id },
          chapters: [
            {
              id: isStale ? 'chapter-a' : fixture.route.chapterId,
              title: isStale ? 'chapter-a' : fixture.route.chapterId,
              order: 1,
            },
          ],
        },
        loading: false,
      };
    }
    if (position === 1) return { data: fixture.chapter, loading: false };
    return { data: { list: [] }, loading: false };
  },
}));
vi.mock('@/layouts/PublicLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock('@/components/shared/MarkdownViewer', () => ({ default: () => null }));
vi.mock('@/components/shared/ScrollBackTop', () => ({ default: () => null }));
vi.mock('@/components/shared/TocPanel', () => ({ default: () => null }));
vi.mock('@/components/shared/BookletChapterFooter', () => ({
  default: () => null,
}));
vi.mock('antd', () => ({
  Button: () => null,
  Drawer: () => null,
  Menu: () => null,
  Progress: () => null,
  message: { info: vi.fn(), success: vi.fn() },
}));

import BookletChapter from './index';

describe('小册章节进度恢复', () => {
  beforeEach(() => {
    fixture.route = { id: 'book-a', chapterId: 'chapter-a' };
    fixture.chapter = { id: 'chapter-a', title: 'A', body: '# A' };
    fixture.bookIndexState = 'current';
    fixture.readLatest = undefined;
    fixture.requestIndex = 0;
    localStorage.clear();
    vi.stubGlobal('scrollTo', vi.fn());
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('跨小册切换时等新章节到达后才恢复保存位置', () => {
    setReadingProgress('book-b', {
      chapterId: 'chapter-b',
      scrollY: 480,
      percent: 40,
      kind: 'scroll',
    });
    const view = render(<BookletChapter />);
    const scrollTo = vi.mocked(window.scrollTo);
    scrollTo.mockClear();

    fixture.route = { id: 'book-b', chapterId: 'chapter-b' };
    view.rerender(<BookletChapter />);
    expect(scrollTo).not.toHaveBeenCalled();

    fixture.chapter = { id: 'chapter-b', title: 'B', body: '# B' };
    view.rerender(<BookletChapter />);
    expect(scrollTo).toHaveBeenCalledWith({
      top: 480,
      left: 0,
      behavior: 'auto',
    });
  });

  it('同册切章时等新章节到达后滚到顶部', () => {
    const view = render(<BookletChapter />);
    const scrollTo = vi.mocked(window.scrollTo);
    scrollTo.mockClear();

    fixture.route = { id: 'book-a', chapterId: 'chapter-b' };
    view.rerender(<BookletChapter />);
    expect(scrollTo).not.toHaveBeenCalled();

    fixture.chapter = { id: 'chapter-b', title: 'B', body: '# B' };
    view.rerender(<BookletChapter />);
    expect(scrollTo).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: 'auto',
    });
  });

  it.each([
    'empty',
    'stale',
  ] as const)('书目索引为 %s 时不把章内滚动比例上报成整本进度', (bookIndexState) => {
    fixture.route = { id: 'book-b', chapterId: 'chapter-b' };
    fixture.chapter = { id: 'chapter-b', title: 'B', body: '# B' };
    fixture.bookIndexState = bookIndexState;
    const view = render(<BookletChapter />);
    expect(fixture.readLatest?.()).toBeUndefined();

    fixture.bookIndexState = 'current';
    view.rerender(<BookletChapter />);
    expect(fixture.readLatest?.()).toMatchObject({ chapterId: 'chapter-b' });
  });
});
