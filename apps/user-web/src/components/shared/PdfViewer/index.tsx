import { Document, Page, pdfjs } from 'react-pdf';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
};

/** PDF 预览。worker 走本地 public；disableWorker 是为了 mock 开发态稳定，大文件后再开。 */
const PdfViewer: React.FC<PdfViewerProps> = ({ url }) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState<string>();
  const [fileData, setFileData] = useState<Uint8Array>();
  const [pageWidth, setPageWidth] = useState(820);
  const pageNumbers = Array.from({ length: numPages }, (_, i) => i + 1);
  const documentFile = useMemo(
    () => (fileData ? { data: fileData } : undefined),
    [fileData],
  );

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const syncWidth = () => {
      // PDF 页宽跟随容器，桌面最多 820px，窄屏预留滚动条和内边距空间。
      setPageWidth(Math.max(280, Math.min(820, frame.clientWidth - 24)));
    };
    syncWidth();

    const observer = new ResizeObserver(syncWidth);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
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
    };
  }, [url]);

  if (error) {
    return (
      <ResultState
        status="error"
        title="PDF 加载失败"
        description={error}
      />
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
        onLoadSuccess={({ numPages: n }) => setNumPages(n)}
        onLoadError={(e) => setError(e.message)}
      >
        {pageNumbers.map((pageNumber) => (
          <Page
            key={`page-${pageNumber}`}
            pageNumber={pageNumber}
            width={pageWidth}
          />
        ))}
      </Document>
    </div>
  );
};

export default PdfViewer;
