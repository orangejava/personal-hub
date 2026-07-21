/**
 * Mock 小册章节
 */
import type { BookletChapter } from '@personal-hub/shared-types';

export const mockBooklets = [
  {
    id: 'c-book-01',
    title: 'React 基础小册',
    author: '本地文档',
    summary: '从零开始理解 React 核心概念。',
    categorySlug: 'frontend',
    tags: ['react', 'booklet'],
    source: 'mock' as const,
    chapterCount: 3,
  },
];

export const mockChapters: BookletChapter[] = [
  {
    id: 'c-book-01-ch-01',
    bookletId: 'c-book-01',
    order: 1,
    title: 'React 简介',
    body: '# React 简介\n\nReact 是声明式 UI 库，通过组件组合构建界面。\n\n## 要点\n\n- 声明式\n- 组件化\n- 状态驱动',
    toc: [
      { level: 2, text: '要点', anchor: '要点' },
    ],
  },
  {
    id: 'c-book-01-ch-02',
    bookletId: 'c-book-01',
    order: 2,
    title: '环境搭建',
    body: '# 环境搭建\n\n推荐使用 Vite 或 Umi 创建 React 工程。',
    toc: [],
  },
  {
    id: 'c-book-01-ch-03',
    bookletId: 'c-book-01',
    order: 3,
    title: '组件基础',
    body: '# 组件基础\n\nReact 组件是返回 JSX 的函数。',
    toc: [],
  },
];
