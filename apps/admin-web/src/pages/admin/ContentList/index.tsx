import { type ActionType, ProTable } from '@ant-design/pro-components';
import {
  ContentStatus,
  ContentStatusLabel,
  ContentType,
  ContentTypeLabel,
  type ContentItem,
  ContentVisibility,
  ContentVisibilityLabel,
  batchPublishOptions,
  needsBatchCopyrightNote,
  type BatchVisibility,
} from '@personal-hub/shared-types';
import { App, Button, Form, Input, Modal, Popconfirm, Select, Space, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import { PageContainer } from '@/components/shared';
import { useAdminTablePlaceholder } from '@/components/shared/useAdminTablePlaceholder';
import { DEFAULT_TABLE_PAGINATION, DEFAULT_TABLE_SEARCH } from '@/constants/tablePagination';
import { getUserWebOrigin } from '@personal-hub/app-origins';
import { settleBatch } from '@/utils/settleBatch';
import {
  deleteAdminContent,
  fetchAdminContents,
  setAdminContentFeatured,
  updateAdminContentStatus,
} from '@/services/admin';

function isImportRestricted(restriction?: 'NONE' | 'PRIVATE_UNTIL_LICENSED'): boolean {
  return restriction === 'PRIVATE_UNTIL_LICENSED';
}

/** 待审核优先于版权闸：后者尚未提交后台审核，不能误称为审核队列中的项目。 */
function restrictionTag(item: Pick<ContentItem, 'reviewStatus' | 'importRestriction'>) {
  if (item.reviewStatus === 'PENDING') {
    return (
      <Tag color="processing" style={{ marginLeft: 8 }}>
        待审核
      </Tag>
    );
  }
  if (isImportRestricted(item.importRestriction)) {
    return (
      <Tag color="orange" style={{ marginLeft: 8 }}>
        公开前需提交审核
      </Tag>
    );
  }
  if (item.reviewStatus === 'REJECTED') {
    return (
      <Tag color="error" style={{ marginLeft: 8 }}>
        已驳回
      </Tag>
    );
  }
  return null;
}

const visibilityOptions = Object.values(ContentVisibility).map((value) => ({
  label: ContentVisibilityLabel[value],
  value,
}));

const DEFAULT_SOURCE_NOTICE = '网络下载，侵权联系';
const COPYRIGHT_NOTE_PLACEHOLDER =
  '例如：已获原作者书面授权在本站公开展示（授权日期：YYYY-MM-DD）。请据实填写授权依据。';
const batchVisibilityOptions = [
  { label: '保持各自当前可见性', value: 'KEEP' },
  ...visibilityOptions,
];

/** 文档列表：筛选、发布/归档、删除。导入公开走内容审核或发布弹窗版权说明。 */
const ContentList: React.FC = () => {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const contentRecordsRef = useRef(new Map<string, ContentItem>());
  const [operatingId, setOperatingId] = useState<string>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const batchRunningRef = useRef(false);
  // state 更新有一个渲染间隙；ref 用于在第二次点击到达前同步拦截并发写入。
  const operatingRef = useRef(false);
  const [publishItem, setPublishItem] = useState<ContentItem>();
  const [batchPublishIds, setBatchPublishIds] = useState<string[]>([]);
  const [batchPublishForm] = Form.useForm<{
    targetVisibility: BatchVisibility;
    copyrightNote?: string;
  }>();
  const batchVisibility = Form.useWatch('targetVisibility', batchPublishForm) as
    BatchVisibility | undefined;
  const [publishForm] = Form.useForm<{
    requestedVisibility: ContentVisibility;
    copyrightNote?: string;
    sourceNotice: string;
  }>();
  const reload = () => actionRef.current?.reload();
  const tablePlaceholder = useAdminTablePlaceholder('暂无文档');
  const batchPublishItems = batchPublishIds
    .map((id) => contentRecordsRef.current.get(id))
    .filter(
      (item): item is ContentItem => Boolean(item) && item?.status !== ContentStatus.Published,
    );
  const batchRestrictedCount = batchPublishItems.filter((item) =>
    needsBatchCopyrightNote(item, batchVisibility ?? 'KEEP'),
  ).length;
  const batchNeedsCopyright = batchRestrictedCount > 0;

  const changeStatus = async (
    id: string,
    status: ContentStatus,
    options?: { requestedVisibility?: string; copyrightNote?: string; sourceNotice?: string },
  ) => {
    if (operatingRef.current) return;
    operatingRef.current = true;
    setOperatingId(id);
    try {
      await updateAdminContentStatus(id, status, options);
      message.success(
        status === ContentStatus.Published ? '已发布' : `已${ContentStatusLabel[status]}`,
      );
      setPublishItem(undefined);
      publishForm.resetFields();
      reload();
    } finally {
      operatingRef.current = false;
      setOperatingId(undefined);
    }
  };

  const runBatch = async (
    operation: (id: string) => Promise<unknown>,
    successText: string,
    eligible?: (item: ContentItem) => boolean,
    selectedIdsOverride?: string[],
  ) => {
    if (batchRunningRef.current) return;
    const selectedIds = selectedIdsOverride ?? selectedRowKeys.map(String);
    const ids = eligible
      ? selectedIds.filter((id) => {
          const item = contentRecordsRef.current.get(id);
          return item ? eligible(item) : false;
        })
      : selectedIds;
    const skipped = selectedIds.length - ids.length;
    if (ids.length === 0) {
      message.info('所选内容没有符合条件的项目');
      return;
    }
    batchRunningRef.current = true;
    setBatchRunning(true);
    try {
      const results = await settleBatch(ids, operation);
      const succeeded = results.filter((result) => result.status === 'fulfilled').length;
      const failed = results.length - succeeded;
      if (succeeded) message.success(`${successText} ${succeeded} 项`);
      if (skipped) message.info(`${skipped} 项状态不适用，已跳过`);
      if (failed) {
        const failedIds = ids.filter((_, index) => results[index]?.status === 'rejected');
        message.warning(
          `${failed} 项操作失败（${failedIds.slice(0, 5).join('、')}${failedIds.length > 5 ? '…' : ''}），请检查提示后重试`,
        );
      }
      setSelectedRowKeys([]);
      reload();
    } finally {
      batchRunningRef.current = false;
      setBatchRunning(false);
    }
  };

  const openBatchPublish = () => {
    if (batchRunningRef.current) return;
    const ids = selectedRowKeys.map(String);
    if (
      !ids.some((id) => {
        const item = contentRecordsRef.current.get(id);
        return item && item.status !== ContentStatus.Published;
      })
    ) {
      message.info('所选内容没有符合条件的项目');
      return;
    }
    batchPublishForm.resetFields();
    batchPublishForm.setFieldsValue({ targetVisibility: 'KEEP' });
    setBatchPublishIds(ids);
  };

  const submitBatchPublish = async () => {
    if (batchRunningRef.current || batchPublishIds.length === 0) return;
    const values = await batchPublishForm.validateFields();
    const requiresNote = batchPublishItems.some((item) =>
      needsBatchCopyrightNote(item, values.targetVisibility),
    );
    if (requiresNote && !values.copyrightNote?.trim()) {
      batchPublishForm.setFields([
        { name: 'copyrightNote', errors: ['公开或登录可见前请填写版权说明'] },
      ]);
      return;
    }
    await runBatch(
      (id) => {
        const item = contentRecordsRef.current.get(id);
        const target = values.targetVisibility;
        return updateAdminContentStatus(id, ContentStatus.Published, {
          ...(item ? batchPublishOptions(item, target, values.copyrightNote) : {}),
        });
      },
      '已发布',
      (item) => item.status !== ContentStatus.Published,
      batchPublishIds,
    );
    setBatchPublishIds([]);
    batchPublishForm.resetFields();
  };

  const openPublish = (item: ContentItem) => {
    if (isImportRestricted(item.importRestriction)) {
      setPublishItem(item);
      publishForm.setFieldsValue({
        requestedVisibility: ContentVisibility.Private,
        sourceNotice: item.sourceNotice ?? DEFAULT_SOURCE_NOTICE,
      });
      return;
    }
    void changeStatus(item.id, ContentStatus.Published);
  };

  const submitPublish = async () => {
    if (!publishItem) return;
    const values = await publishForm.validateFields();
    const needsNote =
      values.requestedVisibility === ContentVisibility.Public ||
      values.requestedVisibility === ContentVisibility.Login;
    if (needsNote && !values.copyrightNote?.trim()) {
      publishForm.setFields([
        { name: 'copyrightNote', errors: ['公开或登录可见前请填写版权说明'] },
      ]);
      return;
    }
    await changeStatus(publishItem.id, ContentStatus.Published, {
      requestedVisibility: values.requestedVisibility,
      copyrightNote: values.copyrightNote,
      sourceNotice: values.sourceNotice,
    });
  };

  const toggleFeatured = async (id: string, featured: boolean) => {
    if (operatingRef.current) return;
    operatingRef.current = true;
    setOperatingId(id);
    try {
      await setAdminContentFeatured(id, featured);
      message.success(featured ? '已设为精选' : '已取消精选');
      reload();
    } finally {
      operatingRef.current = false;
      setOperatingId(undefined);
    }
  };

  const remove = async (id: string) => {
    if (operatingRef.current) return;
    operatingRef.current = true;
    setOperatingId(id);
    try {
      await deleteAdminContent(id);
      message.success('已删除');
      reload();
    } finally {
      operatingRef.current = false;
      setOperatingId(undefined);
    }
  };

  return (
    <PageContainer title="文档列表">
      <ProTable
        actionRef={actionRef}
        rowKey="id"
        rowSelection={{ selectedRowKeys, preserveSelectedRowKeys: true, onChange: setSelectedRowKeys }}
        tableAlertOptionRender={() => (
          <Space wrap>
            <Button
              size="small"
              loading={batchRunning}
              disabled={batchRunning}
              onClick={openBatchPublish}
            >
              批量发布
            </Button>
            <Button
              size="small"
              loading={batchRunning}
              disabled={batchRunning}
              onClick={() =>
                void runBatch(
                  (id) => updateAdminContentStatus(id, ContentStatus.Archived),
                  '已归档',
                  (item) => item.status === ContentStatus.Published,
                )
              }
            >
              批量归档
            </Button>
            <Button
              size="small"
              loading={batchRunning}
              disabled={batchRunning}
              onClick={() =>
                void runBatch(
                  (id) => setAdminContentFeatured(id, true),
                  '已设为精选',
                  (item) => !item.isFeatured,
                )
              }
            >
              批量设为精选
            </Button>
            <Popconfirm
              title="确认删除所选内容？"
              onConfirm={() => runBatch(deleteAdminContent, '已删除')}
              okButtonProps={{ loading: batchRunning, disabled: batchRunning }}
            >
              <Button size="small" danger loading={batchRunning} disabled={batchRunning}>
                批量删除
              </Button>
            </Popconfirm>
            <a onClick={() => setSelectedRowKeys([])}>清除选择</a>
          </Space>
        )}
        pagination={DEFAULT_TABLE_PAGINATION}
        search={DEFAULT_TABLE_SEARCH}
        {...tablePlaceholder}
        request={async (params) => {
          const res = await fetchAdminContents({
            current: params.current,
            pageSize: params.pageSize,
            title: params.title as string,
            type: params.type as string,
          });
          res.list.forEach((item) => {
            contentRecordsRef.current.set(item.id, item);
          });
          return {
            data: res.list ?? [],
            success: true,
            total: res.total ?? 0,
          };
        }}
        columns={[
          {
            title: '标题 / 来源说明',
            dataIndex: 'title',
            render: (_, r) => (
              <>
                <a href={`${getUserWebOrigin()}/content/${r.id}`}>{r.title}</a>
                {restrictionTag(r)}
              </>
            ),
          },
          {
            title: '类型',
            dataIndex: 'type',
            valueType: 'select',
            valueEnum: Object.fromEntries(
              Object.values(ContentType).map((t) => [t, { text: ContentTypeLabel[t] }]),
            ),
            render: (_, r) => <Tag color="blue">{ContentTypeLabel[r.type as ContentType]}</Tag>,
          },
          {
            title: '分类',
            dataIndex: 'categorySlug',
            search: false,
            render: (_, r) => r.categoryName || r.categorySlug || '-',
          },
          {
            title: '来源说明',
            dataIndex: 'sourceNotice',
            search: false,
            ellipsis: true,
            render: (_, r) => r.sourceNotice || '-',
          },
          { title: '作者', dataIndex: 'author', search: false },
          {
            title: '可见性',
            dataIndex: 'visibility',
            search: false,
            render: (_, r) =>
              r.visibility ? (
                <Tag>{ContentVisibilityLabel[r.visibility as ContentVisibility]}</Tag>
              ) : (
                '-'
              ),
          },
          {
            title: '状态',
            dataIndex: 'status',
            search: false,
            render: (_, r) => {
              const status = (r.status ?? ContentStatus.Draft) as ContentStatus;
              return (
                <Tag
                  color={
                    status === ContentStatus.Published
                      ? 'success'
                      : status === ContentStatus.Archived
                        ? 'warning'
                        : 'default'
                  }
                >
                  {ContentStatusLabel[status]}
                </Tag>
              );
            },
          },
          { title: '阅读', dataIndex: 'viewCount', search: false },
          { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime', search: false },
          {
            title: '操作',
            valueType: 'option',
            render: (_, r) => {
              const operating = operatingId === r.id;
              const status = (r.status ?? ContentStatus.Draft) as ContentStatus;
              const isPublished = status === ContentStatus.Published;
              return [
                !isPublished && (
                  <Button
                    type="link"
                    key="publish"
                    disabled={operating}
                    onClick={() => openPublish(r)}
                  >
                    {operating ? '处理中' : '发布'}
                  </Button>
                ),
                isPublished && (
                  <Button
                    type="link"
                    key="archive"
                    disabled={operating}
                    onClick={() => changeStatus(r.id, ContentStatus.Archived)}
                  >
                    {operating ? '处理中' : '归档'}
                  </Button>
                ),
                <Button
                  type="link"
                  key="featured"
                  disabled={operating}
                  onClick={() => toggleFeatured(r.id, !r.isFeatured)}
                >
                  {r.isFeatured ? '取消精选' : '精选'}
                </Button>,
                <Popconfirm key="delete" title="确认删除？" onConfirm={() => remove(r.id)}>
                  <Button type="link" danger disabled={operating}>
                    {operating ? '处理中' : '删除'}
                  </Button>
                </Popconfirm>,
              ].filter(Boolean);
            },
          },
        ]}
      />
      <Modal
        title={`批量发布（${batchPublishItems.length} 项）`}
        open={batchPublishIds.length > 0}
        onCancel={() => {
          if (batchRunningRef.current) return;
          setBatchPublishIds([]);
          batchPublishForm.resetFields();
        }}
        onOk={() => void submitBatchPublish()}
        confirmLoading={batchRunning}
        cancelButtonProps={{ disabled: batchRunning }}
        maskClosable={!batchRunning}
        destroyOnHidden
      >
        <p style={{ marginBottom: 12 }}>
          默认保留每条内容的可见性和来源说明。受限导入内容改为公开或登录可见时，需要填写真实的授权依据。
        </p>
        {batchNeedsCopyright ? (
          <p>其中 {batchRestrictedCount} 项将使用同一份版权说明，请确认该依据适用于每一项。</p>
        ) : null}
        <Form form={batchPublishForm} layout="vertical">
          <Form.Item
            name="targetVisibility"
            label="目标可见性"
            rules={[{ required: true, message: '请选择可见性' }]}
          >
            <Select options={batchVisibilityOptions} />
          </Form.Item>
          {batchNeedsCopyright ? (
            <Form.Item
              name="copyrightNote"
              label="版权说明（适用于选中的受限导入内容）"
              rules={[{ required: true, whitespace: true, message: '请填写版权说明' }]}
            >
              <Input.TextArea rows={4} maxLength={500} placeholder={COPYRIGHT_NOTE_PLACEHOLDER} />
            </Form.Item>
          ) : null}
        </Form>
      </Modal>
      <Modal
        title="发布导入内容"
        open={!!publishItem}
        onCancel={() => {
          setPublishItem(undefined);
          publishForm.resetFields();
        }}
        onOk={() => void submitPublish()}
        confirmLoading={operatingId === publishItem?.id}
        destroyOnHidden
      >
        <p style={{ marginBottom: 12 }}>
          ZIP 导入内容默认私有。改为公开或登录可见时必须填写版权说明；私有发布不必填写。
        </p>
        <Form form={publishForm} layout="vertical">
          <Form.Item name="sourceNotice" label="来源说明">
            <Input.TextArea rows={2} maxLength={500} />
          </Form.Item>
          <Form.Item
            name="requestedVisibility"
            label="目标可见性"
            rules={[{ required: true, message: '请选择可见性' }]}
          >
            <Select options={visibilityOptions} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {() => {
              const visibility = publishForm.getFieldValue(
                'requestedVisibility',
              ) as ContentVisibility;
              const showNote =
                visibility === ContentVisibility.Public || visibility === ContentVisibility.Login;
              if (!showNote) {
                return null;
              }
              return (
                <Form.Item
                  name="copyrightNote"
                  label="版权说明"
                  rules={[{ required: true, message: '请填写版权说明' }]}
                >
                  <Input.TextArea
                    rows={4}
                    maxLength={500}
                    placeholder={COPYRIGHT_NOTE_PLACEHOLDER}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default ContentList;
