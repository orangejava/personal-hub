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
import { App, Button, Form, Input, Modal, Space, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import { PageContainer } from '@/components/shared';
import { useAdminTablePlaceholder } from '@/components/shared/useAdminTablePlaceholder';
import {
  DEFAULT_TABLE_PAGINATION,
  DEFAULT_TABLE_SEARCH,
} from '@/constants/tablePagination';
import { settleBatch } from '@/utils/settleBatch';
import { needsReviewCopyrightNote } from '@/utils/contentBatchPolicy';
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
  const tablePlaceholder = useAdminTablePlaceholder(format('admin.reviews.empty'));
  const actionRef = useRef<ActionType>(null);
  const [operatingId, setOperatingId] = useState<string>();
  const [batchRunning, setBatchRunning] = useState(false);
  const batchRunningRef = useRef(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const reviewRecordsRef = useRef(new Map<string, ContentReviewItem>());
  // 表格跨页时 selectedRows 只覆盖当前数据源，批量操作必须以受控的 ID 集合为准。
  const selectedReviews = selectedRowKeys
    .map((key) => reviewRecordsRef.current.get(String(key)))
    .filter((item): item is ContentReviewItem => item !== undefined);
  const [batchApproveOpen, setBatchApproveOpen] = useState(false);
  const [batchRejectOpen, setBatchRejectOpen] = useState(false);
  const [approveItem, setApproveItem] = useState<ContentReviewItem>();
  const [rejectItem, setRejectItem] = useState<ContentReviewItem>();
  const [approveForm] = Form.useForm<{ copyrightNote: string }>();
  const [batchApproveForm] = Form.useForm<{ copyrightNote: string }>();
  const [rejectForm] = Form.useForm<{ reason: string }>();
  const reload = () => actionRef.current?.reload();

  const handleApprove = async (
    item: ContentReviewItem,
    copyrightNote?: string,
  ) => {
    if (operatingId || batchRunningRef.current) return;
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
    if (operatingId || batchRunningRef.current) return;
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
    if (needsReviewCopyrightNote(item)) {
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
    const values = await rejectForm.validateFields();
    if (rejectItem) {
      await handleReject(rejectItem, values.reason);
      return;
    }
    if (!batchRejectOpen) return;
    if (batchRunningRef.current) return;
    batchRunningRef.current = true;
    setBatchRunning(true);
    try {
      const results = await settleBatch(selectedReviews, (item) =>
        rejectAdminContentReview(item.id, values.reason),
      );
      const succeeded = results.filter((result) => result.status === 'fulfilled').length;
      const failed = results.length - succeeded;
      if (succeeded) {
        message.success(format('admin.reviews.batchRejectedCount', { count: String(succeeded) }));
      }
      if (failed) {
        const failedIds = selectedReviews
          .filter((_, index) => results[index]?.status === 'rejected')
          .map((item) => item.id);
        message.warning(
          format('admin.reviews.batchRejectFailed', {
            count: String(failed),
            ids: `${failedIds.slice(0, 5).join(', ')}${failedIds.length > 5 ? '…' : ''}`,
          }),
        );
      }
      setBatchRejectOpen(false);
      setSelectedRowKeys([]);
      rejectForm.resetFields();
      reload();
    } finally {
      batchRunningRef.current = false;
      setBatchRunning(false);
    }
  };

  const approveSelected = async (copyrightNote?: string) => {
    if (batchRunningRef.current) return;
    const eligible = selectedReviews.filter((item) => item.status === 'PENDING');
    if (!eligible.length) return;
    batchRunningRef.current = true;
    setBatchRunning(true);
    try {
      const results = await settleBatch(eligible, (item) =>
        approveAdminContentReview(item.id, needsReviewCopyrightNote(item) ? copyrightNote : undefined),
      );
      const succeeded = results.filter((result) => result.status === 'fulfilled').length;
      const failed = results.length - succeeded;
      if (succeeded) {
        message.success(format('admin.reviews.batchApprovedCount', { count: String(succeeded) }));
      }
      if (failed) {
        const failedIds = eligible
          .filter((_, index) => results[index]?.status === 'rejected')
          .map((item) => item.id);
        message.warning(
          format('admin.reviews.batchApproveFailed', {
            count: String(failed),
            ids: `${failedIds.slice(0, 5).join(', ')}${failedIds.length > 5 ? '…' : ''}`,
          }),
        );
      }
      setSelectedRowKeys([]);
      setBatchApproveOpen(false);
      batchApproveForm.resetFields();
      reload();
    } finally {
      batchRunningRef.current = false;
      setBatchRunning(false);
    }
  };

  const openBatchApprove = () => {
    if (batchRunningRef.current) return;
    if (selectedReviews.some((item) => item.status === 'PENDING' && needsReviewCopyrightNote(item))) {
      batchApproveForm.resetFields();
      setBatchApproveOpen(true);
      return;
    }
    void approveSelected();
  };

  const submitBatchApprove = async () => {
    if (batchRunningRef.current) return;
    const values = await batchApproveForm.validateFields();
    await approveSelected(values.copyrightNote.trim());
  };

  return (
    <PageContainer title={format('admin.reviews.title')}>
      <ProTable<ContentReviewItem>
        actionRef={actionRef}
        rowKey="id"
        rowSelection={{
          selectedRowKeys,
          preserveSelectedRowKeys: true,
          onChange: (keys, rows) => {
            rows.forEach((item) => {
              reviewRecordsRef.current.set(item.id, item);
            });
            setSelectedRowKeys(keys);
          },
          getCheckboxProps: (record) => ({
            disabled: batchRunning || record.status !== 'PENDING',
          }),
        }}
        tableAlertOptionRender={() => (
          <Space>
            <Button
              size="small"
              onClick={openBatchApprove}
              loading={batchRunning}
              disabled={batchRunning || !selectedReviews.some((item) => item.status === 'PENDING')}
            >
              {format('admin.reviews.batchApprove')}
            </Button>
            <Button
              size="small"
              danger
              loading={batchRunning}
              disabled={batchRunning}
              onClick={() => setBatchRejectOpen(true)}
            >
              {format('admin.reviews.batchReject')}
            </Button>
            <a
              onClick={() => {
                setSelectedRowKeys([]);
              }}
            >
              {format('admin.reviews.clearSelection')}
            </a>
          </Space>
        )}
        pagination={DEFAULT_TABLE_PAGINATION}
        search={DEFAULT_TABLE_SEARCH}
        {...tablePlaceholder}
        request={async (params) => {
          const res = await fetchAdminContentReviews({
            current: params.current,
            pageSize: params.pageSize,
            status: params.status as string | undefined,
          });
          res.list.forEach((item) => {
            reviewRecordsRef.current.set(item.id, item);
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
        title={format('admin.reviews.batchApproveTitle')}
        open={batchApproveOpen}
        onCancel={() => {
          if (batchRunningRef.current) return;
          setBatchApproveOpen(false);
          batchApproveForm.resetFields();
        }}
        onOk={() => void submitBatchApprove()}
        confirmLoading={batchRunning}
        cancelButtonProps={{ disabled: batchRunning }}
        maskClosable={!batchRunning}
        destroyOnHidden
      >
        <p style={{ marginBottom: 12 }}>
          {format('admin.reviews.batchApproveDescription', {
            count: String(selectedReviews.filter(needsReviewCopyrightNote).length),
          })}
        </p>
        <Form form={batchApproveForm} layout="vertical">
          <Form.Item
            name="copyrightNote"
            label={format('admin.reviews.copyrightNote')}
            rules={[
              {
                required: true,
                whitespace: true,
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
        title={format('admin.reviews.approveTitle')}
        open={!!approveItem}
        onCancel={() => {
          setApproveItem(undefined);
          approveForm.resetFields();
        }}
        onOk={() => void submitApprove()}
        confirmLoading={!!operatingId || batchRunning}
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
        open={!!rejectItem || batchRejectOpen}
        onCancel={() => {
          if (batchRunningRef.current) return;
          setRejectItem(undefined);
          setBatchRejectOpen(false);
          rejectForm.resetFields();
        }}
        onOk={() => void submitReject()}
        confirmLoading={!!operatingId || batchRunning}
        cancelButtonProps={{ disabled: batchRunning }}
        maskClosable={!batchRunning}
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
