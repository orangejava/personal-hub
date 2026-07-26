import { Link } from '@umijs/max';
import { Button, Space } from 'antd';
import React from 'react';

export interface BookletChapterFooterProps {
  /** 上一章 id，无则按钮禁用 */
  prevId?: string;
  /** 下一章 id，无则按钮禁用 */
  nextId?: string;
  /** 点击上一章 / 下一章 */
  onNavigate: (chapterId: string) => void;
  /** 「返回内容中心」链接，默认 /content */
  backHref?: string;
  /** 是否渲染右侧大纲列占位（与中间区列宽对齐） */
  showTocColumn?: boolean;
}

/**
 * 小册章节底栏：列宽与正文+大纲一致；上下章在正文列内居中，返回链接在大纲列。
 */
const BookletChapterFooter: React.FC<BookletChapterFooterProps> = ({
  prevId,
  nextId,
  onNavigate,
  backHref = '/content',
  showTocColumn = true,
}) => (
  <footer className="ph-booklet-columns ph-booklet-footer">
    <div className="ph-booklet-footer-main">
      <Space size="middle" className="ph-booklet-footer-nav">
        <Button
          type="primary"
          disabled={!prevId}
          onClick={() => prevId && onNavigate(prevId)}
        >
          上一章
        </Button>
        <Button
          type="primary"
          disabled={!nextId}
          onClick={() => nextId && onNavigate(nextId)}
        >
          下一章
        </Button>
      </Space>
    </div>
    {showTocColumn ? (
      <div className="ph-booklet-footer-toc">
        <Link to={backHref}>返回内容中心</Link>
      </div>
    ) : null}
  </footer>
);

export default BookletChapterFooter;
