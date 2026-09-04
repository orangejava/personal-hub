/**
 * 小册服务
 */
import { request } from '@umijs/max';
import type { Booklet, BookletChapter } from '@personal-hub/shared-types';

export async function fetchBookletChapters(bookletId: string) {
  return request<{ booklet: Booklet; chapters: BookletChapter[] }>(
    `/api/contents/${bookletId}/chapters`,
  );
}

export async function fetchChapter(bookletId: string, chapterId: string) {
  return request<BookletChapter>(
    `/api/contents/${bookletId}/chapters/${chapterId}`,
  );
}
