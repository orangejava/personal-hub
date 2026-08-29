import {
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  PictureOutlined,
  PlusOutlined,
  ReloadOutlined,
  StarOutlined,
  UploadOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { useRequest } from '@umijs/max';
import {
  Button,
  Card,
  Checkbox,
  Descriptions,
  Drawer,
  Empty,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Skeleton,
  Space,
  Statistic,
  Tag,
} from 'antd';
import type { AiAsset } from '@personal-hub/shared-types';
import React, { useMemo, useState } from 'react';
import { AiPageHeader } from '@/components/ai';
import AiLayout from '@/layouts/AiLayout';
import '@/styles/ai-assets.less';
import {
  batchDeleteAiAssets,
  batchMoveAiAssetsToFolder,
  batchRestoreAiAssets,
  batchTrashAiAssets,
  createAiAssetFolder,
  deleteAiAsset,
  deleteAiAssetFolder,
  fetchAiAssets,
  fetchAiAssetFolders,
  moveAiAssetToFolder,
  renameAiAssetFolder,
  restoreAiAsset,
  trashAiAsset,
} from '@/services/ai';
import {
  filterAssets,
  isRecentAsset,
  searchAsset,
  sortAssets,
  sourceLabels,
  statusLabels,
  type AssetFilter,
  type AssetOptionFilter,
  type AssetSortKey,
  typeLabels,
} from './assetFilters';

const AiAssetsPage: React.FC = () => {
  const { data, loading, refresh } = useRequest(fetchAiAssets);
  const {
    data: foldersData,
    loading: foldersLoading,
    refresh: refreshFolders,
  } = useRequest(fetchAiAssetFolders);
  const [filter, setFilter] = useState<AssetFilter>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailAsset, setDetailAsset] = useState<AiAsset | null>(null);
  const [operating, setOperating] = useState(false);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string>();
  const [folderName, setFolderName] = useState('');
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState<AssetOptionFilter<AiAsset['type']>>('all');
  const [sourceFilter, setSourceFilter] =
    useState<AssetOptionFilter<AiAsset['source']>>('all');
  const [statusFilter, setStatusFilter] =
    useState<AssetOptionFilter<AiAsset['status']>>('all');
  const [modelFilter, setModelFilter] = useState('all');
  const [sortKey, setSortKey] = useState<AssetSortKey>('updated-desc');
  const assets = data ?? [];
  const folders = foldersData ?? [];
  const activeAssets = useMemo(
    () => assets.filter((asset) => asset.status !== 'trashed'),
    [assets],
  );
  const filteredAssets = useMemo(() => filterAssets(assets, filter), [assets, filter]);
  const refinedAssets = useMemo(() => {
    const nextAssets = filteredAssets.filter((asset) => {
      if (!searchAsset(asset, keyword)) return false;
      if (typeFilter !== 'all' && asset.type !== typeFilter) return false;
      if (sourceFilter !== 'all' && asset.source !== sourceFilter) return false;
      if (statusFilter !== 'all' && asset.status !== statusFilter) return false;
      if (modelFilter !== 'all' && asset.modelId !== modelFilter) return false;
      return true;
    });
    return sortAssets(nextAssets, sortKey);
  }, [filteredAssets, keyword, modelFilter, sortKey, sourceFilter, statusFilter, typeFilter]);
  const selectedAssets = useMemo(
    () => assets.filter((asset) => selectedIds.includes(asset.id)),
    [assets, selectedIds],
  );
  const allFilteredSelected =
    refinedAssets.length > 0 &&
    refinedAssets.every((asset) => selectedIds.includes(asset.id));
  const hasTrashSelected = selectedAssets.some((asset) => asset.status === 'trashed');
  const hasActiveSelected = selectedAssets.some((asset) => asset.status !== 'trashed');
  const modelOptions = useMemo(() => {
    const modelIds = [...new Set(activeAssets.map((asset) => asset.modelId).filter(Boolean))];
    return [
      { label: '全部模型', value: 'all' },
      ...modelIds.map((modelId) => ({ label: modelId, value: modelId as string })),
    ];
  }, [activeAssets]);

  const hasRefinement =
    Boolean(keyword.trim()) ||
    typeFilter !== 'all' ||
    sourceFilter !== 'all' ||
    statusFilter !== 'all' ||
    modelFilter !== 'all' ||
    sortKey !== 'updated-desc';

  const filterItems = [
    { key: 'all' as const, label: '全部', icon: <FileTextOutlined />, count: activeAssets.length },
    {
      key: 'generated' as const,
      label: '生成结果',
      icon: <PictureOutlined />,
      count: activeAssets.filter((asset) => asset.source === 'generated').length,
    },
    {
      key: 'uploaded' as const,
      label: '上传素材',
      icon: <UploadOutlined />,
      count: activeAssets.filter((asset) => asset.source === 'uploaded').length,
    },
    {
      key: 'favorite' as const,
      label: '收藏',
      icon: <StarOutlined />,
      count: activeAssets.filter((asset) => asset.favorite).length,
    },
    {
      key: 'recent' as const,
      label: '最近使用',
      icon: <ClockCircleOutlined />,
      count: activeAssets.filter(isRecentAsset).length,
    },
    {
      key: 'shared' as const,
      label: '已分享',
      icon: <VideoCameraOutlined />,
      count: activeAssets.filter((asset) => asset.shared || asset.status === 'published').length,
    },
    {
      key: 'trash' as const,
      label: '回收站',
      icon: <DeleteOutlined />,
      count: assets.filter((asset) => asset.status === 'trashed').length,
    },
  ];

  const clearSelected = () => setSelectedIds([]);

  const clearRefinements = () => {
    setKeyword('');
    setTypeFilter('all');
    setSourceFilter('all');
    setStatusFilter('all');
    setModelFilter('all');
    setSortKey('updated-desc');
  };

  const toggleSelected = (assetId: string, checked: boolean) => {
    setSelectedIds((current) =>
      checked ? [...new Set([...current, assetId])] : current.filter((id) => id !== assetId),
    );
  };

  const toggleAllFiltered = (checked: boolean) => {
    setSelectedIds((current) => {
      const filteredIds = refinedAssets.map((asset) => asset.id);
      if (checked) return [...new Set([...current, ...filteredIds])];
      return current.filter((id) => !filteredIds.includes(id));
    });
  };

  const runAssetAction = async (action: () => Promise<unknown>, successText: string) => {
    setOperating(true);
    try {
      await action();
      message.success(successText);
      clearSelected();
      setDetailAsset(null);
      refresh();
      refreshFolders();
    } finally {
      setOperating(false);
    }
  };

  const folderOptions = [
    { label: '取消归档', value: '__none__' },
    ...folders.map((folder) => ({ label: folder.name, value: folder.id })),
  ];

  const toFolderPayload = (folderValue: string) => {
    if (folderValue === '__none__') {
      return { folderId: undefined, folderName: undefined };
    }
    const folder = folders.find((item) => item.id === folderValue);
    return { folderId: folderValue, folderName: folder?.name };
  };

  const openCreateFolderModal = () => {
    setEditingFolderId(undefined);
    setFolderName('');
    setFolderModalOpen(true);
  };

  const openRenameFolderModal = (folderId: string, name: string) => {
    setEditingFolderId(folderId);
    setFolderName(name);
    setFolderModalOpen(true);
  };

  const resetFolderModal = () => {
    setFolderModalOpen(false);
    setEditingFolderId(undefined);
    setFolderName('');
  };

  const saveFolder = async () => {
    const normalizedName = folderName.trim();
    if (!normalizedName) {
      message.warning('请输入文件夹名称');
      return;
    }
    setOperating(true);
    try {
      if (editingFolderId) {
        await renameAiAssetFolder(editingFolderId, { name: normalizedName });
        message.success('已重命名文件夹');
      } else {
        await createAiAssetFolder({ name: normalizedName });
        message.success('已新建文件夹');
      }
      resetFolderModal();
      refresh();
      refreshFolders();
    } finally {
      setOperating(false);
    }
  };

  const removeFolder = async (folderId: string) => {
    setOperating(true);
    try {
      const result = await deleteAiAssetFolder(folderId);
      if (!result.data?.deleted) {
        message.warning(
          result.data?.reason === 'notEmpty'
            ? '文件夹内仍有资产，请先移动或取消归档'
            : '未找到该文件夹',
        );
        return;
      }
      if (filter === `folder:${folderId}`) {
        setFilter('all');
      }
      message.success('已删除空文件夹');
      refreshFolders();
    } finally {
      setOperating(false);
    }
  };

  const moveSelectedAssetsToFolder = (folderValue: string) => {
    const activeSelectedIds = selectedAssets
      .filter((asset) => asset.status !== 'trashed')
      .map((asset) => asset.id);
    return runAssetAction(
      () => batchMoveAiAssetsToFolder(activeSelectedIds, toFolderPayload(folderValue)),
      folderValue === '__none__' ? '已取消归档' : '已移动到文件夹',
    );
  };

  const moveSingleAssetToFolder = (asset: AiAsset, folderValue: string) =>
    runAssetAction(
      () => moveAiAssetToFolder(asset.id, toFolderPayload(folderValue)),
      folderValue === '__none__' ? '已取消归档' : '已移动到文件夹',
    );

  const handleSingleFolderChange = (asset: AiAsset, folderValue?: string) => {
    if (!folderValue) return;
    moveSingleAssetToFolder(asset, folderValue);
  };

  return (
    <AiLayout>
      <AiPageHeader
        description="按来源、类型、使用状态和项目文件夹组织 AI 资产，阶段 5 使用 mock 数据。"
        title="AI 资产"
      />
      {loading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <div className="ph-ai-assets-shell">
          <aside className="ph-ai-assets-sidebar">
            <Card size="small" title="资产分类">
              <div className="ph-ai-assets-filter-list">
                {filterItems.map((item) => (
                  <button
                    className={
                      filter === item.key
                        ? 'ph-ai-assets-filter ph-ai-assets-filter-active'
                        : 'ph-ai-assets-filter'
                    }
                    key={item.key}
                    type="button"
                    onClick={() => setFilter(item.key)}
                  >
                    <span>
                      {item.icon}
                      {item.label}
                    </span>
                    <Tag>{item.count}</Tag>
                  </button>
                ))}
              </div>
            </Card>

            <Card
              extra={
                <Button
                  icon={<PlusOutlined />}
                  loading={operating}
                  size="small"
                  type="text"
                  onClick={openCreateFolderModal}
                >
                  新建
                </Button>
              }
              loading={foldersLoading}
              size="small"
              title="项目文件夹"
            >
              <div className="ph-ai-assets-filter-list">
                {folders.map((folder) => (
                  <div
                    className="ph-ai-assets-folder-row"
                    key={folder.id}
                  >
                    <button
                      className={
                        filter === `folder:${folder.id}`
                          ? 'ph-ai-assets-filter ph-ai-assets-filter-active'
                          : 'ph-ai-assets-filter'
                      }
                      type="button"
                      onClick={() => setFilter(`folder:${folder.id}`)}
                    >
                      <span>
                        <FolderOpenOutlined />
                        {folder.name}
                      </span>
                      <Tag>{folder.assetCount}</Tag>
                    </button>
                    <Space size={0}>
                      <Button
                        aria-label={`重命名文件夹 ${folder.name}`}
                        icon={<EditOutlined />}
                        size="small"
                        type="text"
                        onClick={() => openRenameFolderModal(folder.id, folder.name)}
                      />
                      <Popconfirm
                        title="删除空文件夹？"
                        description="只有空文件夹可以删除，已有资产的文件夹需要先移动资产。"
                        onConfirm={() => removeFolder(folder.id)}
                      >
                        <Button
                          aria-label={`删除文件夹 ${folder.name}`}
                          danger
                          disabled={folder.assetCount > 0}
                          icon={<DeleteOutlined />}
                          loading={operating}
                          size="small"
                          type="text"
                        />
                      </Popconfirm>
                    </Space>
                  </div>
                ))}
                {folders.length === 0 && <Empty description="暂无项目文件夹" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
              </div>
            </Card>
          </aside>

          <main className="ph-ai-assets-main">
            <div className="ph-ai-assets-summary">
              <Card>
                <Statistic title="全部资产" value={activeAssets.length} />
              </Card>
              <Card>
                <Statistic
                  title="生成结果"
                  value={activeAssets.filter((asset) => asset.source === 'generated').length}
                />
              </Card>
              <Card>
                <Statistic title="项目文件夹" value={folders.length} />
              </Card>
            </div>

            <Card className="ph-ai-assets-toolbar" size="small" style={{ marginBottom: 16 }}>
              <div className="ph-ai-assets-toolbar-grid">
                <Input
                  allowClear
                  placeholder="搜索标题、Prompt、内容、模型或文件夹"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                />
                <Select
                  options={[
                    { label: '全部类型', value: 'all' },
                    ...Object.entries(typeLabels).map(([value, label]) => ({ label, value })),
                  ]}
                  popupMatchSelectWidth={false}
                  value={typeFilter}
                  onChange={setTypeFilter}
                />
                <Select
                  options={[
                    { label: '全部来源', value: 'all' },
                    ...Object.entries(sourceLabels).map(([value, label]) => ({ label, value })),
                  ]}
                  popupMatchSelectWidth={false}
                  value={sourceFilter}
                  onChange={setSourceFilter}
                />
                <Select
                  options={[
                    { label: '全部状态', value: 'all' },
                    ...Object.entries(statusLabels).map(([value, label]) => ({ label, value })),
                  ]}
                  popupMatchSelectWidth={false}
                  value={statusFilter}
                  onChange={setStatusFilter}
                />
                <Select
                  options={modelOptions}
                  popupMatchSelectWidth={false}
                  value={modelFilter}
                  onChange={setModelFilter}
                />
                <Select
                  options={[
                    { label: '最近更新优先', value: 'updated-desc' },
                    { label: '最早更新优先', value: 'updated-asc' },
                    { label: '最近创建优先', value: 'created-desc' },
                    { label: '标题 A-Z', value: 'title-asc' },
                  ]}
                  popupMatchSelectWidth={false}
                  value={sortKey}
                  onChange={setSortKey}
                />
              </div>
              <div className="ph-ai-assets-toolbar-footer">
                <span>
                  当前显示 {refinedAssets.length} / {filteredAssets.length} 个资产
                </span>
                <Button disabled={!hasRefinement} size="small" type="link" onClick={clearRefinements}>
                  重置筛选
                </Button>
              </div>
            </Card>

            <Card size="small" style={{ marginBottom: 16 }}>
              <Space wrap>
                <Checkbox
                  checked={allFilteredSelected}
                  disabled={!filteredAssets.length}
                  indeterminate={
                    selectedIds.length > 0 &&
                    !allFilteredSelected &&
                    filteredAssets.some((asset) => selectedIds.includes(asset.id))
                  }
                  onChange={(event) => toggleAllFiltered(event.target.checked)}
                >
                  选择当前结果
                </Checkbox>
                <Tag>{selectedIds.length} 个已选</Tag>
                <Button disabled={!selectedIds.length} size="small" onClick={clearSelected}>
                  清空选择
                </Button>
                <Button
                  danger
                  disabled={!hasActiveSelected}
                  icon={<DeleteOutlined />}
                  loading={operating}
                  size="small"
                  onClick={() =>
                    runAssetAction(
                      () =>
                        batchTrashAiAssets(
                          selectedAssets
                            .filter((asset) => asset.status !== 'trashed')
                            .map((asset) => asset.id),
                        ),
                      '已移入回收站',
                    )
                  }
                >
                  移入回收站
                </Button>
                <Select
                  disabled={!hasActiveSelected || operating}
                  options={folderOptions}
                  placeholder="移动到文件夹"
                  popupMatchSelectWidth={false}
                  size="small"
                  style={{ minWidth: 148 }}
                  value={undefined}
                  onChange={moveSelectedAssetsToFolder}
                />
                <Button
                  disabled={!hasTrashSelected}
                  icon={<ReloadOutlined />}
                  loading={operating}
                  size="small"
                  onClick={() =>
                    runAssetAction(
                      () =>
                        batchRestoreAiAssets(
                          selectedAssets
                            .filter((asset) => asset.status === 'trashed')
                            .map((asset) => asset.id),
                        ),
                      '已恢复资产',
                    )
                  }
                >
                  批量恢复
                </Button>
                <Popconfirm
                  title="确认永久删除？"
                  description="永久删除后 mock 列表中会直接移除，无法恢复。"
                  onConfirm={() =>
                    runAssetAction(
                      () => batchDeleteAiAssets(selectedIds),
                      '已永久删除资产',
                    )
                  }
                >
                  <Button
                    danger
                    disabled={!selectedIds.length}
                    loading={operating}
                    size="small"
                    type="primary"
                  >
                    永久删除
                  </Button>
                </Popconfirm>
              </Space>
            </Card>

            {refinedAssets.length === 0 ? (
              <Card>
                <Empty
                  description={
                    filteredAssets.length === 0
                      ? '当前分类下暂无资产'
                      : '当前筛选条件下暂无资产'
                  }
                />
              </Card>
            ) : (
              <div className="ph-ai-assets-grid">
                {refinedAssets.map((asset) => (
                  <Card
                    className="ph-ai-asset-card"
                    cover={
                      asset.thumbnailUrl ? (
                        <img alt={asset.title} src={asset.thumbnailUrl} />
                      ) : (
                        <div className="ph-ai-asset-text-cover">
                          {typeLabels[asset.type]}
                        </div>
                      )
                    }
                    hoverable
                    key={asset.id}
                    actions={[
                      <Button
                        icon={<EyeOutlined />}
                        key="detail"
                        size="small"
                        type="text"
                        onClick={() => setDetailAsset(asset)}
                      >
                        详情
                      </Button>,
                      asset.status === 'trashed' ? (
                        <Button
                          icon={<ReloadOutlined />}
                          key="restore"
                          loading={operating}
                          size="small"
                          type="text"
                          onClick={() =>
                            runAssetAction(
                              () => restoreAiAsset(asset.id),
                              '已恢复资产',
                            )
                          }
                        >
                          恢复
                        </Button>
                      ) : (
                        <Space key="active-actions" size={0}>
                          <Select
                            aria-label={`移动 ${asset.title} 到文件夹`}
                            options={folderOptions}
                            placeholder="移动"
                            popupMatchSelectWidth={false}
                            size="small"
                            style={{ width: 86 }}
                            value={undefined}
                            onChange={(value) => handleSingleFolderChange(asset, value)}
                          />
                          <Button
                            danger
                            icon={<DeleteOutlined />}
                            loading={operating}
                            size="small"
                            type="text"
                            onClick={() =>
                              runAssetAction(
                                () => trashAiAsset(asset.id),
                                '已移入回收站',
                              )
                            }
                          >
                            删除
                          </Button>
                        </Space>
                      ),
                    ]}
                  >
                    <Checkbox
                      checked={selectedIds.includes(asset.id)}
                      className="ph-ai-asset-checkbox"
                      onChange={(event) => toggleSelected(asset.id, event.target.checked)}
                    />
                    <Space wrap size={[4, 6]}>
                      <Tag color="blue">{typeLabels[asset.type]}</Tag>
                      <Tag>{sourceLabels[asset.source]}</Tag>
                      <Tag color={asset.status === 'trashed' ? 'red' : 'default'}>
                        {statusLabels[asset.status]}
                      </Tag>
                      {asset.favorite && <Tag color="gold">收藏</Tag>}
                      {asset.shared && <Tag color="green">已分享</Tag>}
                    </Space>
                    <h3>{asset.title}</h3>
                    <p className="ph-text-secondary">{asset.prompt}</p>
                    <div className="ph-ai-asset-meta">
                      <span>{asset.folderName ?? '未归档'}</span>
                      <span>{new Date(asset.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </main>
        </div>
      )}

      <Drawer
        destroyOnHidden
        open={Boolean(detailAsset)}
        size="large"
        title="资产详情"
        onClose={() => setDetailAsset(null)}
      >
        {detailAsset && (
          <div className="ph-ai-asset-detail">
            {detailAsset.thumbnailUrl ? (
              <img
                alt={detailAsset.title}
                className="ph-ai-asset-detail-preview"
                src={detailAsset.thumbnailUrl}
              />
            ) : (
              <div className="ph-ai-asset-detail-text-preview">
                {typeLabels[detailAsset.type]}
              </div>
            )}
            <Descriptions column={1} size="small">
              <Descriptions.Item label="标题">{detailAsset.title}</Descriptions.Item>
              <Descriptions.Item label="类型">
                {typeLabels[detailAsset.type]}
              </Descriptions.Item>
              <Descriptions.Item label="来源">
                {sourceLabels[detailAsset.source]}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {statusLabels[detailAsset.status]}
              </Descriptions.Item>
              <Descriptions.Item label="模型">
                {detailAsset.modelId ?? '未记录'}
              </Descriptions.Item>
              <Descriptions.Item label="文件夹">
                {detailAsset.folderName ?? '未归档'}
              </Descriptions.Item>
              <Descriptions.Item label="Prompt">
                {detailAsset.prompt ?? '暂无 Prompt'}
              </Descriptions.Item>
              {detailAsset.content && (
                <Descriptions.Item label="文本内容">
                  <div className="ph-ai-asset-detail-content">
                    {detailAsset.content}
                  </div>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="更新时间">
                {new Date(detailAsset.updatedAt).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>
            <Space wrap>
              {detailAsset.fileUrl && (
                <Button href={detailAsset.fileUrl} target="_blank">
                  打开文件
                </Button>
              )}
              {detailAsset.status === 'trashed' ? (
                <Button
                  icon={<ReloadOutlined />}
                  loading={operating}
                  onClick={() =>
                    runAssetAction(
                      () => restoreAiAsset(detailAsset.id),
                      '已恢复资产',
                    )
                  }
                >
                  恢复资产
                </Button>
              ) : (
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  loading={operating}
                  onClick={() =>
                    runAssetAction(
                      () => trashAiAsset(detailAsset.id),
                      '已移入回收站',
                    )
                  }
                >
                  移入回收站
                </Button>
              )}
              {detailAsset.status !== 'trashed' && (
                <Select
                  options={folderOptions}
                  placeholder="移动到文件夹"
                  popupMatchSelectWidth={false}
                  style={{ minWidth: 160 }}
                  value={undefined}
                  onChange={(value) => handleSingleFolderChange(detailAsset, value)}
                />
              )}
              <Popconfirm
                title="确认永久删除？"
                description="永久删除后 mock 列表中会直接移除，无法恢复。"
                onConfirm={() =>
                  runAssetAction(
                    () => deleteAiAsset(detailAsset.id),
                    '已永久删除资产',
                  )
                }
              >
                <Button danger loading={operating} type="primary">
                  永久删除
                </Button>
              </Popconfirm>
            </Space>
          </div>
        )}
      </Drawer>

      <Modal
        destroyOnHidden
        okText={editingFolderId ? '保存' : '新建'}
        open={folderModalOpen}
        title={editingFolderId ? '重命名文件夹' : '新建文件夹'}
        confirmLoading={operating}
        onCancel={resetFolderModal}
        onOk={saveFolder}
      >
        <Input
          maxLength={24}
          placeholder="输入文件夹名称"
          showCount
          value={folderName}
          onChange={(event) => setFolderName(event.target.value)}
          onPressEnter={saveFolder}
        />
      </Modal>
    </AiLayout>
  );
};

export default AiAssetsPage;
