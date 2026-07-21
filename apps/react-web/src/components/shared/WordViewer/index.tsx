import { renderAsync } from 'docx-preview';
import React, { useEffect, useRef, useState } from 'react';
import ResultState from '../ResultState';
import SectionSkeleton from '../SectionSkeleton';

type WordViewerProps = {
  url: string;
};

/** Word（.docx）在线预览 */
const WordViewer: React.FC<WordViewerProps> = ({ url }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;
    setLoading(true);
    setError(undefined);
    el.innerHTML = '';

    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        await renderAsync(buf, el, undefined, {
          className: 'ph-word-docx',
          inWrapper: true,
        });
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '加载失败');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) {
    return (
      <ResultState
        status="error"
        title="Word 文档加载失败"
        description={error}
      />
    );
  }

  return (
    <div className="ph-word-viewer ph-viewer-frame">
      {loading && <SectionSkeleton variant="media" minHeight={420} />}
      <div ref={containerRef} />
    </div>
  );
};

export default WordViewer;
