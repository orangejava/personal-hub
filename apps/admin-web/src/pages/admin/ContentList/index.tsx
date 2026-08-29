import { type ActionType, ProTable } from '@ant-design/pro-components';
import {
  ContentStatus,
  ContentStatusLabel,
  ContentType,
  ContentTypeLabel,
  type ContentVisibility,
  ContentVisibilityLabel,
} from '@personal-hub/shared-types';
import { message, Popconfirm, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import { PageContainer, ResultState } from '@/components/shared';
import { getUserWebOrigin } from '@personal-hub/app-origins';
import {
  deleteAdminContent,
  fetchAdminContents,
  updateAdminContentStatus,
} from '@/services/admin';

/** 文档列表：筛选、发布/归档、删除 */
const ContentList: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [operatingId, setOperatingId] = useState<string>();
  const reload = () => actionRef.current?.reload();

  const changeStatus = async (id: string, status: ContentStatus) => {
    setOperatingId(id);
    try {
      const res = await updateAdminContentStatus(id, status);
      if (res?.code === 0) {
        message.success(status === ContentStatus.Published ? '已发布' : `已${ContentStatusLabel[status]}`);
        reload();
      } else {
        message.error(res?.message || '操作失败');
      }
    } finally {
      setOperatingId(undefined);
    }
  };

  const remove = async (id: string) => {
    setOperatingId(id);
    try {
      const res = await deleteAdminContent(id);
      if (res?.code === 0) {
        message.success('已删除');
        reload();
      } else {
        message.error(res?.message || '删除失败');
      }
    } finally {
      setOperatingId(undefined);
    }
  };

  return (
    <PageContainer title="文档列表">
      <ProTable
        actionRef={actionRef}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        locale={{
          emptyText: <ResultState status="empty" description="暂无文档" />,
        }}
        request={async (params) => {
          const res = await fetchAdminContents({
            current: params.current,
            pageSize: params.pageSize,
            title: params.title as string,
            type: params.type as string,
          });
          return {
            data: res.data?.list ?? [],
            success: res.code === 0,
            total: res.data?.total ?? 0,
          };
        }}
        columns={[
          {
            title: '标题',
            dataIndex: 'title',
            render: (_, r) => (
              <a href={`${getUserWebOrigin()}/content/${r.id}`}>{r.title}</a>
            ),
          },
          {
            title: '类型',
            dataIndex: 'type',
            valueType: 'select',
            valueEnum: Object.fromEntries(
              Object.values(ContentType).map((t) => [t, { text: ContentTypeLabel[t] }]),
            ),
            render: (_, r) => (
              <Tag color="blue">{ContentTypeLabel[r.type as ContentType]}</Tag>
            ),
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
                <Tag color={status === ContentStatus.Published ? 'success' : status === ContentStatus.Archived ? 'warning' : 'default'}>
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
              return [
                <a
                  key="publish"
                  aria-disabled={operating}
                  onClick={() => changeStatus(r.id, ContentStatus.Published)}
                >
                  {operating ? '处理中' : '发布'}
                </a>,
                <a
                  key="archive"
                  aria-disabled={operating}
                  onClick={() => changeStatus(r.id, ContentStatus.Archived)}
                >
                  {operating ? '处理中' : '归档'}
                </a>,
                <Popconfirm
                  key="delete"
                  title="确认删除？"
                  onConfirm={() => remove(r.id)}
                >
                  <a>{operating ? '处理中' : '删除'}</a>
                </Popconfirm>,
              ];
            },
          },
        ]}
      />
    </PageContainer>
  );
};

export default ContentList;
