/**
 * 工作区 mock 接口
 */
import type { Request, Response } from 'express';
import {
  ContentStatus,
  ContentType,
  ContentVisibility,
  type WorkspaceStats,
  type ContinueReading,
  type ContentItem,
} from '@personal-hub/shared-types';
import { contents } from './data/contents';
import {
  aiConversations,
  deleteAiConversation,
  getWorkspaceUsageFromAiQuota,
  updateAiConversation,
} from './data/ai-store';
import { localBooklets } from './data/local-booklets.generated';
import { ok, parsePagination } from './utils';

const stats: WorkspaceStats = {
  contentCount: contents.length,
  draftCount: 2,
  publishedCount: contents.length - 2,
  favoriteCount: 12,
  bookletCount: localBooklets.length + 1,
};

const continueReading: ContinueReading[] = [
  { contentId: 'c-md-01', title: 'React 服务端渲染入门', type: 'markdown', percent: 60, updatedAt: '2026-06-26T10:00:00Z' },
  { contentId: 'c-book-01', title: 'React 基础小册', type: 'booklet', percent: 33, updatedAt: '2026-06-25T10:00:00Z' },
];

export default {
  'GET /api/workspace/stats': (_req: Request, res: Response) => {
    ok(res, stats);
  },
  'GET /api/workspace/continue-reading': (_req: Request, res: Response) => {
    ok(res, continueReading);
  },
  'GET /api/workspace/contents': (req: Request, res: Response) => {
    const { page, pageSize } = parsePagination(req);
    const { title, type, status, visibility } = req.query as Record<
      string,
      string
    >;
    let list = contents.slice();
    if (title) list = list.filter((c) => c.title.includes(title));
    if (type) list = list.filter((c) => c.type === type);
    if (status) list = list.filter((c) => c.status === status);
    if (visibility) list = list.filter((c) => c.visibility === visibility);
    ok(res, {
      list: list.slice((page - 1) * pageSize, page * pageSize),
      total: list.length,
      page,
      pageSize,
    });
  },
  'POST /api/workspace/contents': (req: Request, res: Response) => {
    const now = new Date().toISOString();
    const body = req.body || {};
    // mock 阶段补齐列表必需字段，避免页面依赖松散的 Record 数据。
    const item = {
      id: `c-new-${Date.now()}`,
      title: body.title || '未命名内容',
      type: body.type || ContentType.Markdown,
      summary: body.summary || '暂无摘要',
      cover: body.cover,
      categorySlug: body.categorySlug,
      tags: body.tags || [],
      viewCount: 0,
      favoriteCount: 0,
      publishedAt: body.status === 'published' ? now : '',
      author: '当前用户',
      status: (body.status || 'draft') as ContentStatus,
      visibility: body.visibility || ContentVisibility.Public,
      createdAt: now,
      updatedAt: now,
    };
    contents.unshift(item);
    ok(res, item);
  },
  'PUT /api/workspace/contents/:id': (req: Request, res: Response) => {
    const id = String(req.params.id);
    const idx = contents.findIndex((c) => c.id === id);
    if (idx === -1) {
      ok(res, { id, ...req.body });
      return;
    }
    contents[idx] = {
      ...contents[idx],
      ...req.body,
      updatedAt: new Date().toISOString(),
    };
    if (req.body?.status === ContentStatus.Published && !contents[idx].publishedAt) {
      contents[idx].publishedAt = contents[idx].updatedAt ?? new Date().toISOString();
    }
    ok(res, contents[idx]);
  },
  'DELETE /api/workspace/contents/:id': (req: Request, res: Response) => {
    const id = String(req.params.id);
    const idx = contents.findIndex((c) => c.id === id);
    if (idx !== -1) contents.splice(idx, 1);
    ok(res, { id });
  },
  'GET /api/workspace/booklets/local': (_req: Request, res: Response) => {
    ok(res, { booklets: localBooklets, syncedAt: localBooklets[0]?.syncedAt ?? null });
  },
  'GET /api/workspace/favorites': (_req: Request, res: Response) => {
    ok(res, { list: contents.slice(0, 2), total: 2, page: 1, pageSize: 10 });
  },
  'GET /api/workspace/usage': (_req: Request, res: Response) => {
    ok(res, getWorkspaceUsageFromAiQuota());
  },
  'GET /api/workspace/ai/history': (req: Request, res: Response) => {
    const { page, pageSize } = parsePagination(req);
    const keyword = String(req.query.keyword ?? '').trim().toLowerCase();
    let list = [...aiConversations].sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
    );
    if (keyword) {
      list = list.filter((item) => item.title.toLowerCase().includes(keyword));
    }
    ok(res, {
      list: list.slice((page - 1) * pageSize, page * pageSize),
      total: list.length,
      page,
      pageSize,
    });
  },
  'PUT /api/workspace/ai/history/:id': (req: Request, res: Response) => {
    const id = String(req.params.id);
    const row = updateAiConversation(id, {
      title: String(req.body?.title ?? '未命名会话'),
    });
    if (!row) {
      ok(res, { id, title: req.body?.title ?? '未命名会话' });
      return;
    }
    ok(res, row);
  },
  'DELETE /api/workspace/ai/history/:id': (req: Request, res: Response) => {
    const id = String(req.params.id);
    deleteAiConversation(id);
    ok(res, { id });
  },
  'POST /api/workspace/ai/history/batch-delete': (req: Request, res: Response) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    for (const id of ids) {
      deleteAiConversation(id);
    }
    ok(res, { deleted: ids });
  },
};
