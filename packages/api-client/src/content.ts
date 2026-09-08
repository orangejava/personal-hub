import {
  ContentStatus,
  ContentType,
  ContentVisibility,
  type Booklet,
  type BookletChapter,
  type ContentDetail,
  type ContentItem,
  type PaginationResult,
} from '@personal-hub/shared-types';
import { readNestData, type NestEnvelope } from './http';

export type NestContentType =
  | 'MARKDOWN'
  | 'RICH_TEXT'
  | 'BOOKLET'
  | 'PDF'
  | 'WORD'
  | 'LINK'
  | 'PROJECT';
export type NestContentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type NestContentVisibility = 'PUBLIC' | 'LOGIN' | 'PRIVATE';

export interface NestContentAuthor {
  id: string;
  nickname: string;
}

export interface NestContentListItem {
  id: string;
  type: NestContentType;
  title: string;
  summary: string;
  coverUrl: string | null;
  category: { slug: string; name: string } | null;
  tags: Array<{ slug: string; name: string }>;
  visibility: NestContentVisibility;
  status: NestContentStatus;
  locked: boolean;
  isFeatured: boolean;
  viewCount: number;
  favoriteCount: number;
  publishedAt: string;
  updatedAt: string;
  createdAt: string;
  author: NestContentAuthor;
}

export interface NestContentDetail extends NestContentListItem {
  isFavorited?: boolean;
  markdownSource?: string | null;
  renderedHtml?: string | null;
  toc?: Array<{ level: number; text: string; anchor: string }>;
  editorDocument?: Record<string, unknown> | null;
  externalUrl?: string | null;
  extra?: unknown;
  previewUrl?: string | null;
}

export interface NestContentPage {
  list: NestContentListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface NestChapterIndexItem {
  id: string;
  title: string;
  chapterOrder: number;
  wordCount: number;
}

const TYPE_FROM_NEST: Record<NestContentType, ContentType> = {
  MARKDOWN: ContentType.Markdown,
  RICH_TEXT: ContentType.RichText,
  BOOKLET: ContentType.Booklet,
  PDF: ContentType.Pdf,
  WORD: ContentType.Word,
  LINK: ContentType.Link,
  PROJECT: ContentType.Project,
};

const STATUS_FROM_NEST: Record<NestContentStatus, ContentStatus> = {
  DRAFT: ContentStatus.Draft,
  PUBLISHED: ContentStatus.Published,
  ARCHIVED: ContentStatus.Archived,
};

const VISIBILITY_FROM_NEST: Record<NestContentVisibility, ContentVisibility> = {
  PUBLIC: ContentVisibility.Public,
  LOGIN: ContentVisibility.Login,
  PRIVATE: ContentVisibility.Private,
};

/**
 * 前端小写枚举 / 筛选值 → Nest UPPER_SNAKE。
 * `richtext` 不能直接 toUpperCase，否则对不上 `RICH_TEXT`。
 */
export function toNestContentType(value?: string): NestContentType | undefined {
  if (!value || value === 'all') {
    return undefined;
  }
  if (value === ContentType.RichText || value === 'RICH_TEXT') {
    return 'RICH_TEXT';
  }
  const upper = value.toUpperCase();
  return upper in TYPE_FROM_NEST ? (upper as NestContentType) : undefined;
}

export function toNestContentStatus(value?: string): NestContentStatus | undefined {
  if (!value) {
    return undefined;
  }
  const upper = value.toUpperCase();
  return upper in STATUS_FROM_NEST ? (upper as NestContentStatus) : undefined;
}

export function toNestContentVisibility(value?: string): NestContentVisibility | undefined {
  if (!value) {
    return undefined;
  }
  const upper = value.toUpperCase();
  return upper in VISIBILITY_FROM_NEST ? (upper as NestContentVisibility) : undefined;
}

export function toNestPublicSort(value?: string): 'LATEST' | 'POPULAR' | undefined {
  if (!value || value === 'latest') {
    return 'LATEST';
  }
  if (value === 'views' || value === 'POPULAR') {
    return 'POPULAR';
  }
  if (value === 'LATEST') {
    return 'LATEST';
  }
  return undefined;
}

export function mapNestContentItem(
  input: NestContentListItem | NestEnvelope<NestContentListItem>,
): ContentItem {
  const row = readNestData(input);
  return {
    id: row.id,
    title: row.title,
    type: TYPE_FROM_NEST[row.type] ?? ContentType.Markdown,
    summary: row.summary ?? '',
    cover: row.coverUrl ?? undefined,
    categorySlug: row.category?.slug,
    categoryName: row.category?.name,
    tags: row.tags?.map((item) => item.name) ?? [],
    viewCount: row.viewCount,
    favoriteCount: row.favoriteCount,
    publishedAt: row.publishedAt,
    author: row.author?.nickname ?? '',
    status: STATUS_FROM_NEST[row.status] ?? ContentStatus.Draft,
    visibility: VISIBILITY_FROM_NEST[row.visibility] ?? ContentVisibility.Private,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    locked: row.locked,
    isFeatured: row.isFeatured,
  };
}

export function mapNestContentDetail(
  input: NestContentDetail | NestEnvelope<NestContentDetail>,
): ContentDetail {
  const row = readNestData(input);
  const item = mapNestContentItem(row);
  const htmlFromEditor =
    row.editorDocument &&
    typeof row.editorDocument === 'object' &&
    typeof (row.editorDocument as { html?: unknown }).html === 'string'
      ? (row.editorDocument as { html: string }).html
      : undefined;
  return {
    ...item,
    body: row.markdownSource ?? row.renderedHtml ?? htmlFromEditor,
    link: row.externalUrl ?? undefined,
    previewUrl: row.previewUrl ?? undefined,
    status: item.status ?? ContentStatus.Draft,
    visibility: item.visibility ?? ContentVisibility.Private,
    createdAt: item.createdAt ?? row.createdAt,
    updatedAt: item.updatedAt ?? row.updatedAt,
    isFavorited: row.isFavorited ?? false,
  };
}

export function mapNestContentPage(
  input: NestContentPage | NestEnvelope<NestContentPage>,
): PaginationResult<ContentItem> {
  const page = readNestData(input);
  return {
    list: (page.list ?? []).map((item) => mapNestContentItem(item)),
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
  };
}

export function mapNestChapterIndex(
  contentId: string,
  title: string,
  input: { list: NestChapterIndexItem[] } | NestEnvelope<{ list: NestChapterIndexItem[] }>,
): { booklet: Booklet; chapters: BookletChapter[] } {
  const payload = readNestData(input);
  const list = payload.list ?? [];
  return {
    booklet: {
      id: contentId,
      title,
      author: '',
      summary: '',
      chapterCount: list.length,
      source: 'mock',
    },
    chapters: list.map((item) => ({
      id: item.id,
      bookletId: contentId,
      order: item.chapterOrder,
      title: item.title,
      body: '',
      empty: true,
    })),
  };
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
