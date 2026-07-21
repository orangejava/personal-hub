import React from 'react';
import ResultState from '../ResultState';

type RichTextViewerProps = {
  source?: string;
};

const allowedTags = new Set([
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'P',
  'UL',
  'OL',
  'LI',
  'STRONG',
  'EM',
  'CODE',
  'PRE',
  'BLOCKQUOTE',
  'BR',
]);

/**
 * 将 mock HTML 转成受控 React 节点。
 *
 * 阶段 4.5 只需要富文本阅读页稳定展示正文，因此这里保留常见排版标签，
 * 过滤脚本、样式、事件属性和未知标签，避免为了只读预览引入 XSS 风险。
 */
function renderSafeHtml(source: string): React.ReactNode[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(source, 'text/html');
  let keyIndex = 0;

  const toReactNode = (node: Node): React.ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const element = node as HTMLElement;
    const children = Array.from(element.childNodes).map(toReactNode);
    keyIndex += 1;

    if (!allowedTags.has(element.tagName)) {
      return <React.Fragment key={`rich-fragment-${keyIndex}`}>{children}</React.Fragment>;
    }

    const tagName = element.tagName.toLowerCase();
    return React.createElement(tagName, { key: `rich-node-${keyIndex}` }, children);
  };

  return Array.from(doc.body.childNodes).map(toReactNode);
}

/**
 * 富文本只读预览。
 *
 * 当前公开阅读页展示的是 mock HTML，转成受控 React 节点能避免把编辑器工具栏带入阅读场景。
 * 后续接真实后端时，应在服务端继续补 HTML 白名单清洗。
 */
const RichTextViewer: React.FC<RichTextViewerProps> = ({ source }) => {
  if (!source) {
    return (
      <ResultState
        status="empty"
        description="暂无富文本内容"
      />
    );
  }
  return (
    <div className="ph-prose ph-rich-text-viewer">
      {renderSafeHtml(source)}
    </div>
  );
};

export default RichTextViewer;
