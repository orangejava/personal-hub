import { type ActionType, ProTable } from '@ant-design/pro-components';
import {
  ContentStatus,
  ContentStatusLabel,
  ContentType,
  ContentTypeLabel,
  type ContentItem,
  ContentVisibility,
  ContentVisibilityLabel,
} from '@personal-hub/shared-types';
import { history, Link, useIntl, useModel } from '@umijs/max';
import { App, Button, Form, Input, Modal, Popconfirm, Select, Space, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import { PageContainer, ResultState } from '@/components/shared';
import { DEFAULT_TABLE_PAGINATION, DEFAULT_TABLE_SEARCH } from '@/constants/tablePagination';
import {
  deleteContent,
  fetchMyContents,
  setContentStatus,
} from '@/services/workspace';
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
  Object.values(ContentVisibility).map((v) => [
    v,
    { text: ContentVisibilityLabel[v] },
  ]),
);

const visibilityOptions = Object.values(ContentVisibility).map((value) => ({
  label: ContentVisibilityLabel[value],
  value,
}));

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
  return Boolean(grants?.some((item) => item.code === 'content:publish' && item.dataScope === 'ALL'));
}

/** 待审核优先于待审公开：编辑者排队 vs 仅版权闸尚未允许公开。 */
function restrictionTag(item: Pick<ContentItem, 'reviewStatus' | 'importRestriction'>) {
  if (item.reviewStatus === 'PENDING') {
    return <Tag color="processing">待审核</Tag>;
  }
  if (item.importRestriction === 'PRIVATE_UNTIL_LICENSED') {
    return <Tag color="orange">待审公开</Tag>;
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
  const [operatingId, setOperatingId] = useState<string>();
  const [metaId, setMetaId] = useState<string>();
  const [publishItem, setPublishItem] = useState<ContentItem>();
  const [publishForm] = Form.useForm<{
    requestedVisibility: ContentVisibility;
    copyrightNote?: string;
  }>();

  const reload = () => actionRef.current?.reload();

  /** 把「新建」放在重置/查询旁边，避免顶栏 extra 与筛选栏脱节。 */
  const renderSearchOptions = (
    _searchConfig: unknown,
    _formProps: unknown,
    dom: React.ReactNode[],
  ) => [
    ...dom,
    <Link key="create" to="/workspace/content/new">
      <Button type="primary">
        {intl.formatMessage({ id: 'workspace.content.new' })}
      </Button>
    </Link>,
  ];

  const toggleStatus = async (
    id: string,
    status: ContentStatus,
    options?: { requestedVisibility?: string; copyrightNote?: string },
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
      publishForm.setFields([{ name: 'copyrightNote', errors: ['公开或登录可见前请填写版权说明'] }]);
      return;
    }
    await toggleStatus(publishItem.id, ContentStatus.Published, {
      requestedVisibility: values.requestedVisibility,
      copyrightNote: values.copyrightNote,
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

  return (
    <PageContainer title={intl.formatMessage({ id: 'workspace.content.title' })}>
      <ProTable
        actionRef={actionRef}
        rowKey="id"
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
              Object.values(ContentType).map((t) => [
                t,
                { text: ContentTypeLabel[t] },
              ]),
            ),
            render: (_, r) => (
              <Tag color="blue">{ContentTypeLabel[r.type as ContentType]}</Tag>
            ),
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
              return visibility ? (
                <Tag>{ContentVisibilityLabel[visibility]}</Tag>
              ) : (
                '-'
              );
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
              return (
                <Tag color={statusColor[final]}>
                  {ContentStatusLabel[final]}
                </Tag>
              );
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
                  <a
                    key="publish"
                    aria-disabled={operating}
                    onClick={() => openPublish(r)}
                  >
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
                  <a
                    key="publish"
                    aria-disabled={operating}
                    onClick={() => openPublish(r)}
                  >
                    {operating ? '处理中' : '重新发布'}
                  </a>
                ),
                <Popconfirm
                  key="delete"
                  title={intl.formatMessage({ id: 'workspace.content.deleteConfirm' })}
                  onConfirm={() => remove(r.id)}
                >
                  <a style={{ color: '#ff4d4f' }}>
                    {operating ? '处理中' : '删除'}
                  </a>
                </Popconfirm>,
              ].filter(Boolean);
            },
          },
        ]}
      />
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
                  visibility === ContentVisibility.Public ||
                  visibility === ContentVisibility.Login;
                if (!showNote) {
                  return null;
                }
                return (
                  <Form.Item
                    name="copyrightNote"
                    label="版权说明"
                    rules={[{ required: true, message: '请填写版权说明' }]}
                  >
                    <Input.TextArea rows={4} maxLength={500} placeholder="说明可公开传播的授权依据" />
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
