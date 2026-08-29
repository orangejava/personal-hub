import {
  CaretDownOutlined,
  CaretRightOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { Button } from 'antd';
import clsx from 'clsx';
import React, { useEffect, useMemo, useState } from 'react';
import EllipsisTooltip from '@/components/shared/EllipsisTooltip';
import { slugifyHeading, stripMarkdownInline } from '@/utils/markdown';

export interface TocItem {
  level: number;
  text: string;
  anchor: string;
}

interface TocTreeNode extends TocItem {
  key: string;
  children: TocTreeNode[];
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

/** 扁平 toc 按 heading level 建树，供折叠与缩进 */
function buildTocTree(items: TocItem[]): TocTreeNode[] {
  const root: TocTreeNode[] = [];
  const stack: TocTreeNode[] = [];

  for (const [index, item] of items.entries()) {
    const node: TocTreeNode = {
      ...item,
      key: `${item.anchor}-${index}`,
      children: [],
    };
    while (stack.length && stack[stack.length - 1].level >= item.level) {
      stack.pop();
    }
    if (!stack.length) {
      root.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }
    stack.push(node);
  }
  return root;
}

/** 收集所有有子节点的 key（用于全部展开） */
function collectExpandableKeys(nodes: TocTreeNode[]): string[] {
  const keys: string[] = [];
  const walk = (list: TocTreeNode[]) => {
    for (const n of list) {
      if (n.children.length) {
        keys.push(n.key);
        walk(n.children);
      }
    }
  };
  walk(nodes);
  return keys;
}

/**
 * 右侧文章大纲：语雀风格顶栏 + 树折叠 + 眼睛钉住 / hover 临时展开。
 * 槽位宽度始终保留，隐藏时主栏不加宽。
 */
const TocPanel: React.FC<TocPanelProps> = ({ items }) => {
  const normalized = useMemo(
    () =>
      items.map((it) => ({
        ...it,
        text: stripMarkdownInline(it.text),
        anchor: slugifyHeading(it.text || it.anchor),
      })),
    [items],
  );

  const tree = useMemo(() => buildTocTree(normalized), [normalized]);
  const expandableKeys = useMemo(() => collectExpandableKeys(tree), [tree]);
  const canCollapseAll = expandableKeys.length > 0;

  // 默认全部展开；「全部折叠」收起到仅展示二级（h2）标题
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(
    () => new Set(expandableKeys),
  );
  const [pinned, setPinned] = useState(true);
  const [hovering, setHovering] = useState(false);

  // toc 变化时重置为全部展开（不持久化展开状态）
  useEffect(() => {
    setExpandedKeys(new Set(expandableKeys));
  }, [expandableKeys]);

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
        const visibleEntries = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const top = visibleEntries[0]?.target;
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

  const panelOpen = pinned || hovering;
  const allExpanded =
    expandableKeys.length > 0 &&
    expandableKeys.every((k) => expandedKeys.has(k));

  const scrollTo = (item: TocItem) => {
    const id = resolveAnchor(item);
    document.getElementById(id)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
    setActiveAnchor(id);
  };

  const toggleNode = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleExpandAll = () => {
    // 全部折叠：收起到二级（清空展开集，仅显示根级 h2）
    if (allExpanded) setExpandedKeys(new Set());
    else setExpandedKeys(new Set(expandableKeys));
  };

  const renderNodes = (nodes: TocTreeNode[], depth = 0): React.ReactNode =>
    nodes.map((node) => {
      const hasChildren = node.children.length > 0;
      const expanded = expandedKeys.has(node.key);
      const isActive = activeAnchor === node.anchor;

      return (
        <li key={node.key} className="ph-outline-item">
          <div
            className={clsx('ph-outline-row', isActive && 'active')}
            style={{ paddingLeft: 8 + depth * 12 }}
          >
            {hasChildren ? (
              <button
                type="button"
                className="ph-outline-caret"
                aria-label={expanded ? '折叠' : '展开'}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleNode(node.key);
                }}
              >
                {expanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
              </button>
            ) : (
              <span className="ph-outline-caret-spacer" />
            )}
            <a
              href={`#${node.anchor}`}
              className={clsx('ph-toc-link', isActive && 'active')}
              onClick={(event) => {
                event.preventDefault();
                scrollTo(node);
              }}
            >
              <EllipsisTooltip title={node.text} lines={1} />
            </a>
          </div>
          {hasChildren && expanded ? (
            <ul className="ph-outline-children">
              {renderNodes(node.children, depth + 1)}
            </ul>
          ) : null}
        </li>
      );
    });

  return (
    <nav
      className={clsx('ph-outline', panelOpen && 'ph-outline-open')}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      aria-label="文章大纲"
    >
      <div className="ph-outline-header">
        {panelOpen ? <span className="ph-outline-title">大纲</span> : null}
        <div className="ph-outline-actions">
          {panelOpen && canCollapseAll ? (
            <Button
              type="text"
              size="small"
              aria-label={allExpanded ? '全部折叠' : '全部展开'}
              icon={
                allExpanded ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />
              }
              onClick={toggleExpandAll}
            />
          ) : null}
          <Button
            type="text"
            size="small"
            aria-label={pinned ? '隐藏大纲' : '显示大纲'}
            icon={pinned ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            onClick={() => setPinned((v) => !v)}
          />
        </div>
      </div>
      {panelOpen ? (
        <div className="ph-outline-body">
          <ul className="ph-outline-list">{renderNodes(tree)}</ul>
        </div>
      ) : null}
    </nav>
  );
};

export default TocPanel;
