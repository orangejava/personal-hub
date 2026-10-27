import type { ContentReviewItem } from '@personal-hub/shared-types';

/** 受限导入内容获批对外可见时，审核通过必须携带版权说明。 */
export function needsReviewCopyrightNote(
  item: Pick<ContentReviewItem, 'requestedVisibility' | 'content'>,
): boolean {
  return (
    item.content.importRestriction === 'PRIVATE_UNTIL_LICENSED' &&
    (item.requestedVisibility === 'PUBLIC' || item.requestedVisibility === 'LOGIN')
  );
}
