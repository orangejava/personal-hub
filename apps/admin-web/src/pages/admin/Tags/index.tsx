import { ModalForm, ProFormText, ProTable } from '@ant-design/pro-components';
import { message, Popconfirm } from 'antd';
import React, { useState } from 'react';
import { PageContainer, ResultState } from '@/components/shared';
import { createAdminTag, deleteAdminTag, fetchAdminTags } from '@/services/admin';

/** 标签管理 */
const Tags: React.FC = () => {
  const [reloadKey, setReloadKey] = useState(0);
  const [deletingId, setDeletingId] = useState<string>();

  return (
    <PageContainer
      title="标签管理"
      extra={
        <ModalForm
          title="新建标签"
          trigger={<a>新建标签</a>}
          onFinish={async (values) => {
            await createAdminTag(values as { name: string; slug: string });
            message.success('已创建');
            setReloadKey((k) => k + 1);
            return true;
          }}
        >
          <ProFormText name="name" label="名称" rules={[{ required: true }]} />
          <ProFormText name="slug" label="Slug" rules={[{ required: true }]} />
        </ModalForm>
      }
    >
      <ProTable
        key={reloadKey}
        rowKey="id"
        search={false}
        locale={{
          emptyText: <ResultState status="empty" description="暂无标签" />,
        }}
        request={async () => {
          const res = await fetchAdminTags();
          return { data: res ?? [], success: true };
        }}
        columns={[
          { title: '名称', dataIndex: 'name' },
          { title: 'Slug', dataIndex: 'slug' },
          { title: '使用次数', dataIndex: 'usageCount' },
          {
            title: '操作',
            valueType: 'option',
            render: (_, r) => [
              <Popconfirm
                key="delete"
                title="确认删除？"
                onConfirm={async () => {
                  setDeletingId(r.id);
                  try {
                    await deleteAdminTag(r.id);
                    message.success('已删除');
                    setReloadKey((k) => k + 1);
                  } finally {
                    setDeletingId(undefined);
                  }
                }}
              >
                <a>{deletingId === r.id ? '处理中' : '删除'}</a>
              </Popconfirm>,
            ],
          },
        ]}
      />
    </PageContainer>
  );
};

export default Tags;
