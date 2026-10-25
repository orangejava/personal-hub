import { ContentType } from '@personal-hub/shared-types';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setReadingProgress } from '@/utils/clientPreferences';

const fixture = vi.hoisted(() => ({
  routeId: 'content-a',
  response: {
    id: 'content-a',
    type: 'MARKDOWN',
    title: '文章 A',
    body: '# A',
    tags: [],
  },
  reports: [] as Array<{ contentId: string; scrollY: number }>,
}));

vi.mock('@umijs/max', () => ({
  history: { push: vi.fn(), replace: vi.fn() },
  Link: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
  useModel: () => ({ initialState: {} }),
  useParams: () => ({ id: fixture.routeId }),
}));
vi.mock('@/hooks/useViewportBand', () => ({
  useViewportBand: () => ({ band: 'desktop', readerSheets: false }),
}));
vi.mock('@/hooks/useRequest', () => ({
  useRequest: (_service: unknown, options: { refreshDeps?: unknown[] }) =>
    options.refreshDeps?.length === 1
      ? { data: fixture.response, loading: false }
      : { data: undefined, loading: false },
}));
vi.mock('@/hooks/useReadingProgressCheckpoint', () => ({
  useReadingProgressCheckpoint: ({ contentId }: { contentId: string }) => ({
    report: ({ scrollY }: { scrollY: number }) =>
      fixture.reports.push({ contentId, scrollY }),
  }),
}));
vi.mock('@/utils/scroll', () => ({ scrollPageToTop: vi.fn() }));
vi.mock('@/layouts/PublicLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock('@/components/shared/MarkdownViewer', () => ({ default: () => null }));
vi.mock('@/components/shared/RichTextViewer', () => ({ default: () => null }));
vi.mock('@/components/shared/ReaderActionBar', () => ({ default: () => null }));
vi.mock('@/components/shared/ScrollBackTop', () => ({ default: () => null }));
vi.mock('@/components/shared/SectionSkeleton', () => ({ default: () => null }));
vi.mock('@/components/shared/TocPanel', () => ({ default: () => null }));
vi.mock('antd', () => {
  const Container = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Alert: Container,
    Breadcrumb: () => null,
    Button: Container,
    Card: Container,
    Drawer: Container,
    message: { info: vi.fn(), success: vi.fn() },
    Progress: ({ percent }: { percent: number }) => (
      <output data-testid="reading-progress">{percent}</output>
    ),
    Space: Container,
    Tag: Container,
    Typography: { Title: Container, Paragraph: Container },
  };
});

import ContentDetail from './index';

describe('内容详情切换时的阅读进度', () => {
  beforeEach(() => {
    fixture.routeId = 'content-a';
    fixture.response = {
      id: 'content-a',
      type: ContentType.Markdown,
      title: '文章 A',
      body: '# A',
      tags: [],
    };
    fixture.reports.length = 0;
    localStorage.clear();
    vi.stubGlobal('scrollY', 640);
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

  it('路由已切到 B 而请求仍留 A 时，不把 A 的滚动位置归给 B', () => {
    const view = render(<ContentDetail />);
    act(() => window.dispatchEvent(new Event('scroll')));
    expect(fixture.reports.at(-1)).toMatchObject({
      contentId: 'content-a',
      scrollY: 640,
    });

    fixture.routeId = 'content-b';
    view.rerender(<ContentDetail />);
    fixture.reports.length = 0;
    act(() => window.dispatchEvent(new Event('scroll')));
    expect(fixture.reports).toEqual([]);
  });

  it.each([
    true,
    false,
  ])('切到 %s 顶部记录的文章时，进度条不继承上一篇', (hasTopRecord) => {
    setReadingProgress('content-a', {
      scrollY: 640,
      percent: 60,
      kind: 'scroll',
    });
    if (hasTopRecord) {
      setReadingProgress('content-b', {
        scrollY: 0,
        percent: 0,
        kind: 'scroll',
      });
    }
    const view = render(<ContentDetail />);
    expect(view.getByTestId('reading-progress').textContent).toBe('60');

    fixture.routeId = 'content-b';
    fixture.response = {
      ...fixture.response,
      id: 'content-b',
      title: '文章 B',
      body: '# B',
    };
    view.rerender(<ContentDetail />);
    expect(view.getByTestId('reading-progress').textContent).toBe('0');
  });

  it('切到已有非零进度的文章时显示该文章自己的百分比', () => {
    setReadingProgress('content-a', {
      scrollY: 640,
      percent: 60,
      kind: 'scroll',
    });
    setReadingProgress('content-b', {
      scrollY: 420,
      percent: 35,
      kind: 'scroll',
    });
    const view = render(<ContentDetail />);
    expect(view.getByTestId('reading-progress').textContent).toBe('60');

    fixture.routeId = 'content-b';
    fixture.response = {
      ...fixture.response,
      id: 'content-b',
      title: '文章 B',
      body: '# B',
    };
    view.rerender(<ContentDetail />);
    expect(view.getByTestId('reading-progress').textContent).toBe('35');
  });
});
