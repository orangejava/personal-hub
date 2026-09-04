import { type ActionType, ProTable } from '@ant-design/pro-components';
import {
  ContentStatus,
  ContentStatusLabel,
  ContentType,
  ContentTypeLabel,
  ContentVisibility,
  ContentVisibilityLabel,
} from '@personal-hub/shared-types';
import { history, Link, useIntl } from '@umijs/max';
import { Button, message, Popconfirm, Space, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import { PageContainer, ResultState } from '@/components/shared';
import {
  deleteContent,
  fetchMyContents,
  setContentStatus,
} from '@/services/workspace';

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

/** 文档管理：我的内容表格 + 状态展示 + 发布/归档/删除（mock） */
const Content: React.FC = () => {
  const intl = useIntl();
  const actionRef = useRef<ActionType>(null);
  const [operatingId, setOperatingId] = useState<string>();

  const reload = () => actionRef.current?.reload();

  const toggleStatus = async (id: string, status: ContentStatus) => {
    setOperatingId(id);
    try {
      await setContentStatus(id, status);
      message.success(`已切换为「${ContentStatusLabel[status]}」`);
      reload();
    } finally {
      setOperatingId(undefined);
    }
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
    <PageContainer
      title={intl.formatMessage({ id: 'workspace.content.title' })}
      extra={
        <Space>
          <Link to="/workspace/content/new">
            <Button type="primary">
              {intl.formatMessage({ id: 'workspace.content.new' })}
            </Button>
          </Link>
          <Link to="/workspace/markdown">
            <Button>
              {intl.formatMessage({ id: 'workspace.markdown.newTitle' })}
            </Button>
          </Link>
        </Space>
      }
    >
      <ProTable
        actionRef={actionRef}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
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
            render: (_, r) => <Link to={`/content/${r.id}`}>{r.title}</Link>,
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
          { title: '分类', dataIndex: 'categorySlug' },
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
              const editPath =
                r.type === ContentType.RichText
                  ? `/workspace/richtext/${r.id}`
                  : r.type === ContentType.Markdown
                    ? `/workspace/markdown/${r.id}`
                    : `/content/${r.id}`;
              return [
                <a key="edit" onClick={() => history.push(editPath)}>
                  {r.type === ContentType.Markdown ||
                  r.type === ContentType.RichText
                    ? '编辑'
                    : '查看'}
                </a>,
                <a key="view" onClick={() => history.push(`/content/${r.id}`)}>
                  查看
                </a>,
                !isPublished && (
                  <a
                    key="publish"
                    aria-disabled={operating}
                    onClick={() => toggleStatus(r.id, ContentStatus.Published)}
                  >
                    {operating ? '处理中' : '发布'}
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
                    key="restore"
                    aria-disabled={operating}
                    onClick={() => toggleStatus(r.id, ContentStatus.Draft)}
                  >
                    {operating ? '处理中' : '还原草稿'}
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
    </PageContainer>
  );
};

export default Content;
