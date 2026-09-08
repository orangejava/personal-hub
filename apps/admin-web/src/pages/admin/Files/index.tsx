import { type ActionType, ProTable } from '@ant-design/pro-components';
import type { AdminFileRecord } from '@personal-hub/shared-types';
import { useIntl } from '@umijs/max';
import { App, Popconfirm, Space, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import { PageContainer, ResultState } from '@/components/shared';
import { DEFAULT_TABLE_PAGINATION, DEFAULT_TABLE_SEARCH } from '@/constants/tablePagination';
import {
  batchDeleteAdminFiles,
  deleteAdminFile,
  fetchAdminFiles,
} from '@/services/admin';

const mimeGroupEnum = {
  image: { text: '图片' },
  pdf: { text: 'PDF' },
  word: { text: 'Word' },
  other: { text: '其他' },
};

function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  return `${Math.round(size / 1024)} KB`;
}

/** 文件管理：文件样例、引用占用校验与批量删除。 */
const Files: React.FC = () => {
  const intl = useIntl();
  const { message } = App.useApp();
  const format = (id: string, values?: Record<string, number>) =>
    intl.formatMessage({ id }, values);
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [deletingId, setDeletingId] = useState<string>();
  const [batchDeleting, setBatchDeleting] = useState(false);

  const reload = () => actionRef.current?.reload();

  const removeOne = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteAdminFile(id);
      message.success(format('admin.files.deleted'));
      reload();
    } finally {
      setDeletingId(undefined);
    }
  };

  const removeBatch = async () => {
    setBatchDeleting(true);
    try {
      const res = await batchDeleteAdminFiles(selectedRowKeys.map(String));
      const deleted = res.deleted.length ?? 0;
      const failed = res.failed.length ?? 0;
      if (deleted) message.success(format('admin.files.batchDeleted', { count: deleted }));
      if (failed) message.warning(format('admin.files.batchSkipped', { count: failed }));
      setSelectedRowKeys([]);
      reload();
    } finally {
      setBatchDeleting(false);
    }
  };

  return (
    <PageContainer title={format('admin.files.title')}>
      <ProTable<AdminFileRecord>
        actionRef={actionRef}
        rowKey="id"
        pagination={DEFAULT_TABLE_PAGINATION}
        search={DEFAULT_TABLE_SEARCH}
        locale={{
          emptyText: <ResultState status="empty" description={format('admin.files.empty')} />,
        }}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
          getCheckboxProps: (record) => ({
            disabled: !!record.referencedBy?.length,
          }),
        }}
        tableAlertOptionRender={() => (
          <Space>
            <Popconfirm
              title={format('admin.files.batchDeleteTitle')}
              description={format('admin.files.batchDeleteDescription')}
              onConfirm={removeBatch}
            >
              <a>
                {batchDeleting
                  ? format('admin.files.batchDeleting')
                  : format('admin.files.batchDelete')}
              </a>
            </Popconfirm>
            <a onClick={() => setSelectedRowKeys([])}>
              {format('admin.files.clearSelection')}
            </a>
          </Space>
        )}
        request={async (params) => {
          const res = await fetchAdminFiles({
            keyword: params.keyword as string,
            mimeGroup: params.mimeGroup as 'image' | 'pdf' | 'word' | 'other',
            page: params.current,
            pageSize: params.pageSize,
          });
          return { data: res.list ?? [], success: true, total: res.total };
        }}
        columns={[
          {
            title: format('admin.files.keyword'),
            dataIndex: 'keyword',
            hideInTable: true,
          },
          {
            title: format('admin.files.name'),
            dataIndex: 'name',
            render: (_, record) => (
              <Space orientation="vertical" size={0}>
                <span>{record.name}</span>
                <span style={{ color: '#667085', fontSize: 12 }}>{record.id}</span>
              </Space>
            ),
          },
          {
            title: format('admin.files.type'),
            dataIndex: 'mimeGroup',
            valueType: 'select',
            valueEnum: mimeGroupEnum,
            render: (_, record) => <Tag>{record.mimeType}</Tag>,
          },
          {
            title: format('admin.files.usage'),
            dataIndex: 'usage',
            search: false,
            render: (_, record) => (
              <Tag color="blue">{record.purpose ?? record.usage ?? 'attachment'}</Tag>
            ),
          },
          {
            title: format('admin.files.size'),
            dataIndex: 'size',
            search: false,
            render: (_, record) => formatFileSize(record.size),
          },
          {
            title: format('admin.files.reference'),
            dataIndex: 'referencedBy',
            search: false,
            render: (_, record) =>
              record.referencedBy?.length ? (
                <Tag color="warning">
                  {format('admin.files.referenced', {
                    count: record.referencedBy.length,
                  })}
                </Tag>
              ) : (
                <Tag color="success">{format('admin.files.unreferenced')}</Tag>
              ),
          },
          {
            title: format('admin.files.link'),
            dataIndex: 'url',
            search: false,
            ellipsis: true,
            render: (_, record) => (
              <a href={record.url} target="_blank" rel="noreferrer">
                {format('admin.files.preview')}
              </a>
            ),
          },
          {
            title: format('admin.common.action'),
            valueType: 'option',
            render: (_, record) => [
              <Popconfirm
                key="delete"
                title={format('admin.files.deleteTitle')}
                description={
                  record.referencedBy?.length
                    ? format('admin.files.deleteReferenced')
                    : format('admin.files.deleteAvailable')
                }
                onConfirm={() => removeOne(record.id)}
              >
                <a style={{ color: '#ff4d4f' }}>
                  {format(
                    deletingId === record.id
                      ? 'admin.common.processing'
                      : 'admin.common.delete',
                  )}
                </a>
              </Popconfirm>,
            ],
          },
        ]}
      />
    </PageContainer>
  );
};

export default Files;
