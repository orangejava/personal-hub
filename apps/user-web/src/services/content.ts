/**
 * 内容中心服务。公开读、收藏、进度走 Nest；失败空态，禁止回落 mock。
 */
import { request } from '@umijs/max';
import type {
  PaginationResult,
  ContentItem,
  ContentDetail,
  ReadingProgress,
} from '@personal-hub/shared-types';
import { readNestData } from '@personal-hub/api-client';
import {
  mapNestContentDetail,
  mapNestContentItem,
  mapNestContentPage,
  toNestContentType,
  toNestPublicSort,
  type NestContentDetail,
  type NestContentListItem,
  type NestContentPage,
} from './mapNestContent';

export interface ContentListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  type?: string;
  category?: string;
  tag?: string;
  sort?: 'latest' | 'views';
}

function publicListParams(params: ContentListQuery) {
  const types = toNestContentType(params.type);
  return {
    page: params.page,
    pageSize: params.pageSize,
    keyword: params.keyword || undefined,
    types,
    categorySlug: params.category || undefined,
    tagSlugs: params.tag || undefined,
    sort: toNestPublicSort(params.sort),
  };
}

export async function fetchContentList(params: ContentListQuery) {
  const res = await request<NestContentPage>('/api/v1/public/contents', {
    params: publicListParams(params),
    skipErrorHandler: true,
  });
  return mapNestContentPage(res);
}

export async function fetchFeatured() {
  const res = await request<NestContentListItem[]>('/api/v1/public/contents/featured', {
    skipErrorHandler: true,
  });
  return readNestData(res).map((item) => mapNestContentItem(item));
}

export interface ContentMeta {
  categories: { slug: string; name: string; count: number }[];
  tags: { slug: string; name: string; count: number }[];
}

export async function fetchContentMeta() {
  return request<ContentMeta>('/api/v1/public/contents/meta', {
    skipErrorHandler: true,
  });
}

/**
 * 详情 401 表示 LOGIN 内容需登录，由页面画引导，避免全局 401 直接踢到登录页丢掉 redirect。
 */
export async function fetchContentDetail(id: string) {
  try {
    const res = await request<NestContentDetail>(`/api/v1/public/contents/${id}`, {
      skipErrorHandler: true,
    });
    return mapNestContentDetail(res);
  } catch (error) {
    if ((error as { response?: { status?: number } }).response?.status === 401) {
      const authError = error as Error & { code?: string };
      authError.code = 'AUTH_REQUIRED';
    }
    throw error;
  }
}

export async function favoriteContent(id: string) {
  return request<{ contentId: string; favorited: boolean }>(`/api/v1/app/favorites/${id}`, {
    method: 'PUT',
  });
}

export async function unfavoriteContent(id: string) {
  return request<{ contentId: string; favorited: boolean }>(`/api/v1/app/favorites/${id}`, {
    method: 'DELETE',
  });
}

export async function saveReadingProgress(data: ReadingProgress) {
  return request('/api/v1/app/reading-records/' + data.contentId, {
    method: 'PUT',
    data: {
      contentProgressPercent: data.percent,
      chapterId: data.chapterId ?? null,
    },
    skipErrorHandler: true,
  });
}

export type { PaginationResult, ContentItem, ContentDetail };
