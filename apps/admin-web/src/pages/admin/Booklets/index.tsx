import { ProTable } from '@ant-design/pro-components';
import { ContentType } from '@personal-hub/shared-types';
import { message, Popconfirm } from 'antd';
import React, { useState } from 'react';
import { PageContainer } from '@/components/shared';
import { getUserWebOrigin } from '@personal-hub/app-origins';
import { deleteAdminContent, fetchAdminContents } from '@/services/admin';

/** 小册管理：列表与删除 */
const Booklets: React.FC = () => {
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <PageContainer title="小册管理">
      <ProTable
        key={reloadKey}
        rowKey="id"
        search={false}
        request={async (params) => {
          const res = await fetchAdminContents({
            current: params.current,
            pageSize: params.pageSize,
            type: ContentType.Booklet,
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
          { title: '作者', dataIndex: 'author' },
          { title: '阅读', dataIndex: 'viewCount' },
          {
            title: '操作',
            valueType: 'option',
            render: (_, r) => [
              <Popconfirm
                key="delete"
                title="确认删除小册？"
                onConfirm={async () => {
                  await deleteAdminContent(r.id);
                  message.success('已删除');
                  setReloadKey((k) => k + 1);
                }}
              >
                <a>删除</a>
              </Popconfirm>,
            ],
          },
        ]}
      />
    </PageContainer>
  );
};

export default Booklets;
