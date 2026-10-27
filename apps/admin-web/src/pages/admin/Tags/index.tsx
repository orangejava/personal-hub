import { type ActionType, ModalForm, ProFormText, ProTable } from '@ant-design/pro-components';
import { useIntl } from '@umijs/max';
import { App, Button, Popconfirm, Space } from 'antd';
import React, { useRef, useState } from 'react';
import { PageContainer } from '@/components/shared';
import { useAdminTablePlaceholder } from '@/components/shared/useAdminTablePlaceholder';
import { settleBatch } from '@/utils/settleBatch';
import { createAdminTag, deleteAdminTag, fetchAdminTags } from '@/services/admin';

/** 标签管理 */
const Tags: React.FC = () => {
  const intl = useIntl();
  const { message } = App.useApp();
  const format = (id: string) => intl.formatMessage({ id });
  const tablePlaceholder = useAdminTablePlaceholder(format('admin.tags.empty'));
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [deletingId, setDeletingId] = useState<string>();
  const [batchRunning, setBatchRunning] = useState(false);
  const batchRunningRef = useRef(false);
  const runBatchDelete = async () => {
    if (batchRunningRef.current) return;
    const ids = selectedRowKeys.map(String);
    batchRunningRef.current = true;
    setBatchRunning(true);
    try {
      const results = await settleBatch(ids, deleteAdminTag);
      const succeeded = results.filter((result) => result.status === 'fulfilled').length;
      const failed = results.length - succeeded;
      if (succeeded) message.success(`${format('admin.tags.deleted')} ${succeeded} 项`);
      if (failed) {
        const failedIds = ids.filter((_, index) => results[index]?.status === 'rejected');
        message.warning(
          `${failed} 个标签删除失败（${failedIds.slice(0, 5).join('、')}${failedIds.length > 5 ? '…' : ''}），可能仍有关联内容`,
        );
      }
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } finally {
      batchRunningRef.current = false;
      setBatchRunning(false);
    }
  };

  return (
    <PageContainer
      title={format('admin.tags.title')}
      extra={
        <ModalForm
          title={format('admin.tags.new')}
          trigger={<a>{format('admin.tags.new')}</a>}
          onFinish={async (values) => {
            await createAdminTag(values as { name: string; slug: string });
            message.success(format('admin.tags.created'));
            actionRef.current?.reload();
            return true;
          }}
        >
          <ProFormText name="name" label={format('admin.tags.name')} rules={[{ required: true }]} />
          <ProFormText name="slug" label="Slug" rules={[{ required: true }]} />
        </ModalForm>
      }
    >
      <ProTable
        actionRef={actionRef}
        rowKey="id"
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
          getCheckboxProps: (record) => ({ disabled: (record.usageCount ?? 0) > 0 }),
        }}
        tableAlertOptionRender={() => (
          <Space>
            <Popconfirm
              title={format('admin.tags.deleteTitle')}
              onConfirm={runBatchDelete}
              okButtonProps={{ loading: batchRunning, disabled: batchRunning }}
            >
              <Button size="small" danger loading={batchRunning} disabled={batchRunning}>
                {format('admin.common.delete')}所选标签
              </Button>
            </Popconfirm>
            <a onClick={() => setSelectedRowKeys([])}>清除选择</a>
          </Space>
        )}
        search={false}
        pagination={false}
        {...tablePlaceholder}
        request={async () => {
          const res = await fetchAdminTags();
          return { data: res ?? [], success: true };
        }}
        columns={[
          { title: format('admin.tags.name'), dataIndex: 'name' },
          { title: 'Slug', dataIndex: 'slug' },
          { title: format('admin.tags.usageCount'), dataIndex: 'usageCount' },
          {
            title: format('admin.common.action'),
            valueType: 'option',
            render: (_, r) => [
              <Popconfirm
                key="delete"
                title={format('admin.tags.deleteTitle')}
                onConfirm={async () => {
                  setDeletingId(r.id);
                  try {
                    await deleteAdminTag(r.id);
                    message.success(format('admin.tags.deleted'));
                    actionRef.current?.reload();
                  } finally {
                    setDeletingId(undefined);
                  }
                }}
              >
                <a>
                  {format(
                    deletingId === r.id
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

export default Tags;
