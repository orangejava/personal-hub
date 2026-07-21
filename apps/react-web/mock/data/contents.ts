/**
 * Mock 内容数据：覆盖各类型、状态、可见性
 */
import {
  ContentType,
  ContentStatus,
  ContentVisibility,
  type ContentItem,
  type ContentDetail,
} from '@personal-hub/shared-types';

export const contents: ContentItem[] = [
  {
    id: 'c-md-01',
    title: 'React 服务端渲染入门',
    type: ContentType.Markdown,
    summary: '理解 SSR 的本质，以及在 React 中如何落地。',
    cover: 'https://api.dicebear.com/7.x/shapes/svg?seed=ssr',
    categorySlug: 'frontend',
    tags: ['react', 'umi'],
    viewCount: 320,
    favoriteCount: 24,
    publishedAt: '2026-06-10T10:00:00Z',
    author: '编辑者',
    status: ContentStatus.Draft,
    visibility: ContentVisibility.Login,
    createdAt: '2026-06-10T10:00:00Z',
    updatedAt: '2026-06-10T10:00:00Z',
  },
  {
    id: 'c-md-02',
    title: 'NestJS 模块化设计实践',
    type: ContentType.Markdown,
    summary: '如何用模块边界组织一个可维护的后端。',
    cover: 'https://api.dicebear.com/7.x/shapes/svg?seed=nestjs',
    categorySlug: 'backend',
    tags: ['nestjs'],
    viewCount: 210,
    favoriteCount: 18,
    publishedAt: '2026-06-12T10:00:00Z',
    author: '编辑者',
    status: ContentStatus.Published,
    visibility: ContentVisibility.Public,
    createdAt: '2026-06-12T10:00:00Z',
    updatedAt: '2026-06-12T10:00:00Z',
  },
  {
    id: 'c-book-01',
    title: 'React 基础小册',
    type: ContentType.Booklet,
    summary: '从零开始理解 React 核心概念。',
    cover: 'https://api.dicebear.com/7.x/shapes/svg?seed=react-basic',
    categorySlug: 'frontend',
    tags: ['react', 'booklet'],
    viewCount: 540,
    favoriteCount: 60,
    publishedAt: '2026-05-20T10:00:00Z',
    author: '本地文档',
    status: ContentStatus.Published,
    visibility: ContentVisibility.Public,
    createdAt: '2026-05-20T10:00:00Z',
    updatedAt: '2026-05-20T10:00:00Z',
  },
  {
    id: 'c-pdf-01',
    title: '系统设计面试指南（PDF）',
    type: ContentType.Pdf,
    summary: 'PDF 内容占位，本阶段不提供在线预览。',
    cover: 'https://api.dicebear.com/7.x/shapes/svg?seed=pdf',
    categorySlug: 'engineering',
    tags: [],
    viewCount: 88,
    favoriteCount: 5,
    publishedAt: '2026-04-01T10:00:00Z',
    author: '编辑者',
    status: ContentStatus.Draft,
    visibility: ContentVisibility.Public,
    createdAt: '2026-04-01T10:00:00Z',
    updatedAt: '2026-04-01T10:00:00Z',
  },
  {
    id: 'c-link-01',
    title: 'Ant Design 官网',
    type: ContentType.Link,
    summary: '外链内容示例。',
    categorySlug: 'frontend',
    tags: ['react'],
    viewCount: 40,
    favoriteCount: 2,
    publishedAt: '2026-03-01T10:00:00Z',
    author: '编辑者',
    status: ContentStatus.Published,
    visibility: ContentVisibility.Login,
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 'c-word-01',
    title: '产品需求文档模板（Word）',
    type: ContentType.Word,
    summary: 'Word 内容占位，阶段 4+ 使用 docx-preview 在线预览。',
    cover: 'https://api.dicebear.com/7.x/shapes/svg?seed=word',
    categorySlug: 'engineering',
    tags: ['word'],
    viewCount: 56,
    favoriteCount: 3,
    publishedAt: '2026-04-15T10:00:00Z',
    author: '编辑者',
    status: ContentStatus.Published,
    visibility: ContentVisibility.Public,
    createdAt: '2026-04-15T10:00:00Z',
    updatedAt: '2026-04-15T10:00:00Z',
  },
  {
    id: 'c-rt-01',
    title: '协作编辑方案说明（富文本）',
    type: ContentType.RichText,
    summary: '富文本占位，后续基于 Textbus 实现编辑与阅读。',
    cover: 'https://api.dicebear.com/7.x/shapes/svg?seed=richtext',
    categorySlug: 'engineering',
    tags: ['textbus'],
    viewCount: 72,
    favoriteCount: 6,
    publishedAt: '2026-05-01T10:00:00Z',
    author: '编辑者',
    status: ContentStatus.Published,
    visibility: ContentVisibility.Public,
    createdAt: '2026-05-01T10:00:00Z',
    updatedAt: '2026-05-01T10:00:00Z',
  },
  {
    id: 'c-proj-01',
    title: 'Personal Hub 开源项目',
    type: ContentType.Project,
    summary: '项目类型内容占位，展示仓库与简介。',
    cover: 'https://api.dicebear.com/7.x/shapes/svg?seed=project',
    categorySlug: 'engineering',
    tags: ['monorepo'],
    viewCount: 120,
    favoriteCount: 15,
    publishedAt: '2026-05-10T10:00:00Z',
    author: '编辑者',
    status: ContentStatus.Archived,
    visibility: ContentVisibility.Public,
    createdAt: '2026-05-10T10:00:00Z',
    updatedAt: '2026-05-10T10:00:00Z',
  },
];

/** 构造详情：列表项 + 正文 + 状态 + 外链 */
export function buildDetail(id: string): ContentDetail | undefined {
  const item = contents.find((c) => c.id === id);
  if (!item) return undefined;
  return {
    ...item,
    status: item.status ?? ContentStatus.Published,
    visibility: item.visibility ?? ContentVisibility.Public,
    body:
      item.type === ContentType.Markdown
        ? `# ${item.title}\n\n这是一篇示例 Markdown 正文，用于验证阅读页渲染。\n\n## 要点\n\n- 标题与时间展示\n- 正文渲染与代码块\n- 右侧目录\n\n\`\`\`ts\nconst hello = 'personal-hub';\nconsole.log(hello);\n\`\`\`\n`
        : item.type === ContentType.RichText
          ? '<h2>协作编辑方案说明</h2><p>富文本只读预览（mock HTML）。完整 Textbus delta 渲染后续接入。</p><ul><li>支持标题与列表</li><li>阶段 4 先跑通阅读链路</li></ul>'
          : undefined,
    link: item.type === ContentType.Link ? 'https://ant.design' : undefined,
    previewUrl:
      item.type === ContentType.Pdf
        ? '/samples/sample.pdf'
        : item.type === ContentType.Word
          ? '/samples/sample.docx'
          : undefined,
    createdAt: item.createdAt ?? item.publishedAt,
    updatedAt: item.updatedAt ?? item.publishedAt,
  };
}
