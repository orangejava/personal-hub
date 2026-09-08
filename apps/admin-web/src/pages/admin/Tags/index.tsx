import { ModalForm, ProFormText, ProTable } from '@ant-design/pro-components';
import { useIntl } from '@umijs/max';
import { App, Popconfirm } from 'antd';
import React, { useState } from 'react';
import { PageContainer, ResultState } from '@/components/shared';
import { createAdminTag, deleteAdminTag, fetchAdminTags } from '@/services/admin';

/** 标签管理 */
const Tags: React.FC = () => {
  const intl = useIntl();
  const { message } = App.useApp();
  const format = (id: string) => intl.formatMessage({ id });
  const [reloadKey, setReloadKey] = useState(0);
  const [deletingId, setDeletingId] = useState<string>();

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
            setReloadKey((k) => k + 1);
            return true;
          }}
        >
          <ProFormText name="name" label={format('admin.tags.name')} rules={[{ required: true }]} />
          <ProFormText name="slug" label="Slug" rules={[{ required: true }]} />
        </ModalForm>
      }
    >
      <ProTable
        key={reloadKey}
        rowKey="id"
        search={false}
        pagination={false}
        locale={{
          emptyText: <ResultState status="empty" description={format('admin.tags.empty')} />,
        }}
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
                    setReloadKey((k) => k + 1);
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
