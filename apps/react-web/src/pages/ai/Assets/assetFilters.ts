import type { AiAsset } from '@personal-hub/shared-types';

export type AssetFilter =
  | 'all'
  | 'generated'
  | 'uploaded'
  | 'favorite'
  | 'recent'
  | 'shared'
  | 'trash'
  | `folder:${string}`;

export type AssetOptionFilter<T extends string> = 'all' | T;
export type AssetSortKey = 'updated-desc' | 'updated-asc' | 'created-desc' | 'title-asc';

export const typeLabels: Record<AiAsset['type'], string> = {
  image: '图片',
  video: '视频',
  text: '文本',
  conversation: '对话摘要',
  attachment: '附件',
};

export const sourceLabels: Record<AiAsset['source'], string> = {
  generated: '生成结果',
  uploaded: '上传素材',
  'content-reference': '内容引用',
};

export const statusLabels: Record<AiAsset['status'], string> = {
  draft: '草稿',
  saved: '已保存',
  published: '已发布',
  failed: '失败',
  trashed: '回收站',
};

export function isRecentAsset(asset: AiAsset) {
  return Boolean(asset.lastUsedAt);
}

/** 根据左侧分类过滤资产；回收站与正常资产永远不混用。 */
export function filterAssets(assets: AiAsset[], filter: AssetFilter) {
  if (filter === 'trash') {
    return assets.filter((asset) => asset.status === 'trashed');
  }

  const activeAssets = assets.filter((asset) => asset.status !== 'trashed');
  if (filter === 'all') return activeAssets;
  if (filter === 'generated') return activeAssets.filter((asset) => asset.source === 'generated');
  if (filter === 'uploaded') return activeAssets.filter((asset) => asset.source === 'uploaded');
  if (filter === 'favorite') return activeAssets.filter((asset) => asset.favorite);
  if (filter === 'recent') {
    return activeAssets.filter(isRecentAsset).toSorted(
      (a, b) =>
        new Date(b.lastUsedAt ?? b.updatedAt).getTime() -
        new Date(a.lastUsedAt ?? a.updatedAt).getTime(),
    );
  }
  if (filter === 'shared') {
    return activeAssets.filter((asset) => asset.shared || asset.status === 'published');
  }
  if (filter.startsWith('folder:')) {
    return activeAssets.filter((asset) => asset.folderId === filter.replace('folder:', ''));
  }
  return activeAssets;
}

export function searchAsset(asset: AiAsset, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) return true;
  return [
    asset.title,
    asset.prompt,
    asset.content,
    asset.modelId,
    asset.folderName,
    typeLabels[asset.type],
    sourceLabels[asset.source],
    statusLabels[asset.status],
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedKeyword));
}

export function sortAssets(assets: AiAsset[], sortKey: AssetSortKey) {
  return [...assets].sort((a, b) => {
    if (sortKey === 'title-asc') return a.title.localeCompare(b.title, 'zh-Hans-CN');
    const leftDate = new Date(sortKey.startsWith('created') ? a.createdAt : a.updatedAt).getTime();
    const rightDate = new Date(sortKey.startsWith('created') ? b.createdAt : b.updatedAt).getTime();
    return sortKey.endsWith('asc') ? leftDate - rightDate : rightDate - leftDate;
  });
}
