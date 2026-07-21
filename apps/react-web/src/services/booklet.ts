/**
 * 小册服务
 */
import { request } from '@umijs/max';
import type { ApiResponse, Booklet, BookletChapter } from '@personal-hub/shared-types';

export async function fetchBookletChapters(bookletId: string) {
  return request<ApiResponse<{ booklet: Booklet; chapters: BookletChapter[] }>>(
    `/api/contents/${bookletId}/chapters`,
  );
}

export async function fetchChapter(bookletId: string, chapterId: string) {
  return request<ApiResponse<BookletChapter>>(
    `/api/contents/${bookletId}/chapters/${chapterId}`,
  );
}
