import { ContentStatus, ContentVisibility, ImportRestriction } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { publicDetailAccess, publicListWhere } from '../src/modules/content/content-visibility';

const AUTHOR_ID = 'author';
const READER_ID = 'reader';

describe('content visibility', () => {
  const privateContent = {
    status: ContentStatus.PUBLISHED,
    visibility: ContentVisibility.PRIVATE,
    deletedAt: null,
    importRestriction: ImportRestriction.NONE,
    authorId: AUTHOR_ID,
    accessGrants: [{ userId: READER_ID }],
  };

  it('已发布 PRIVATE 只允许作者、指定读者和 read ALL 主体读取', () => {
    expect(publicDetailAccess(privateContent, { contentReadAll: false })).toBe('not_found');
    expect(publicDetailAccess(privateContent, { userId: AUTHOR_ID, contentReadAll: false })).toBe(
      'ok',
    );
    expect(publicDetailAccess(privateContent, { userId: READER_ID, contentReadAll: false })).toBe(
      'ok',
    );
    expect(publicDetailAccess(privateContent, { userId: 'other', contentReadAll: false })).toBe(
      'not_found',
    );
    expect(publicDetailAccess(privateContent, { userId: 'admin', contentReadAll: true })).toBe(
      'ok',
    );
  });

  it('版权闸和发布态优先拦截指定读者，但不拦截作者', () => {
    const restricted = {
      ...privateContent,
      importRestriction: ImportRestriction.PRIVATE_UNTIL_LICENSED,
    };
    const draft = { ...privateContent, status: ContentStatus.DRAFT };

    expect(publicDetailAccess(restricted, { userId: READER_ID, contentReadAll: false })).toBe(
      'not_found',
    );
    expect(publicDetailAccess(draft, { userId: READER_ID, contentReadAll: false })).toBe(
      'not_found',
    );
    expect(publicDetailAccess(restricted, { userId: AUTHOR_ID, contentReadAll: false })).toBe('ok');
  });

  it('登录列表查询包含作者和授权用户分支，匿名列表不包含 PRIVATE', () => {
    const anonymousWhere = publicListWhere({ contentReadAll: false });
    const readerWhere = publicListWhere({ userId: READER_ID, contentReadAll: false });

    expect(anonymousWhere.OR).toHaveLength(1);
    expect(readerWhere.OR).toEqual(
      expect.arrayContaining([
        { visibility: ContentVisibility.PRIVATE, authorId: READER_ID },
        {
          visibility: ContentVisibility.PRIVATE,
          importRestriction: ImportRestriction.NONE,
          accessGrants: { some: { userId: READER_ID } },
        },
      ]),
    );
  });
});
