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
import { history, Link, useIntl, useModel } from '@umijs/max';
import { App, Button, Form, Input, Modal, Popconfirm, Select, Space, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import PageContainer from '@/components/shared/PageContainer';
import ResultState from '@/components/shared/ResultState';
import { DEFAULT_TABLE_PAGINATION, DEFAULT_TABLE_SEARCH } from '@/constants/tablePagination';
import { deleteContent, fetchMyContents, setContentStatus } from '@/services/workspace';
import ContentMetaDrawer from './ContentMetaDrawer';

const statusColor: Record<ContentStatus, string> = {
  [ContentStatus.Draft]: 'default',
  [ContentStatus.Published]: 'success',
  [ContentStatus.Archived]: 'warning',
};

const statusValueEnum = Object.fromEntries(
  Object.values(ContentStatus).map((s) => [s, { text: ContentStatusLabel[s] }]),
);

const visibilityValueEnum = Object.fromEntries(
  Object.values(ContentVisibility).map((v) => [v, { text: ContentVisibilityLabel[v] }]),
);

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

/** 仅 Markdown 与富文本有当前阶段可编辑的工作区页面。 */
function getContentEditorPath(type: ContentType, id: string): string | undefined {
  if (type === ContentType.Markdown) {
    return `/workspace/markdown/${id}`;
  }
  if (type === ContentType.RichText) {
    return `/workspace/richtext/${id}`;
  }
  return undefined;
}

function hasPublishAll(grants?: Array<{ code: string; dataScope: string }>) {
  return Boolean(
    grants?.some((item) => item.code === 'content:publish' && item.dataScope === 'ALL'),
  );
}

/** 待审核优先于版权闸：后者尚未提交后台审核，不能误称为审核队列中的项目。 */
function restrictionTag(item: Pick<ContentItem, 'reviewStatus' | 'importRestriction'>) {
  if (item.reviewStatus === 'PENDING') {
    return <Tag color="processing">待审核</Tag>;
  }
  if (item.importRestriction === 'PRIVATE_UNTIL_LICENSED') {
    return <Tag color="orange">公开前需提交审核</Tag>;
  }
  if (item.reviewStatus === 'REJECTED') {
    return <Tag color="error">已驳回</Tag>;
  }
  return null;
}

/** 文档管理：我的内容表格 + 状态展示 + 发布/归档/删除 */
const Content: React.FC = () => {
  const intl = useIntl();
  const { message } = App.useApp();
  const { initialState } = useModel('@@initialState');
  const publishAll = hasPublishAll(initialState?.permissionGrants);
  const actionRef = useRef<ActionType>(null);
  const contentRecordsRef = useRef(new Map<string, ContentItem>());
  const [operatingId, setOperatingId] = useState<string>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const batchRunningRef = useRef(false);
  const [metaId, setMetaId] = useState<string>();
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
  const batchPublishItems = batchPublishIds
    .map((id) => contentRecordsRef.current.get(id))
    .filter(
      (item): item is ContentItem => Boolean(item) && item?.status !== ContentStatus.Published,
    );
  const batchRestrictedCount = publishAll
    ? batchPublishItems.filter((item) => needsBatchCopyrightNote(item, batchVisibility ?? 'KEEP'))
        .length
    : 0;
  const batchNeedsCopyright = batchRestrictedCount > 0;

  /** 把「新建」放在重置/查询旁边，避免顶栏 extra 与筛选栏脱节。 */
  const renderSearchOptions = (
    _searchConfig: unknown,
    _formProps: unknown,
    dom: React.ReactNode[],
  ) => [
    ...dom,
    <Link key="create" to="/workspace/content/new">
      <Button type="primary">{intl.formatMessage({ id: 'workspace.content.new' })}</Button>
    </Link>,
  ];

  const toggleStatus = async (
    id: string,
    status: ContentStatus,
    options?: { requestedVisibility?: string; copyrightNote?: string; sourceNotice?: string },
  ) => {
    setOperatingId(id);
    try {
      const result = await setContentStatus(id, status, options);
      if (status === ContentStatus.Published) {
        message.success(result.reviewStatus === 'PENDING' ? '已提交审核' : '已发布');
      } else {
        message.success(`已切换为「${ContentStatusLabel[status]}」`);
      }
      setPublishItem(undefined);
      publishForm.resetFields();
      reload();
    } finally {
      setOperatingId(undefined);
    }
  };

  const openPublish = (item: ContentItem) => {
    if (item.importRestriction === 'PRIVATE_UNTIL_LICENSED') {
      setPublishItem(item);
      publishForm.setFieldsValue({
        requestedVisibility: item.visibility ?? ContentVisibility.Private,
        sourceNotice: item.sourceNotice ?? DEFAULT_SOURCE_NOTICE,
      });
      return;
    }
    void toggleStatus(item.id, ContentStatus.Published);
  };

  const submitPublish = async () => {
    if (!publishItem) return;
    const values = await publishForm.validateFields();
    const needsNote =
      publishAll &&
      (values.requestedVisibility === ContentVisibility.Public ||
        values.requestedVisibility === ContentVisibility.Login);
    if (needsNote && !values.copyrightNote?.trim()) {
      publishForm.setFields([
        { name: 'copyrightNote', errors: ['公开或登录可见前请填写版权说明'] },
      ]);
      return;
    }
    await toggleStatus(publishItem.id, ContentStatus.Published, {
      requestedVisibility: values.requestedVisibility,
      copyrightNote: values.copyrightNote,
      sourceNotice: values.sourceNotice,
    });
  };

  const remove = async (id: string) => {
    setOperatingId(id);
    try {
      await deleteContent(id);
      message.success('已删除');
      reload();
    } finally {
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
      message.info('所选文档没有符合条件的项目');
      return;
    }
    batchRunningRef.current = true;
    setBatchRunning(true);
    try {
      const results: PromiseSettledResult<unknown>[] = [];
      for (let start = 0; start < ids.length; start += 5) {
        results.push(...(await Promise.allSettled(ids.slice(start, start + 5).map(operation))));
      }
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
      message.info('所选文档没有符合条件的项目');
      return;
    }
    batchPublishForm.resetFields();
    batchPublishForm.setFieldsValue({ targetVisibility: 'KEEP' });
    setBatchPublishIds(ids);
  };

  const submitBatchPublish = async () => {
    if (batchRunningRef.current || batchPublishIds.length === 0) return;
    const values = await batchPublishForm.validateFields();
    const requiresNote =
      publishAll &&
      batchPublishItems.some((item) => needsBatchCopyrightNote(item, values.targetVisibility));
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
        return setContentStatus(id, ContentStatus.Published, {
          ...(item
            ? batchPublishOptions(item, target, publishAll ? values.copyrightNote : undefined)
            : target === 'KEEP' ? {} : { requestedVisibility: target }),
        });
      },
      '已提交发布/审核',
      (item) => item.status !== ContentStatus.Published,
      batchPublishIds,
    );
    setBatchPublishIds([]);
    batchPublishForm.resetFields();
  };

  return (
    <PageContainer title={intl.formatMessage({ id: 'workspace.content.title' })}>
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
                  (id) => setContentStatus(id, ContentStatus.Archived),
                  '已归档',
                  (item) => item.status === ContentStatus.Published,
                )
              }
            >
              批量归档
            </Button>
            <Popconfirm
              title="确认删除所选文档？"
              onConfirm={() => runBatch(deleteContent, '已删除')}
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
        search={{
          ...DEFAULT_TABLE_SEARCH,
          optionRender: renderSearchOptions,
        }}
        locale={{
          emptyText: (
            <ResultState
              status="empty"
              description="暂无文档"
              actionText="新建内容"
              actionTo="/workspace/content/new"
            />
          ),
        }}
        request={async (params) => {
          const res = await fetchMyContents({
            page: params.current,
            pageSize: params.pageSize,
            title: params.title as string | undefined,
            type: params.type as string | undefined,
            status: params.status as string | undefined,
            visibility: params.visibility as string | undefined,
          });
          res.list.forEach((item) => {
            contentRecordsRef.current.set(item.id, item);
          });
          return {
            data: res.list,
            success: true,
            total: res.total,
          };
        }}
        columns={[
          {
            title: '标题',
            dataIndex: 'title',
            render: (_, r) => {
              const path = getContentEditorPath(r.type as ContentType, r.id);
              const tag = restrictionTag(r);
              return (
                <Space size={4} wrap>
                  {path ? <Link to={path}>{r.title}</Link> : r.title}
                  {tag}
                </Space>
              );
            },
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
            title: '可见性',
            dataIndex: 'visibility',
            valueType: 'select',
            valueEnum: visibilityValueEnum,
            render: (_, r) => {
              const visibility = r.visibility;
              return visibility ? <Tag>{ContentVisibilityLabel[visibility]}</Tag> : '-';
            },
          },
          { title: '阅读', dataIndex: 'viewCount' },
          {
            title: '状态',
            dataIndex: 'status',
            valueType: 'select',
            valueEnum: statusValueEnum,
            render: (_, r) => {
              const status = r.status;
              const final = status ?? ContentStatus.Draft;
              return <Tag color={statusColor[final]}>{ContentStatusLabel[final]}</Tag>;
            },
          },
          {
            title: '操作',
            valueType: 'option',
            render: (_, r) => {
              const status = r.status;
              const isPublished = status === ContentStatus.Published;
              const isArchived = status === ContentStatus.Archived;
              const operating = operatingId === r.id;
              const editPath = getContentEditorPath(r.type as ContentType, r.id);
              return [
                <a key="meta" onClick={() => setMetaId(r.id)}>
                  编辑信息
                </a>,
                editPath && (
                  <a key="edit" onClick={() => history.push(editPath)}>
                    编辑正文
                  </a>
                ),
                isPublished && (
                  <a key="view" onClick={() => history.push(`/content/${r.id}`)}>
                    查看
                  </a>
                ),
                !isPublished && (
                  <a key="publish" aria-disabled={operating} onClick={() => openPublish(r)}>
                    {operating ? '处理中' : r.reviewStatus === 'PENDING' ? '再次提交' : '发布'}
                  </a>
                ),
                isPublished && (
                  <a
                    key="archive"
                    aria-disabled={operating}
                    onClick={() => toggleStatus(r.id, ContentStatus.Archived)}
                  >
                    {operating ? '处理中' : '归档'}
                  </a>
                ),
                isArchived && (
                  <a key="publish" aria-disabled={operating} onClick={() => openPublish(r)}>
                    {operating ? '处理中' : '重新发布'}
                  </a>
                ),
                <Popconfirm
                  key="delete"
                  title={intl.formatMessage({ id: 'workspace.content.deleteConfirm' })}
                  onConfirm={() => remove(r.id)}
                >
                  <a style={{ color: '#ff4d4f' }}>{operating ? '处理中' : '删除'}</a>
                </Popconfirm>,
              ].filter(Boolean);
            },
          },
        ]}
      />
      <Modal
        title={`批量${publishAll ? '发布' : '提交审核'}（${batchPublishItems.length} 项）`}
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
          {publishAll
            ? '默认保留每条内容的可见性和来源说明。受限导入内容改为公开或登录可见时，需要填写真实的授权依据。'
            : '默认保留每条内容的可见性和来源说明。编辑者提交后进入审核队列，受限导入内容的版权说明由管理员审核时填写。'}
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
      <ContentMetaDrawer
        contentId={metaId}
        open={!!metaId}
        onClose={() => setMetaId(undefined)}
        onSaved={reload}
      />
      <Modal
        title={publishAll ? '发布导入内容' : '提交审核'}
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
          {publishAll
            ? 'ZIP 导入内容默认私有。改为公开或登录可见时必须填写版权说明。'
            : '编辑者发布会进入审核队列，内容保持草稿。导入内容申请公开后，由管理员填写版权说明。'}
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
          {publishAll ? (
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
          ) : null}
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default Content;
