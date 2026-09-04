/**
 * 工作区服务
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

export async function fetchWorkspaceStats() {
  return request<WorkspaceStats>('/api/workspace/stats');
}

export async function fetchContinueReading() {
  return request<ContinueReading[]>('/api/workspace/continue-reading');
}

export async function fetchMyContents(params: {
  page?: number;
  pageSize?: number;
  title?: string;
  type?: string;
  status?: string;
  visibility?: string;
}) {
  return request<PaginationResult<ContentItem>>('/api/workspace/contents', {
    params,
  });
}

export async function createContent(data: Record<string, unknown>) {
  return request<ContentItem>('/api/workspace/contents', {
    method: 'POST',
    data,
  });
}

export async function updateContent(id: string, data: Record<string, unknown>) {
  return request<ContentItem>(`/api/workspace/contents/${id}`, {
    method: 'PUT',
    data,
  });
}

/** 切换内容状态（发布 / 归档 / 草稿），mock 阶段只改内存状态 */
export async function setContentStatus(id: string, status: string) {
  return request<ContentItem>(`/api/workspace/contents/${id}`, {
    method: 'PUT',
    data: { status },
  });
}

/** 删除内容（mock 阶段从内存列表移除） */
export async function deleteContent(id: string) {
  return request<{ id: string }>(`/api/workspace/contents/${id}`, {
    method: 'DELETE',
  });
}

export async function fetchLocalBooklets() {
  return request<{ booklets: import('@personal-hub/shared-types').Booklet[]; syncedAt: string | null }>(
    '/api/workspace/booklets/local',
  );
}

export async function fetchFavorites(params: { page?: number; pageSize?: number }) {
  return request<PaginationResult<ContentItem>>('/api/workspace/favorites', {
    params,
  });
}

export async function fetchUsage() {
  return request<WorkspaceUsage>('/api/workspace/usage');
}

/** 获取工作区 AI 对话历史，阶段 5 复用 AI 会话 mock 数据。 */
export async function fetchWorkspaceAiHistory(params: {
  page?: number;
  pageSize?: number;
  keyword?: string;
}) {
  return request<PaginationResult<AiConversation>>(
    '/api/workspace/ai/history',
    { params },
  );
}

/** 重命名工作区 AI 历史会话。 */
export async function renameWorkspaceAiHistory(id: string, title: string) {
  return request<AiConversation>(
    `/api/workspace/ai/history/${id}`,
    { method: 'PUT', data: { title } },
  );
}

/** 删除单条工作区 AI 历史会话。 */
export async function deleteWorkspaceAiHistory(id: string) {
  return request<{ id: string }>(
    `/api/workspace/ai/history/${id}`,
    { method: 'DELETE' },
  );
}

/** 批量删除工作区 AI 历史会话。 */
export async function batchDeleteWorkspaceAiHistory(ids: string[]) {
  return request<{ deleted: string[] }>(
    '/api/workspace/ai/history/batch-delete',
    { method: 'POST', data: { ids } },
  );
}
