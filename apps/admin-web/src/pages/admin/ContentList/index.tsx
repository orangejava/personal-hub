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
import { App, Button, Form, Input, Modal, Popconfirm, Select, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import { PageContainer, ResultState } from '@/components/shared';
import { DEFAULT_TABLE_PAGINATION, DEFAULT_TABLE_SEARCH } from '@/constants/tablePagination';
import { getUserWebOrigin } from '@personal-hub/app-origins';
import {
  deleteAdminContent,
  fetchAdminContents,
  setAdminContentFeatured,
  updateAdminContentStatus,
} from '@/services/admin';

function isImportRestricted(restriction?: 'NONE' | 'PRIVATE_UNTIL_LICENSED'): boolean {
  return restriction === 'PRIVATE_UNTIL_LICENSED';
}

/** 待审核优先于待审公开：编辑者排队 vs 仅版权闸尚未允许公开。 */
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
        待审公开
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

/** 文档列表：筛选、发布/归档、删除。导入公开走内容审核或发布弹窗版权说明。 */
const ContentList: React.FC = () => {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [operatingId, setOperatingId] = useState<string>();
  // state 更新有一个渲染间隙；ref 用于在第二次点击到达前同步拦截并发写入。
  const operatingRef = useRef(false);
  const [publishItem, setPublishItem] = useState<ContentItem>();
  const [publishForm] = Form.useForm<{
    requestedVisibility: ContentVisibility;
    copyrightNote?: string;
  }>();
  const reload = () => actionRef.current?.reload();

  const changeStatus = async (
    id: string,
    status: ContentStatus,
    options?: { requestedVisibility?: string; copyrightNote?: string },
  ) => {
    if (operatingRef.current) return;
    operatingRef.current = true;
    setOperatingId(id);
    try {
      await updateAdminContentStatus(id, status, options);
      message.success(status === ContentStatus.Published ? '已发布' : `已${ContentStatusLabel[status]}`);
      setPublishItem(undefined);
      publishForm.resetFields();
      reload();
    } finally {
      operatingRef.current = false;
      setOperatingId(undefined);
    }
  };

  const openPublish = (item: ContentItem) => {
    if (isImportRestricted(item.importRestriction)) {
      setPublishItem(item);
      publishForm.setFieldsValue({
        requestedVisibility: ContentVisibility.Private,
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
      publishForm.setFields([{ name: 'copyrightNote', errors: ['公开或登录可见前请填写版权说明'] }]);
      return;
    }
    await changeStatus(publishItem.id, ContentStatus.Published, {
      requestedVisibility: values.requestedVisibility,
      copyrightNote: values.copyrightNote,
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
        pagination={DEFAULT_TABLE_PAGINATION}
        search={DEFAULT_TABLE_SEARCH}
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
          <Form.Item
            name="requestedVisibility"
            label="目标可见性"
            rules={[{ required: true, message: '请选择可见性' }]}
          >
            <Select options={visibilityOptions} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {() => {
              const visibility = publishForm.getFieldValue('requestedVisibility') as ContentVisibility;
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
                  <Input.TextArea rows={4} maxLength={500} placeholder="说明可公开传播的授权依据" />
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
