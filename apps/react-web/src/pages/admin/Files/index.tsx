import { type ActionType, ProTable } from '@ant-design/pro-components';
import type { AdminFileRecord } from '@personal-hub/shared-types';
import { message, Popconfirm, Space, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import { PageContainer, ResultState } from '@/components/shared';
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

/** 文件管理：文件样例、引用占用校验与批量删除。 */
const Files: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [deletingId, setDeletingId] = useState<string>();
  const [batchDeleting, setBatchDeleting] = useState(false);

  const reload = () => actionRef.current?.reload();

  const removeOne = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await deleteAdminFile(id);
      if (res?.code === 0) {
        message.success('已删除');
        reload();
        return;
      }
      message.error(res?.message || '删除失败');
    } finally {
      setDeletingId(undefined);
    }
  };

  const removeBatch = async () => {
    setBatchDeleting(true);
    try {
      const res = await batchDeleteAdminFiles(selectedRowKeys.map(String));
      if (res?.code === 0) {
        const deleted = res.data?.deleted.length ?? 0;
        const failed = res.data?.failed.length ?? 0;
        if (deleted) message.success(`已删除 ${deleted} 个文件`);
        if (failed) message.warning(`${failed} 个文件因被引用或不存在未删除`);
        setSelectedRowKeys([]);
        reload();
        return;
      }
      message.error(res?.message || '批量删除失败');
    } finally {
      setBatchDeleting(false);
    }
  };

  return (
    <PageContainer title="文件管理">
      <ProTable<AdminFileRecord>
        actionRef={actionRef}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        locale={{
          emptyText: <ResultState status="empty" description="暂无文件" />,
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
              title="确认批量删除？"
              description="被内容引用的文件会被自动跳过。"
              onConfirm={removeBatch}
            >
              <a>{batchDeleting ? '批量删除中' : '批量删除'}</a>
            </Popconfirm>
            <a onClick={() => setSelectedRowKeys([])}>取消选择</a>
          </Space>
        )}
        request={async (params) => {
          const res = await fetchAdminFiles({
            keyword: params.keyword as string,
            mimeGroup: params.mimeGroup as 'image' | 'pdf' | 'word' | 'other',
          });
          return { data: res.data ?? [], success: res.code === 0 };
        }}
        columns={[
          { title: '关键字', dataIndex: 'keyword', hideInTable: true },
          {
            title: '文件名',
            dataIndex: 'name',
            render: (_, record) => (
              <Space orientation="vertical" size={0}>
                <span>{record.name}</span>
                <span style={{ color: '#667085', fontSize: 12 }}>{record.id}</span>
              </Space>
            ),
          },
          {
            title: '类型',
            dataIndex: 'mimeGroup',
            valueType: 'select',
            valueEnum: mimeGroupEnum,
            render: (_, record) => <Tag>{record.mimeType}</Tag>,
          },
          {
            title: '用途',
            dataIndex: 'usage',
            search: false,
            render: (_, record) => <Tag color="blue">{record.usage ?? 'attachment'}</Tag>,
          },
          {
            title: '大小',
            dataIndex: 'size',
            search: false,
            render: (_, record) => `${Math.round(record.size / 1024)} KB`,
          },
          {
            title: '引用',
            dataIndex: 'referencedBy',
            search: false,
            render: (_, record) =>
              record.referencedBy?.length ? (
                <Tag color="warning">{record.referencedBy.length} 个内容</Tag>
              ) : (
                <Tag color="success">未引用</Tag>
              ),
          },
          {
            title: '链接',
            dataIndex: 'url',
            search: false,
            ellipsis: true,
            render: (_, record) => (
              <a href={record.url} target="_blank" rel="noreferrer">
                预览
              </a>
            ),
          },
          {
            title: '操作',
            valueType: 'option',
            render: (_, record) => [
              <Popconfirm
                key="delete"
                title="确认删除？"
                description={
                  record.referencedBy?.length
                    ? '该文件被内容引用，当前不能删除。'
                    : '删除后 mock 列表中将移除该文件。'
                }
                onConfirm={() => removeOne(record.id)}
              >
                <a style={{ color: '#ff4d4f' }}>
                  {deletingId === record.id ? '处理中' : '删除'}
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
