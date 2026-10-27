import { describe, expect, it } from 'vitest';
import { mapNestContentItem, type NestContentListItem } from './mapNestContent';

describe('工作区内容映射', () => {
  it('保留已有来源说明，供批量发布判断和单条弹窗回填', () => {
    const row = {
      id: 'content-1',
      type: 'MARKDOWN',
      title: '示例',
      summary: '',
      sourceNotice: '作者授权转载，联系 example@example.com',
      visibility: 'PRIVATE',
      status: 'DRAFT',
      author: { id: 'author-1', nickname: '作者' },
    } as NestContentListItem;

    expect(mapNestContentItem(row).sourceNotice).toBe(row.sourceNotice);
  });
});
