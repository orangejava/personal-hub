import type { AiAsset } from '@personal-hub/shared-types';
import { describe, expect, it } from 'vitest';
import { filterAssets, searchAsset, sortAssets } from './assetFilters';

const assets: AiAsset[] = [
  {
    id: 'active-generated',
    type: 'image',
    source: 'generated',
    status: 'saved',
    title: '海报',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-03T00:00:00.000Z',
    folderId: 'design',
    folderName: '设计稿',
  },
  {
    id: 'trashed-generated',
    type: 'image',
    source: 'generated',
    status: 'trashed',
    title: '已删除海报',
    createdAt: '2026-07-02T00:00:00.000Z',
    updatedAt: '2026-07-04T00:00:00.000Z',
  },
];

describe('AI 资产筛选', () => {
  it('正常分类不会显示回收站资产', () => {
    expect(filterAssets(assets, 'generated').map((asset) => asset.id)).toEqual([
      'active-generated',
    ]);
    expect(filterAssets(assets, 'trash').map((asset) => asset.id)).toEqual([
      'trashed-generated',
    ]);
  });

  it('支持按文件夹搜索，并按更新时间排序', () => {
    expect(searchAsset(assets[0], '设计稿')).toBe(true);
    expect(sortAssets(assets, 'updated-desc').map((asset) => asset.id)).toEqual([
      'trashed-generated',
      'active-generated',
    ]);
  });
});
