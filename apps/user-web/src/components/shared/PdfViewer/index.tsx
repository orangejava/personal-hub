import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import ResultState from '../ResultState';
import SectionSkeleton from '../SectionSkeleton';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// 本地 public 目录 worker，避免 CDN / 打包路径问题
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

const documentOptions = {
  disableAutoFetch: true,
  disableStream: true,
  // mock 预览优先保证开发态稳定；大文件性能优化后续再恢复 worker。
  disableWorker: true,
};

type PdfViewerProps = {
  url: string;
  initialPage?: number;
  onPageChange?: (page: number, totalPages: number) => void;
};

/** PDF 预览。worker 走本地 public；disableWorker 是为了 mock 开发态稳定，大文件后再开。 */
const PdfViewer: React.FC<PdfViewerProps> = ({
  url,
  initialPage,
  onPageChange,
}) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const pageElementsRef = useRef(new Map<number, HTMLDivElement>());
  const onPageChangeRef = useRef(onPageChange);
  const initialPageRef = useRef(initialPage);
  const restoreTargetRef = useRef<number | undefined>(undefined);
  const renderedPagesRef = useRef(new Set<number>());
  const contiguousRenderedPageRef = useRef(0);
  const restoredDocumentRef = useRef<string | null>(null);
  const restoreScheduledRef = useRef<string | null>(null);
  const loadedDocumentRef = useRef<string | null>(null);
  const currentPageRef = useRef(0);
  const restoreFrameRef = useRef<number | undefined>(undefined);
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState<string>();
  const [fileData, setFileData] = useState<Uint8Array>();
  const [pageWidth, setPageWidth] = useState(820);
  const pageNumbers = Array.from({ length: numPages }, (_, i) => i + 1);
  const documentFile = useMemo(
    () => (fileData ? { data: fileData } : undefined),
    [fileData],
  );
  onPageChangeRef.current = onPageChange;
  initialPageRef.current = initialPage;

  const publishVisiblePage = useCallback(() => {
    const mostVisible = Array.from(pageElementsRef.current.entries())
      .map(([page, element]) => {
        const rect = element.getBoundingClientRect();
        const visibleHeight = Math.max(
          0,
          Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0),
        );
        return {
          page,
          ratio: rect.height > 0 ? visibleHeight / rect.height : 0,
        };
      })
      .sort((left, right) => right.ratio - left.ratio)[0];
    const page = mostVisible?.page;
    if (!page || mostVisible.ratio <= 0 || page === currentPageRef.current)
      return;
    currentPageRef.current = page;
    onPageChangeRef.current?.(page, numPages);
  }, [numPages]);

  const handlePageRenderSuccess = useCallback(
    (pageNumber: number) => {
      renderedPagesRef.current.add(pageNumber);
      const targetPage = restoreTargetRef.current;
      if (
        !targetPage ||
        loadedDocumentRef.current !== url ||
        restoredDocumentRef.current === url ||
        restoreScheduledRef.current === url
      ) {
        return;
      }
      while (
        renderedPagesRef.current.has(contiguousRenderedPageRef.current + 1)
      ) {
        contiguousRenderedPageRef.current += 1;
      }
      // 目标页上方的画布都完成绘制后，其纵向偏移才稳定，可以准确恢复位置。
      if (contiguousRenderedPageRef.current < Math.min(targetPage, numPages))
        return;
      const target = pageElementsRef.current.get(
        Math.min(targetPage, numPages),
      );
      if (!target) return;
      restoreScheduledRef.current = url;
      restoreFrameRef.current = window.requestAnimationFrame(() => {
        target.scrollIntoView({ block: 'start' });
        restoredDocumentRef.current = url;
        restoreFrameRef.current =
          window.requestAnimationFrame(publishVisiblePage);
      });
    },
    [numPages, publishVisiblePage, url],
  );

  const handlePageUnavailable = useCallback(
    (pageNumber: number) => {
      const targetPage = restoreTargetRef.current;
      if (
        !targetPage ||
        loadedDocumentRef.current !== url ||
        pageNumber > Math.min(targetPage, numPages)
      ) {
        return;
      }
      // 目标页之前任一页失败都无法可靠计算恢复偏移；放弃自动恢复，继续记录用户实际浏览页。
      restoreTargetRef.current = undefined;
      restoredDocumentRef.current = url;
      restoreScheduledRef.current = null;
      if (restoreFrameRef.current !== undefined) {
        window.cancelAnimationFrame(restoreFrameRef.current);
        restoreFrameRef.current = undefined;
      }
      publishVisiblePage();
    },
    [numPages, publishVisiblePage, url],
  );

  useEffect(() => {
    // 文件加载前只渲染骨架屏；等 PDF 容器真正挂载后再测量并监听宽度。
    if (!documentFile || error) return;
    const frame = frameRef.current;
    if (!frame) return;

    const syncWidth = () => {
      // PDF 页宽跟随实际容器；极窄屏也不能被 280px 下限撑出横向滚动。
      if (frame.clientWidth > 24) {
        setPageWidth(Math.min(820, frame.clientWidth - 24));
      }
    };
    syncWidth();

    const observer = new ResizeObserver(syncWidth);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [documentFile, error]);

  useEffect(() => {
    let cancelled = false;
    if (restoreFrameRef.current !== undefined) {
      window.cancelAnimationFrame(restoreFrameRef.current);
      restoreFrameRef.current = undefined;
    }
    restoredDocumentRef.current = null;
    restoreScheduledRef.current = null;
    loadedDocumentRef.current = null;
    restoreTargetRef.current = undefined;
    renderedPagesRef.current.clear();
    contiguousRenderedPageRef.current = 0;
    currentPageRef.current = 0;
    setError(undefined);
    setNumPages(0);
    setFileData(undefined);

    // 先把 mock 文件读取为 ArrayBuffer，规避开发态 PDF.js stream transport 兼容问题。
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buffer) => {
        if (!cancelled) setFileData(new Uint8Array(buffer));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败');
      });

    return () => {
      cancelled = true;
      if (restoreFrameRef.current !== undefined) {
        window.cancelAnimationFrame(restoreFrameRef.current);
        restoreFrameRef.current = undefined;
      }
    };
  }, [url]);

  useEffect(() => {
    if (
      !numPages ||
      !frameRef.current ||
      typeof IntersectionObserver === 'undefined'
    )
      return;
    const observed = Array.from(pageElementsRef.current.entries());
    const observer = new IntersectionObserver(
      () => {
        if (restoreTargetRef.current && restoredDocumentRef.current !== url)
          return;
        // 页面进入和离开都需重新计算：超长页可见比例可能始终达不到 25%。
        publishVisiblePage();
      },
      { threshold: [0, 0.25, 0.5, 0.75] },
    );
    observed.forEach(([, element]) => {
      observer.observe(element);
    });
    return () => observer.disconnect();
  }, [numPages, publishVisiblePage, url]);

  if (error) {
    return (
      <ResultState status="error" title="PDF 加载失败" description={error} />
    );
  }

  if (!documentFile) {
    return <SectionSkeleton variant="media" minHeight={420} />;
  }

  return (
    <div ref={frameRef} className="ph-pdf-viewer ph-viewer-frame">
      <Document
        file={documentFile}
        options={documentOptions}
        loading={<SectionSkeleton variant="media" minHeight={420} />}
        onLoadSuccess={({ numPages: n }) => {
          loadedDocumentRef.current = url;
          restoreTargetRef.current = initialPageRef.current;
          setNumPages(n);
        }}
        onLoadError={(e) => setError(e.message)}
      >
        {pageNumbers.map((pageNumber) => (
          <div
            key={`page-${pageNumber}`}
            ref={(element) => {
              if (element) pageElementsRef.current.set(pageNumber, element);
              else pageElementsRef.current.delete(pageNumber);
            }}
            data-pdf-page={pageNumber}
          >
            <Page
              pageNumber={pageNumber}
              width={pageWidth}
              onRenderSuccess={() => handlePageRenderSuccess(pageNumber)}
              onLoadError={() => handlePageUnavailable(pageNumber)}
              onRenderError={() => handlePageUnavailable(pageNumber)}
            />
          </div>
        ))}
      </Document>
    </div>
  );
};

export default PdfViewer;
