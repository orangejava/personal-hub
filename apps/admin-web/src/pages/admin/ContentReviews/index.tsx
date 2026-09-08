import { type ActionType, ProTable } from '@ant-design/pro-components';
import { getUserWebOrigin } from '@personal-hub/app-origins';
import {
  type ContentReviewItem,
  ContentType,
  ContentTypeLabel,
  ContentVisibility,
  ContentVisibilityLabel,
} from '@personal-hub/shared-types';
import { useIntl } from '@umijs/max';
import { App, Button, Form, Input, Modal, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import { PageContainer, ResultState } from '@/components/shared';
import {
  DEFAULT_TABLE_PAGINATION,
  DEFAULT_TABLE_SEARCH,
} from '@/constants/tablePagination';
import {
  approveAdminContentReview,
  fetchAdminContentReviews,
  rejectAdminContentReview,
} from '@/services/admin';

const NEST_TYPE_TO_CONTENT: Record<string, ContentType> = {
  MARKDOWN: ContentType.Markdown,
  RICH_TEXT: ContentType.RichText,
  BOOKLET: ContentType.Booklet,
  PDF: ContentType.Pdf,
  WORD: ContentType.Word,
  LINK: ContentType.Link,
  PROJECT: ContentType.Project,
};

const NEST_VISIBILITY_TO_CONTENT: Record<string, ContentVisibility> = {
  PUBLIC: ContentVisibility.Public,
  LOGIN: ContentVisibility.Login,
  PRIVATE: ContentVisibility.Private,
};

function reviewStatusLabel(
  status: ContentReviewItem['status'],
  format: (id: string) => string,
): string {
  return format(`admin.reviews.status.${status}`);
}

/** 导入内容首次允许公开/登录可见时，通过审核必须填写版权说明。 */
function needsCopyrightNote(item: ContentReviewItem): boolean {
  return (
    item.content.importRestriction === 'PRIVATE_UNTIL_LICENSED' &&
    (item.requestedVisibility === 'PUBLIC' ||
      item.requestedVisibility === 'LOGIN')
  );
}

function nestTypeLabel(type: string): string {
  const mapped = NEST_TYPE_TO_CONTENT[type];
  return mapped ? ContentTypeLabel[mapped] : type;
}

function nestVisibilityLabel(visibility: string): string {
  const mapped = NEST_VISIBILITY_TO_CONTENT[visibility];
  return mapped ? ContentVisibilityLabel[mapped] : visibility;
}

/** 后台内容审核队列：待审 / 通过 / 驳回；导入公开须填版权说明。 */
const ContentReviews: React.FC = () => {
  const intl = useIntl();
  const { message } = App.useApp();
  const format = (id: string, values?: Record<string, string>) =>
    intl.formatMessage({ id }, values);
  const actionRef = useRef<ActionType>(null);
  const [operatingId, setOperatingId] = useState<string>();
  const [approveItem, setApproveItem] = useState<ContentReviewItem>();
  const [rejectItem, setRejectItem] = useState<ContentReviewItem>();
  const [approveForm] = Form.useForm<{ copyrightNote: string }>();
  const [rejectForm] = Form.useForm<{ reason: string }>();
  const reload = () => actionRef.current?.reload();

  const handleApprove = async (
    item: ContentReviewItem,
    copyrightNote?: string,
  ) => {
    if (operatingId) return;
    setOperatingId(item.id);
    try {
      await approveAdminContentReview(item.id, copyrightNote);
      message.success(format('admin.reviews.approved'));
      setApproveItem(undefined);
      approveForm.resetFields();
      reload();
    } finally {
      setOperatingId(undefined);
    }
  };

  const handleReject = async (item: ContentReviewItem, reason: string) => {
    if (operatingId) return;
    setOperatingId(item.id);
    try {
      await rejectAdminContentReview(item.id, reason);
      message.success(format('admin.reviews.rejected'));
      setRejectItem(undefined);
      rejectForm.resetFields();
      reload();
    } finally {
      setOperatingId(undefined);
    }
  };

  const openApprove = (item: ContentReviewItem) => {
    if (needsCopyrightNote(item)) {
      setApproveItem(item);
      return;
    }
    void handleApprove(item);
  };

  const submitApprove = async () => {
    if (!approveItem) return;
    const values = await approveForm.validateFields();
    await handleApprove(approveItem, values.copyrightNote);
  };

  const submitReject = async () => {
    if (!rejectItem) return;
    const values = await rejectForm.validateFields();
    await handleReject(rejectItem, values.reason);
  };

  return (
    <PageContainer title={format('admin.reviews.title')}>
      <ProTable<ContentReviewItem>
        actionRef={actionRef}
        rowKey="id"
        pagination={DEFAULT_TABLE_PAGINATION}
        search={DEFAULT_TABLE_SEARCH}
        locale={{
          emptyText: (
            <ResultState
              status="empty"
              description={format('admin.reviews.empty')}
            />
          ),
        }}
        request={async (params) => {
          const res = await fetchAdminContentReviews({
            current: params.current,
            pageSize: params.pageSize,
            status: params.status as string | undefined,
          });
          return {
            data: res.list ?? [],
            success: true,
            total: res.total ?? 0,
          };
        }}
        columns={[
          {
            title: format('admin.reviews.contentTitle'),
            dataIndex: ['content', 'title'],
            search: false,
            render: (_, r) => (
              <a href={`${getUserWebOrigin()}/content/${r.content.id}`}>
                {r.content.title}
              </a>
            ),
          },
          {
            title: format('admin.reviews.type'),
            dataIndex: ['content', 'type'],
            search: false,
            render: (_, r) => (
              <Tag color="blue">{nestTypeLabel(r.content.type)}</Tag>
            ),
          },
          {
            title: format('admin.reviews.requester'),
            dataIndex: ['requester', 'nickname'],
            search: false,
          },
          {
            title: format('admin.reviews.visibility'),
            dataIndex: 'requestedVisibility',
            search: false,
            render: (_, r) => nestVisibilityLabel(r.requestedVisibility),
          },
          {
            title: format('admin.reviews.status'),
            dataIndex: 'status',
            valueType: 'select',
            initialValue: 'PENDING',
            valueEnum: {
              PENDING: { text: format('admin.reviews.status.PENDING') },
              APPROVED: { text: format('admin.reviews.status.APPROVED') },
              REJECTED: { text: format('admin.reviews.status.REJECTED') },
              CANCELED: { text: format('admin.reviews.status.CANCELED') },
            },
            render: (_, r) => {
              const color =
                r.status === 'PENDING'
                  ? 'processing'
                  : r.status === 'APPROVED'
                    ? 'success'
                    : r.status === 'REJECTED'
                      ? 'error'
                      : 'default';
              return (
                <Tag color={color}>{reviewStatusLabel(r.status, format)}</Tag>
              );
            },
          },
          {
            title: format('admin.reviews.importRestriction'),
            dataIndex: ['content', 'importRestriction'],
            search: false,
            render: (_, r) =>
              r.content.importRestriction === 'PRIVATE_UNTIL_LICENSED' ? (
                <Tag color="orange">
                  {format('admin.reviews.pendingPublic')}
                </Tag>
              ) : (
                '-'
              ),
          },
          {
            title: format('admin.reviews.rejectReason'),
            dataIndex: 'rejectReason',
            search: false,
            ellipsis: true,
            render: (_, r) => r.rejectReason || '-',
          },
          {
            title: format('admin.reviews.submittedAt'),
            dataIndex: 'createdAt',
            valueType: 'dateTime',
            search: false,
          },
          {
            title: format('admin.common.action'),
            valueType: 'option',
            render: (_, r) => {
              if (r.status !== 'PENDING') {
                return null;
              }
              const operating = operatingId === r.id;
              return [
                <Button
                  type="link"
                  key="approve"
                  disabled={operating}
                  onClick={() => openApprove(r)}
                >
                  {operating
                    ? format('admin.common.processing')
                    : format('admin.reviews.approve')}
                </Button>,
                <Button
                  type="link"
                  danger
                  key="reject"
                  disabled={operating}
                  onClick={() => setRejectItem(r)}
                >
                  {format('admin.reviews.reject')}
                </Button>,
              ];
            },
          },
        ]}
      />
      <Modal
        title={format('admin.reviews.approveTitle')}
        open={!!approveItem}
        onCancel={() => {
          setApproveItem(undefined);
          approveForm.resetFields();
        }}
        onOk={() => void submitApprove()}
        confirmLoading={!!operatingId}
        destroyOnHidden
      >
        <p style={{ marginBottom: 12 }}>
          {format('admin.reviews.approveDescription', {
            visibility: approveItem
              ? nestVisibilityLabel(approveItem.requestedVisibility)
              : '',
          })}
        </p>
        <Form form={approveForm} layout="vertical">
          <Form.Item
            name="copyrightNote"
            label={format('admin.reviews.copyrightNote')}
            rules={[
              {
                required: true,
                message: format('admin.reviews.copyrightRequired'),
              },
            ]}
          >
            <Input.TextArea
              rows={4}
              maxLength={500}
              placeholder={format('admin.reviews.copyrightPlaceholder')}
            />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title={format('admin.reviews.rejectTitle')}
        open={!!rejectItem}
        onCancel={() => {
          setRejectItem(undefined);
          rejectForm.resetFields();
        }}
        onOk={() => void submitReject()}
        confirmLoading={!!operatingId}
        destroyOnHidden
      >
        <Form form={rejectForm} layout="vertical">
          <Form.Item
            name="reason"
            label={format('admin.reviews.rejectReasonLabel')}
            rules={[
              {
                required: true,
                message: format('admin.reviews.rejectRequired'),
              },
            ]}
          >
            <Input.TextArea
              rows={4}
              maxLength={500}
              placeholder={format('admin.reviews.rejectPlaceholder')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default ContentReviews;
