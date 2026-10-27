import {
  batchPublishOptions,
  ContentVisibility,
  type ContentItem,
  type ContentReviewItem,
  needsBatchCopyrightNote,
} from '@personal-hub/shared-types';
import { describe, expect, it } from 'vitest';
import { needsReviewCopyrightNote } from './contentBatchPolicy';

const restricted = (visibility: ContentVisibility) => ({
  visibility,
  importRestriction: 'PRIVATE_UNTIL_LICENSED' as const,
});

describe('批量发布版权参数', () => {
  it('保持各自可见性时，私有内容不携带版权说明，公开受限内容才携带', () => {
    const privateItem = restricted(ContentVisibility.Private);
    const publicItem = restricted(ContentVisibility.Public);
    expect(needsBatchCopyrightNote(privateItem, 'KEEP')).toBe(false);
    expect(batchPublishOptions(privateItem, 'KEEP', '同一份授权依据')).toEqual({});
    expect(batchPublishOptions(publicItem, 'KEEP')).toEqual({});
    expect(needsBatchCopyrightNote(publicItem, 'KEEP')).toBe(true);
    expect(batchPublishOptions(publicItem, 'KEEP', ' 同一份授权依据 ')).toEqual({
      copyrightNote: '同一份授权依据',
    });
  });

  it('统一改为公开时也只给受限导入内容带说明；统一改私有不带说明', () => {
    const regular: Pick<ContentItem, 'visibility' | 'importRestriction'> = {
      visibility: ContentVisibility.Private,
      importRestriction: 'NONE',
    };
    expect(batchPublishOptions(regular, ContentVisibility.Public, '授权依据')).toEqual({
      requestedVisibility: ContentVisibility.Public,
    });
    expect(batchPublishOptions(restricted(ContentVisibility.Private), ContentVisibility.Public, '授权依据')).toEqual({
      requestedVisibility: ContentVisibility.Public,
      copyrightNote: '授权依据',
    });
    expect(batchPublishOptions(restricted(ContentVisibility.Public), ContentVisibility.Private, '授权依据')).toEqual({
      requestedVisibility: ContentVisibility.Private,
    });
  });
});

describe('批量审核版权判断', () => {
  it('受限导入内容申请公开或登录可见时才需要统一版权说明', () => {
    const review = (restriction: 'NONE' | 'PRIVATE_UNTIL_LICENSED', visibility: 'PUBLIC' | 'LOGIN' | 'PRIVATE') => ({
      requestedVisibility: visibility,
      content: { importRestriction: restriction },
    }) as Pick<ContentReviewItem, 'requestedVisibility' | 'content'>;
    expect(needsReviewCopyrightNote(review('PRIVATE_UNTIL_LICENSED', 'PUBLIC'))).toBe(true);
    expect(needsReviewCopyrightNote(review('PRIVATE_UNTIL_LICENSED', 'LOGIN'))).toBe(true);
    expect(needsReviewCopyrightNote(review('PRIVATE_UNTIL_LICENSED', 'PRIVATE'))).toBe(false);
    expect(needsReviewCopyrightNote(review('NONE', 'PUBLIC'))).toBe(false);
  });
});
