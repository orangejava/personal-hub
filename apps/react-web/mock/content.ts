/**
 * 内容中心 mock 接口
 */
import type { Request, Response } from 'express';
import {
  ContentStatus,
  ContentType,
  ContentVisibility,
  type ContentItem,
} from '@personal-hub/shared-types';
import { contents, buildDetail } from './data/contents';

/** 分类与标签（内联，避免 mock 子文件被构建检查拦截） */
const categories = [
  { slug: 'frontend', name: '前端', count: 12 },
  { slug: 'backend', name: '后端', count: 8 },
  { slug: 'engineering', name: '工程', count: 6 },
  { slug: 'ai', name: 'AI', count: 4 },
];
const tags = [
  { slug: 'react', name: 'React', count: 10 },
  { slug: 'umi', name: 'Umi', count: 5 },
  { slug: 'nestjs', name: 'NestJS', count: 3 },
  { slug: 'markdown', name: 'Markdown', count: 7 },
  { slug: 'booklet', name: '小册', count: 4 },
];
import { mockBooklets, mockChapters } from './data/chapters';
import { localBooklets, localBookletChapters } from './data/local-booklets.generated';
import { ok, fail, parsePagination } from './utils';

/** 本地小册转成内容中心列表项，让同步后能在公开内容中心展示 */
function buildLocalContentItems(): ContentItem[] {
  return localBooklets.map((b) => ({
    id: b.id,
    title: b.title,
    type: ContentType.Booklet,
    summary: b.summary || '本地同步小册',
    cover: b.cover,
    categorySlug: b.categorySlug ?? 'frontend',
    tags: b.tags ?? ['booklet'],
    viewCount: 0,
    favoriteCount: 0,
    publishedAt: b.syncedAt ?? new Date().toISOString(),
    author: b.author,
  }));
}

export default {
  'GET /api/contents': (req: Request, res: Response) => {
    const { page, pageSize } = parsePagination(req);
    const { keyword, type, category, tag, sort } = req.query as Record<string, string>;
    let list = [...contents, ...buildLocalContentItems()];

    if (keyword) {
      list = list.filter((c) => c.title.includes(keyword) || c.summary.includes(keyword));
    }
    if (type && type !== 'all') {
      list = list.filter((c) => c.type === (type as ContentType));
    }
    if (category) list = list.filter((c) => c.categorySlug === category);
    if (tag) {
      list = list.filter((c) =>
        c.tags?.some((t) => t.toLowerCase() === tag.toLowerCase()),
      );
    }
    if (sort === 'views') {
      list.sort((a, b) => b.viewCount - a.viewCount);
    } else {
      list.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
    }

    const total = list.length;
    const start = (page - 1) * pageSize;
    const paged = list.slice(start, start + pageSize);
    ok(res, { list: paged, total, page, pageSize });
  },

  'GET /api/contents/featured': (_req: Request, res: Response) => {
    ok(res, contents.slice(0, 3));
  },

  'GET /api/contents/meta': (_req: Request, res: Response) => {
    ok(res, { categories, tags });
  },

  'GET /api/contents/:id': (req: Request, res: Response) => {
    const id = String(req.params.id);
    const localBooklet = localBooklets.find((b) => b.id === id);
    const localItem = buildLocalContentItems().find((item) => item.id === id);
    const detail = localBooklet
      ? {
          ...(localItem as ContentItem),
          status: ContentStatus.Published,
          visibility: ContentVisibility.Public,
          createdAt: localBooklet.syncedAt ?? new Date().toISOString(),
          updatedAt: localBooklet.syncedAt ?? new Date().toISOString(),
        }
      : buildDetail(id);
    if (!detail) {
      fail(res, 404, '内容不存在');
      return;
    }
    ok(res, detail);
  },

  'GET /api/contents/:id/chapters': (req: Request, res: Response) => {
    const id = String(req.params.id);
    const allBooklets = [...mockBooklets, ...localBooklets.map((b) => ({ ...b }))];
    const booklet = allBooklets.find((b) => b.id === id);
    if (!booklet) {
      fail(res, 404, '小册不存在');
      return;
    }
    // 列表接口不返回 body，避免整本数百章一次下发（与正式 API 契约对齐）
    const chapters = [...mockChapters, ...localBookletChapters]
      .filter((c) => c.bookletId === id)
      .map(({ body: _body, ...rest }) => rest);
    ok(res, { booklet, chapters });
  },

  'GET /api/contents/:id/chapters/:chapterId': (req: Request, res: Response) => {
    const chapter = [...mockChapters, ...localBookletChapters].find(
      (c) => c.id === String(req.params.chapterId),
    );
    if (!chapter) {
      fail(res, 404, '章节不存在');
      return;
    }
    ok(res, chapter);
  },

  'POST /api/contents/:id/favorite': (req: Request, res: Response) => {
    ok(res, { contentId: req.params.id, favorited: true });
  },

  'DELETE /api/contents/:id/favorite': (req: Request, res: Response) => {
    ok(res, { contentId: req.params.id, favorited: false });
  },

  'POST /api/reading/progress': (req: Request, res: Response) => {
    ok(res, { ...req.body, updatedAt: new Date().toISOString() });
  },
};
