import type React from 'react';

/**
 * Markdown 标题/目录工具：与 MarkdownViewer 的 heading id 保持一致
 */

/** 去掉标题中的 Markdown 行内标记（**、*、`、[]() 等） */
export function stripMarkdownInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

/** 递归提取 React 节点纯文本（含 **bold** 等子元素） */
export function flattenMarkdownText(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flattenMarkdownText).join('');
  if (typeof node === 'object' && 'props' in node) {
    return flattenMarkdownText(
      (node as React.ReactElement<{ children?: React.ReactNode }>).props
        .children,
    );
  }
  return '';
}

/** 生成 heading / 目录锚点 id（与 DOM h2/h3 id 一致） */
export function slugifyHeading(text: string): string {
  return stripMarkdownInline(text)
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fff-]+/g, '')
    .toLowerCase();
}

/** 从 Markdown 提取 h2/h3 目录项 */
export function extractMarkdownToc(md: string) {
  const items: { level: number; text: string; anchor: string }[] = [];
  const re = /^(#{2,3})\s+(.+)$/gm;
  let m = re.exec(md);
  while (m) {
    const raw = m[2].trim();
    const text = stripMarkdownInline(raw);
    items.push({ level: m[1].length, text, anchor: slugifyHeading(raw) });
    m = re.exec(md);
  }
  return items;
}
