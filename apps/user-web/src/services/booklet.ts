/**
 * 小册服务。本阶段只有章节索引，没有章节正文（对象存储后置）。
 */
import { request } from '@umijs/max';
import type { Booklet, BookletChapter } from '@personal-hub/shared-types';
import { mapNestChapterIndex, type NestChapterIndexItem } from './mapNestContent';

export async function fetchBookletChapters(bookletId: string) {
  const res = await request<{ list: NestChapterIndexItem[] }>(
    `/api/v1/public/contents/${bookletId}/chapters`,
    { skipErrorHandler: true },
  );
  return mapNestChapterIndex(bookletId, '', res);
}

export async function fetchChapter(bookletId: string, chapterId: string) {
  const { chapters } = await fetchBookletChapters(bookletId);
  const found = chapters.find((item) => item.id === chapterId);
  if (found) {
    return found;
  }
  const empty: BookletChapter = {
    id: chapterId,
    bookletId,
    order: 0,
    title: '章节正文尚未接入',
    body: '',
    empty: true,
  };
  return empty;
}

export type { Booklet };
