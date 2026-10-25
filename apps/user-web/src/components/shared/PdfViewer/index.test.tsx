import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const observers: Array<{
  callback: IntersectionObserverCallback;
  elements: Element[];
}> = [];
const resizeObservers: Array<{
  callback: ResizeObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}> = [];
const initialViewportHeight = window.innerHeight;

vi.mock('react-pdf', async () => {
  const React = await import('react');
  return {
    pdfjs: { GlobalWorkerOptions: { workerSrc: '' } },
    Document: ({
      children,
      onLoadSuccess,
    }: {
      children: React.ReactNode;
      onLoadSuccess: (result: { numPages: number }) => void;
    }) => {
      React.useEffect(() => onLoadSuccess({ numPages: 3 }), []);
      return <div>{children}</div>;
    },
    Page: ({
      pageNumber,
      width,
      onRenderError,
      onLoadError,
    }: {
      pageNumber: number;
      width: number;
      onRenderError: (error: Error) => void;
      onLoadError: (error: Error) => void;
    }) => (
      <>
        <span data-testid={`page-width-${pageNumber}`}>{width}</span>
        <button
          type="button"
          data-testid={`render-error-${pageNumber}`}
          onClick={() => onRenderError(new Error('render failed'))}
        >
          Render error
        </button>
        <button
          type="button"
          data-testid={`load-error-${pageNumber}`}
          onClick={() => onLoadError(new Error('load failed'))}
        >
          Load error
        </button>
      </>
    ),
  };
});

vi.mock('../ResultState', () => ({ default: () => <div>Result state</div> }));
vi.mock('../SectionSkeleton', () => ({ default: () => <div>Loading</div> }));

import PdfViewer from './index';

class TestIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    observers.push({ callback, elements: [] });
  }

  observe(element: Element) {
    observers.at(-1)?.elements.push(element);
  }

  disconnect() {}
}

function emitIntersection(pageIndex: number, isIntersecting: boolean) {
  const current = observers.at(-1);
  current?.callback(
    [
      {
        target: current.elements[pageIndex],
        isIntersecting,
      } as IntersectionObserverEntry,
    ],
    {} as IntersectionObserver,
  );
}

function pageRect(top: number, height: number): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    bottom: top + height,
    left: 0,
    right: 100,
    width: 100,
    height,
    toJSON: () => ({}),
  };
}

describe('PdfViewer 页面渲染失败恢复', () => {
  beforeEach(() => {
    observers.length = 0;
    resizeObservers.length = 0;
    vi.stubGlobal('IntersectionObserver', TestIntersectionObserver);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        disconnect = vi.fn();

        constructor(callback: ResizeObserverCallback) {
          resizeObservers.push({ callback, observe: this.observe, disconnect: this.disconnect });
        }
      },
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: initialViewportHeight,
    });
  });

  it.each([
    'render',
    'load',
  ])('恢复目标前一页 %s 失败后，仍采集随后滚入视口的页', async (failureKind) => {
    const onPageChange = vi.fn();
    let firstPageVisible = true;
    const view = render(
      <PdfViewer
        url="/sample.pdf"
        initialPage={2}
        onPageChange={onPageChange}
      />,
    );

    await waitFor(() => expect(observers.length).toBeGreaterThan(0));
    view.container
      .querySelectorAll<HTMLElement>('[data-pdf-page]')
      .forEach((page, index) => {
        vi.spyOn(page, 'getBoundingClientRect').mockImplementation(() =>
          pageRect(
            index === 0
              ? firstPageVisible
                ? 0
                : -900
              : firstPageVisible
                ? 900
                : 0,
            100,
          ),
        );
      });
    emitIntersection(0, true);
    expect(onPageChange).not.toHaveBeenCalled();

    fireEvent.click(view.getByTestId(`${failureKind}-error-1`));
    expect(onPageChange).toHaveBeenCalledWith(1, 3);
    onPageChange.mockClear();
    firstPageVisible = false;
    emitIntersection(0, false);

    expect(onPageChange).toHaveBeenCalledWith(2, 3);
  });

  it('超长 PDF 页面离开视口后更新到下一页', async () => {
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 600,
    });
    const onPageChange = vi.fn();
    let scrollY = 0;
    const view = render(
      <PdfViewer url="/long.pdf" onPageChange={onPageChange} />,
    );
    await waitFor(() => expect(observers.length).toBeGreaterThan(0));
    view.container
      .querySelectorAll<HTMLElement>('[data-pdf-page]')
      .forEach((page, index) => {
        vi.spyOn(page, 'getBoundingClientRect').mockImplementation(() =>
          pageRect(index * 3000 - scrollY, 3000),
        );
      });

    emitIntersection(0, true);
    expect(onPageChange).toHaveBeenLastCalledWith(1, 3);
    scrollY = 2401;
    emitIntersection(1, true);
    scrollY = 3001;
    emitIntersection(0, false);

    expect(onPageChange).toHaveBeenLastCalledWith(2, 3);
  });

  it('文件加载后才监听容器宽度，并在窄屏和尺寸变化时更新页宽', async () => {
    let containerWidth = 360;
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockImplementation(() => containerWidth);
    try {
      const view = render(<PdfViewer url="/responsive.pdf" />);
      expect(resizeObservers).toHaveLength(0);

      await waitFor(() => expect(view.getByTestId('page-width-1').textContent).toBe('336'));
      expect(resizeObservers).toHaveLength(1);
      expect(resizeObservers[0].observe).toHaveBeenCalledWith(
        view.container.querySelector('.ph-pdf-viewer'),
      );

      containerWidth = 600;
      act(() => resizeObservers[0].callback([], {} as ResizeObserver));
      await waitFor(() => expect(view.getByTestId('page-width-1').textContent).toBe('576'));

      containerWidth = 260;
      act(() => resizeObservers[0].callback([], {} as ResizeObserver));
      await waitFor(() => expect(view.getByTestId('page-width-1').textContent).toBe('236'));

      view.unmount();
      expect(resizeObservers[0].disconnect).toHaveBeenCalledOnce();
    } finally {
      width.mockRestore();
    }
  });
});
