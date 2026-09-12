/**
 * 工作区服务。文档/收藏/统计走 Nest；AI 与本地小册仍打旧路径。
 */
import { request } from '@umijs/max';
import type {
  AiConversation,
  PaginationResult,
  ContentItem,
  WorkspaceStats,
  ContinueReading,
  WorkspaceUsage,
} from '@personal-hub/shared-types';
import {
  mapNestContentDetail,
  mapNestContentPage,
  toNestContentStatus,
  toNestContentType,
  toNestContentVisibility,
  type NestContentDetail,
  type NestContentPage,
} from './mapNestContent';

function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export async function fetchWorkspaceStats() {
  return request<WorkspaceStats>('/api/v1/app/dashboard');
}

export async function fetchContinueReading() {
  return request<ContinueReading[]>('/api/v1/app/reading-records/recent');
}

export async function fetchMyContents(params: {
  page?: number;
  pageSize?: number;
  title?: string;
  type?: string;
  status?: string;
  visibility?: string;
}) {
  const res = await request<NestContentPage>('/api/v1/app/contents', {
    params: {
      page: params.page,
      pageSize: params.pageSize,
      keyword: params.title || undefined,
      types: toNestContentType(params.type),
      lifecycle: toNestContentStatus(params.status),
      visibility: toNestContentVisibility(params.visibility),
    },
  });
  return mapNestContentPage(res);
}

export async function fetchAppContent(id: string) {
  const res = await request<NestContentDetail>(`/api/v1/app/contents/${id}`);
  return mapNestContentDetail(res);
}

function nestWritePayload(data: Record<string, unknown>, options?: { includeType?: boolean }) {
  const type = toNestContentType(typeof data.type === 'string' ? data.type : undefined);
  const visibility = toNestContentVisibility(
    typeof data.visibility === 'string' ? data.visibility : undefined,
  );
  const markdownSource =
    typeof data.markdownSource === 'string'
      ? data.markdownSource
      : typeof data.body === 'string' && type !== 'RICH_TEXT'
        ? data.body
        : undefined;
  const editorDocument =
    data.editorDocument && typeof data.editorDocument === 'object'
      ? data.editorDocument
      : type === 'RICH_TEXT' && typeof data.body === 'string'
        ? { html: data.body }
        : undefined;
  return {
    ...(options?.includeType && type ? { type } : {}),
    ...(typeof data.title === 'string' ? { title: data.title } : {}),
    ...(typeof data.summary === 'string' ? { summary: data.summary } : {}),
    ...(typeof data.categorySlug === 'string' && data.categorySlug
      ? { categorySlug: data.categorySlug }
      : {}),
    ...(visibility ? { visibility } : {}),
    ...(markdownSource !== undefined ? { markdownSource } : {}),
    ...(editorDocument !== undefined ? { editorDocument } : {}),
    ...(typeof data.externalUrl === 'string' ? { externalUrl: data.externalUrl } : {}),
    ...(Array.isArray(data.tagNames) ? { tagNames: data.tagNames } : {}),
    ...(typeof data.coverFileId === 'string' ? { coverFileId: data.coverFileId } : {}),
    ...(typeof data.primaryFileId === 'string' ? { primaryFileId: data.primaryFileId } : {}),
  };
}

export async function createContent(data: Record<string, unknown>) {
  const type =
    toNestContentType(typeof data.type === 'string' ? data.type : undefined) ?? 'MARKDOWN';
  const res = await request<NestContentDetail>('/api/v1/app/contents', {
    method: 'POST',
    data: { ...nestWritePayload({ ...data, type }, { includeType: true }), type },
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
  // 创建与发布分两步：调用方须先记住草稿 ID，发布失败时才能继续保存同一篇内容。
  return mapNestContentDetail(res);
}

export async function updateContent(id: string, data: Record<string, unknown>) {
  const res = await request<NestContentDetail>(`/api/v1/app/contents/${id}`, {
    method: 'PATCH',
    data: nestWritePayload(data),
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
  return mapNestContentDetail(res);
}

/** 发布可选体：OWN 提交审核；ALL 公开导入内容时带 copyrightNote。 */
export async function publishContent(
  id: string,
  options?: { requestedVisibility?: string; copyrightNote?: string },
) {
  const requestedVisibility = toNestContentVisibility(options?.requestedVisibility);
  const res = await request<NestContentDetail>(`/api/v1/app/contents/${id}/publish`, {
    method: 'POST',
    data: {
      ...(requestedVisibility ? { requestedVisibility } : {}),
      ...(options?.copyrightNote?.trim() ? { copyrightNote: options.copyrightNote.trim() } : {}),
    },
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
  return mapNestContentDetail(res);
}

export async function archiveContent(id: string) {
  const res = await request<NestContentDetail>(`/api/v1/app/contents/${id}/archive`, {
    method: 'POST',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
  return mapNestContentDetail(res);
}

/** 发布 / 归档走独立 POST；已归档内容再次发布，而不是改回草稿。 */
export async function setContentStatus(
  id: string,
  status: string,
  options?: { requestedVisibility?: string; copyrightNote?: string },
) {
  if (status === 'published' || status === 'PUBLISHED') {
    return publishContent(id, options);
  }
  if (status === 'archived' || status === 'ARCHIVED') {
    return archiveContent(id);
  }
  return fetchAppContent(id);
}

export async function deleteContent(id: string) {
  return request<{ id: string }>(`/api/v1/app/contents/${id}`, {
    method: 'DELETE',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
}

export async function fetchLocalBooklets() {
  return request<{ booklets: import('@personal-hub/shared-types').Booklet[]; syncedAt: string | null }>(
    '/api/workspace/booklets/local',
  );
}

export async function fetchFavorites(params: { page?: number; pageSize?: number }) {
  const res = await request<NestContentPage>('/api/v1/app/favorites', {
    params,
  });
  return mapNestContentPage(res);
}

export async function fetchUsage() {
  const data = await request<
    WorkspaceUsage & {
      list?: Array<{ createdAt: string; tokens: number; reason?: string }>;
    }
  >('/api/v1/app/usage');
  return {
    ...data,
    recent:
      data.recent ??
      data.list?.map((item) => ({
        date: item.createdAt,
        tokens: item.tokens,
        reason: item.reason,
      })),
  };
}

/** 获取工作区 AI 对话历史。 */
export async function fetchWorkspaceAiHistory(params: {
  page?: number;
  pageSize?: number;
  keyword?: string;
}) {
  const page = await request<{ list: AiConversation[]; total: number; page: number; pageSize: number }>(
    '/api/v1/app/ai/sessions',
    { params: { page: params.page, pageSize: params.pageSize } },
  );
  const keyword = params.keyword?.trim().toLowerCase();
  const list = keyword
    ? page.list.filter((item) => item.title.toLowerCase().includes(keyword))
    : page.list;
  return {
    list,
    total: keyword ? list.length : page.total,
    page: page.page,
    pageSize: page.pageSize,
  };
}

/** 重命名工作区 AI 历史会话。 */
export async function renameWorkspaceAiHistory(id: string, title: string) {
  return request<AiConversation>(`/api/v1/app/ai/sessions/${id}`, {
    method: 'PATCH',
    data: { title },
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
}

/** 删除单条工作区 AI 历史会话。 */
export async function deleteWorkspaceAiHistory(id: string) {
  return request<{ id: string }>(`/api/v1/app/ai/sessions/${id}`, {
    method: 'DELETE',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
}

/** 批量删除工作区 AI 历史会话。 */
export async function batchDeleteWorkspaceAiHistory(ids: string[]) {
  await Promise.all(ids.map((id) => deleteWorkspaceAiHistory(id)));
  return { deleted: ids };
}

export type { ContentItem };
