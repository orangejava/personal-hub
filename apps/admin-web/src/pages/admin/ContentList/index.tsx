import { type ActionType, ProTable } from '@ant-design/pro-components';
import {
  ContentStatus,
  ContentStatusLabel,
  ContentType,
  ContentTypeLabel,
  type ContentVisibility,
  ContentVisibilityLabel,
} from '@personal-hub/shared-types';
import { Button, message, Popconfirm, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import { PageContainer, ResultState } from '@/components/shared';
import { getUserWebOrigin } from '@personal-hub/app-origins';
import {
  deleteAdminContent,
  fetchAdminContents,
  setAdminContentFeatured,
  updateAdminContentStatus,
} from '@/services/admin';

/** 文档列表：筛选、发布/归档、删除 */
const ContentList: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [operatingId, setOperatingId] = useState<string>();
  // state 更新有一个渲染间隙；ref 用于在第二次点击到达前同步拦截并发写入。
  const operatingRef = useRef(false);
  const reload = () => actionRef.current?.reload();

  const changeStatus = async (id: string, status: ContentStatus) => {
    if (operatingRef.current) return;
    operatingRef.current = true;
    setOperatingId(id);
    try {
      await updateAdminContentStatus(id, status);
      message.success(status === ContentStatus.Published ? '已发布' : `已${ContentStatusLabel[status]}`);
      reload();
    } finally {
      operatingRef.current = false;
      setOperatingId(undefined);
    }
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
            data: res.list ?? [],
            success: true,
            total: res.total ?? 0,
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
          {
            title: '分类',
            dataIndex: 'categorySlug',
            search: false,
            render: (_, r) => r.categoryName || r.categorySlug || '-',
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
              const status = (r.status ?? ContentStatus.Draft) as ContentStatus;
              const isPublished = status === ContentStatus.Published;
              return [
                !isPublished && (
                  <Button
                    type="link"
                    key="publish"
                    disabled={operating}
                    onClick={() => changeStatus(r.id, ContentStatus.Published)}
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
                <Popconfirm
                  key="delete"
                  title="确认删除？"
                  onConfirm={() => remove(r.id)}
                >
                  <Button type="link" danger disabled={operating}>
                    {operating ? '处理中' : '删除'}
                  </Button>
                </Popconfirm>,
              ].filter(Boolean);
            },
          },
        ]}
      />
    </PageContainer>
  );
};

export default ContentList;
