/**
 * 内容中心服务
 */
import { request } from '@umijs/max';
import type {
  ApiResponse,
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
  return request<ApiResponse<PaginationResult<ContentItem>>>('/api/contents', { params });
}

export async function fetchFeatured() {
  return request<ApiResponse<ContentItem[]>>('/api/contents/featured');
}

export interface ContentMeta {
  categories: { slug: string; name: string; count: number }[];
  tags: { slug: string; name: string; count: number }[];
}

export async function fetchContentMeta() {
  return request<ApiResponse<ContentMeta>>('/api/contents/meta');
}

export async function fetchContentDetail(id: string) {
  return request<ApiResponse<ContentDetail>>(`/api/contents/${id}`);
}

export async function favoriteContent(id: string) {
  return request<ApiResponse<{ contentId: string; favorited: boolean }>>(
    `/api/contents/${id}/favorite`,
    { method: 'POST' },
  );
}

export async function unfavoriteContent(id: string) {
  return request<ApiResponse<{ contentId: string; favorited: boolean }>>(
    `/api/contents/${id}/favorite`,
    { method: 'DELETE' },
  );
}

export async function saveReadingProgress(data: ReadingProgress) {
  return request<ApiResponse<ReadingProgress>>('/api/reading/progress', {
    method: 'POST',
    data,
  });
}
