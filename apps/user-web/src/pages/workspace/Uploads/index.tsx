import { type ActionType, ProTable } from '@ant-design/pro-components';
import type { UploadTaskItem } from '@personal-hub/shared-types';
import { history, useIntl } from '@umijs/max';
import { App, Button, Popconfirm, Progress, Select, Tag } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { PageContainer, ResultState } from '@/components/shared';
import { DEFAULT_TABLE_PAGINATION } from '@/constants/tablePagination';
import {
  fetchMyUploadTasks,
  hideBookletImport,
  hideUploadFile,
  retryBookletImport,
} from '@/services/files';

const WORD_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

type UploadTypeFilter = 'all' | 'booklet' | 'pdf' | 'word' | 'zip';

type UploadTaskRow = {
  rowKey: string;
  source: 'booklet' | 'file';
  sourceId: string;
  typeFilter: Exclude<UploadTypeFilter, 'all'> | 'file';
  typeLabel: string;
  name: string;
  status: string;
  statusLabel: string;
  statusColor: string;
  progress?: number;
  errorMessage?: string | null;
  contentId: string | null;
  createdAt: string;
  size?: number;
  retryable: boolean;
};

function importStatusColor(status: string): string {
  if (status === 'SUCCEEDED') return 'success';
  if (status === 'PARTIAL_SUCCESS') return 'warning';
  if (status === 'FAILED') return 'error';
  return 'processing';
}

function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isImportInProgress(status: string): boolean {
  return (
    status === 'QUEUED' || status === 'VALIDATING' || status === 'IMPORTING'
  );
}

function isZipMime(mimeType: string | null | undefined): boolean {
  return (
    mimeType === 'application/zip' ||
    mimeType === 'application/x-zip-compressed'
  );
}

function fileKind(
  mimeType: string | null | undefined,
): 'pdf' | 'word' | 'zip' | 'file' {
  if (mimeType === 'application/pdf') {
    return 'pdf';
  }
  if (mimeType === WORD_MIME) {
    return 'word';
  }
  if (isZipMime(mimeType)) {
    return 'zip';
  }
  return 'file';
}

function importStatusLabel(
  status: string,
  format: (id: string) => string,
): string {
  const keys: Record<string, string> = {
    QUEUED: 'workspace.uploads.status.queued',
    VALIDATING: 'workspace.uploads.status.validating',
    IMPORTING: 'workspace.uploads.status.importing',
    SUCCEEDED: 'workspace.uploads.status.succeeded',
    PARTIAL_SUCCESS: 'workspace.uploads.status.partialSuccess',
    FAILED: 'workspace.uploads.status.failed',
  };
  return keys[status] ? format(keys[status]) : status;
}

function fileStatusLabel(
  status: string,
  format: (id: string) => string,
): string {
  const keys: Record<string, string> = {
    PENDING_UPLOAD: 'workspace.uploads.status.pendingUpload',
    UPLOADING: 'workspace.uploads.status.uploading',
    READY: 'workspace.uploads.status.ready',
    FAILED: 'workspace.uploads.status.failed',
  };
  return keys[status] ? format(keys[status]) : status;
}

function mapUploadTask(
  task: UploadTaskItem,
  format: (id: string) => string,
): UploadTaskRow {
  if (task.taskType === 'BOOKLET_IMPORT') {
    return {
      rowKey: `booklet:${task.id}`,
      source: 'booklet',
      sourceId: task.id,
      typeFilter: 'booklet',
      typeLabel: format('workspace.uploads.filter.booklet'),
      name: task.originalName,
      status: task.status,
      statusLabel: importStatusLabel(task.status, format),
      statusColor: importStatusColor(task.status),
      progress: task.progress ?? 0,
      errorMessage: task.errorMessage,
      contentId: task.contentId,
      createdAt: task.createdAt,
      size: task.size ?? undefined,
      retryable: task.status === 'FAILED',
    };
  }
  const failed = task.status === 'FAILED';
  const kind = fileKind(task.mimeType);
  return {
    rowKey: `file:${task.id}`,
    source: 'file',
    sourceId: task.id,
    typeFilter: kind,
    typeLabel: format(`workspace.uploads.type.${kind}`),
    name: task.originalName,
    status: task.status,
    statusLabel: fileStatusLabel(task.status, format),
    statusColor:
      task.status === 'READY' ? 'success' : failed ? 'error' : 'default',
    errorMessage: task.errorMessage,
    contentId: task.contentId,
    createdAt: task.createdAt,
    size: task.size ?? undefined,
    retryable: false,
  };
}

/**
 * 工作区上传任务由服务端完成跨资源排序和分页。
 * 任意页存在进行中导入时都轮询当前页，避免状态停留在旧值。
 */
const Uploads: React.FC = () => {
  const intl = useIntl();
  const { message } = App.useApp();
  const format = (id: string) => intl.formatMessage({ id });
  const actionRef = useRef<ActionType>(null);
  const [retryingId, setRetryingId] = useState<string>();
  const [hidingId, setHidingId] = useState<string>();
  const [shouldPoll, setShouldPoll] = useState(false);
  const [typeFilter, setTypeFilter] = useState<UploadTypeFilter>('all');

  const openDraft = (contentId: string) => {
    history.push(`/content/${contentId}`);
  };

  const retryJob = async (jobId: string) => {
    setRetryingId(jobId);
    try {
      await retryBookletImport(jobId);
      actionRef.current?.reload();
    } finally {
      setRetryingId(undefined);
    }
  };

  const hideRow = async (row: UploadTaskRow) => {
    setHidingId(row.rowKey);
    try {
      if (row.source === 'booklet') {
        await hideBookletImport(row.sourceId);
      } else {
        await hideUploadFile(row.sourceId);
      }
      message.success(format('workspace.uploads.removed'));
      actionRef.current?.reload();
    } finally {
      setHidingId(undefined);
    }
  };

  const loadRows = async (
    page: number,
    pageSize: number,
    filter: UploadTypeFilter,
  ) => {
    const result = await fetchMyUploadTasks({
      page,
      pageSize,
      taskKind: filter === 'all' ? undefined : filter,
    });
    setShouldPoll(result.hasActiveBookletImports);
    return {
      list: result.list.map((task) => mapUploadTask(task, format)),
      total: result.total,
    };
  };

  useEffect(() => {
    if (!shouldPoll) {
      return;
    }
    const tick = () => {
      if (document.hidden) {
        return;
      }
      actionRef.current?.reload();
    };
    const timer = window.setInterval(tick, 3000);
    const onVisibility = () => {
      if (!document.hidden) {
        tick();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [shouldPoll]);

  return (
    <PageContainer
      title={intl.formatMessage({ id: 'workspace.uploads.title' })}
    >
      <ProTable<UploadTaskRow>
        actionRef={actionRef}
        rowKey="rowKey"
        search={false}
        pagination={DEFAULT_TABLE_PAGINATION}
        params={{ typeFilter }}
        toolBarRender={() => [
          <Select<UploadTypeFilter>
            key="typeFilter"
            aria-label={format('workspace.uploads.filterLabel')}
            value={typeFilter}
            onChange={setTypeFilter}
            style={{ width: 160 }}
            options={[
              { value: 'all', label: format('workspace.uploads.filter.all') },
              {
                value: 'booklet',
                label: format('workspace.uploads.filter.booklet'),
              },
              { value: 'pdf', label: format('workspace.uploads.filter.pdf') },
              { value: 'word', label: format('workspace.uploads.filter.word') },
              { value: 'zip', label: format('workspace.uploads.filter.zip') },
            ]}
          />,
        ]}
        locale={{
          emptyText: (
            <ResultState
              status="empty"
              description={format('workspace.uploads.empty')}
            />
          ),
        }}
        request={async (params) => {
          const res = await loadRows(
            params.current ?? 1,
            params.pageSize ?? 10,
            typeFilter,
          );
          return {
            data: res.list,
            success: true,
            total: res.total,
          };
        }}
        columns={[
          {
            title: format('workspace.uploads.type'),
            dataIndex: 'typeLabel',
            width: 110,
          },
          {
            title: format('workspace.uploads.file'),
            dataIndex: 'name',
            ellipsis: true,
          },
          {
            title: format('workspace.uploads.status'),
            dataIndex: 'status',
            render: (_, r) => <Tag color={r.statusColor}>{r.statusLabel}</Tag>,
          },
          {
            title: format('workspace.uploads.progress'),
            dataIndex: 'progress',
            width: 140,
            render: (_, r) =>
              r.source === 'booklet' ? (
                <Progress
                  percent={r.progress ?? 0}
                  size="small"
                  status={r.status === 'FAILED' ? 'exception' : undefined}
                />
              ) : (
                '-'
              ),
          },
          {
            title: format('workspace.uploads.size'),
            dataIndex: 'size',
            width: 100,
            render: (_, r) =>
              typeof r.size === 'number' ? formatFileSize(r.size) : '-',
          },
          {
            title: format('workspace.uploads.error'),
            dataIndex: 'errorMessage',
            ellipsis: true,
            render: (_, r) => r.errorMessage || '-',
          },
          {
            title: format('workspace.uploads.createdAt'),
            dataIndex: 'createdAt',
            valueType: 'dateTime',
            width: 180,
          },
          {
            title: format('workspace.common.action'),
            valueType: 'option',
            width: 220,
            render: (_, r) => {
              const actions: React.ReactNode[] = [];
              if (r.contentId) {
                actions.push(
                  <a
                    key="draft"
                    onClick={() => openDraft(r.contentId as string)}
                  >
                    {format('workspace.uploads.openDraft')}
                  </a>,
                );
              }
              if (r.retryable) {
                actions.push(
                  <Button
                    type="link"
                    key="retry"
                    disabled={
                      retryingId === r.sourceId || isImportInProgress(r.status)
                    }
                    onClick={() => void retryJob(r.sourceId)}
                  >
                    {format(
                      retryingId === r.sourceId
                        ? 'workspace.uploads.retrying'
                        : 'workspace.uploads.retry',
                    )}
                  </Button>,
                );
              }
              actions.push(
                <Popconfirm
                  key="hide"
                  title={format('workspace.uploads.removeTitle')}
                  description={format('workspace.uploads.removeDescription')}
                  onConfirm={() => hideRow(r)}
                >
                  <Button type="link" danger disabled={hidingId === r.rowKey}>
                    {format(
                      hidingId === r.rowKey
                        ? 'workspace.uploads.removing'
                        : 'workspace.uploads.remove',
                    )}
                  </Button>
                </Popconfirm>,
              );
              return actions;
            },
          },
        ]}
      />
    </PageContainer>
  );
};

export default Uploads;
