import React, { useEffect, useState } from 'react';
import { slugifyHeading, stripMarkdownInline } from '@/utils/markdown';

export interface TocItem {
  level: number;
  text: string;
  anchor: string;
}

interface TocPanelProps {
  items: TocItem[];
}

/** 解析目录锚点：兼容旧数据（anchor 含 **）与新 slug 规则 */
function resolveAnchor(item: TocItem): string {
  const candidates = [
    slugifyHeading(item.text || item.anchor),
    slugifyHeading(item.anchor),
    item.anchor,
    stripMarkdownInline(item.anchor),
  ];
  for (const id of candidates) {
    if (id && document.getElementById(id)) return id;
  }
  return slugifyHeading(item.text || item.anchor);
}

/** 右侧目录：点击锚点 + IntersectionObserver 滚动高亮 */
const TocPanel: React.FC<TocPanelProps> = ({ items }) => {
  const normalized = items.map((it) => ({
    ...it,
    text: stripMarkdownInline(it.text),
    anchor: slugifyHeading(it.text || it.anchor),
  }));

  const [activeAnchor, setActiveAnchor] = useState(
    normalized[0]?.anchor ?? '',
  );

  useEffect(() => {
    if (!normalized.length) return;

    const elements = normalized
      .map((it) => document.getElementById(it.anchor))
      .filter((el): el is HTMLElement => !!el);

    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const top = visible[0]?.target;
        if (top?.id) setActiveAnchor(top.id);
      },
      {
        root: null,
        rootMargin: '-72px 0px -55% 0px',
        threshold: [0, 0.25, 0.5, 1],
      },
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [normalized]);

  if (!normalized.length) return null;

  const scrollTo = (item: TocItem) => {
    const id = resolveAnchor(item);
    document.getElementById(id)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
    setActiveAnchor(id);
  };

  return (
    <nav>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>目录</div>
      <ul className="ph-toc-list">
        {normalized.map((it) => (
          <li
            key={`${it.anchor}-${it.text}`}
            style={{ marginLeft: (it.level - 2) * 12, marginBottom: 4 }}
          >
            <a
              href={`#${it.anchor}`}
              className={
                activeAnchor === it.anchor ? 'ph-toc-link active' : 'ph-toc-link'
              }
              onClick={(event) => {
                event.preventDefault();
                scrollTo(it);
              }}
            >
              {it.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default TocPanel;
