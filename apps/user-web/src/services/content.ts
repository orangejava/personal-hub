/**
 * 内容中心服务
 */
import { request } from '@umijs/max';
import type {
  PaginationResult,
  ContentItem,
  ContentDetail,
  ReadingProgress,
} from '@personal-hub/shared-types';

export interface ContentListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  type?: string;
  category?: string;
  tag?: string;
  sort?: 'latest' | 'views';
}

export async function fetchContentList(params: ContentListQuery) {
  return request<PaginationResult<ContentItem>>('/api/contents', { params });
}

export async function fetchFeatured() {
  return request<ContentItem[]>('/api/contents/featured', {
    skipErrorHandler: true,
  });
}

export interface ContentMeta {
  categories: { slug: string; name: string; count: number }[];
  tags: { slug: string; name: string; count: number }[];
}

export async function fetchContentMeta() {
  return request<ContentMeta>('/api/contents/meta', {
    skipErrorHandler: true,
  });
}

export async function fetchContentDetail(id: string) {
  return request<ContentDetail>(`/api/contents/${id}`);
}

export async function favoriteContent(id: string) {
  return request<{ contentId: string; favorited: boolean }>(
    `/api/contents/${id}/favorite`,
    { method: 'POST' },
  );
}

export async function unfavoriteContent(id: string) {
  return request<{ contentId: string; favorited: boolean }>(
    `/api/contents/${id}/favorite`,
    { method: 'DELETE' },
  );
}

export async function saveReadingProgress(data: ReadingProgress) {
  return request<ReadingProgress>('/api/reading/progress', {
    method: 'POST',
    data,
  });
}
