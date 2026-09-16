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

export async function fetchChapter(bookletId: string, chapterId: string): Promise<BookletChapter> {
  const res = await request<{
    id: string;
    title: string;
    chapterOrder: number;
    markdownSource: string;
    wordCount: number;
  }>(`/api/v1/public/contents/${bookletId}/chapters/${chapterId}`, {
    skipErrorHandler: true,
  });
  return {
    id: res.id,
    bookletId,
    order: res.chapterOrder,
    title: res.title,
    body: res.markdownSource ?? '',
    empty: !res.markdownSource,
  };
}

export type { Booklet };
