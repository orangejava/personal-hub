import { ProTable } from '@ant-design/pro-components';
import { ContentType } from '@personal-hub/shared-types';
import { App, Popconfirm, Tag } from 'antd';
import React, { useState } from 'react';
import { PageContainer } from '@/components/shared';
import { DEFAULT_TABLE_PAGINATION } from '@/constants/tablePagination';
import { getUserWebOrigin } from '@personal-hub/app-origins';
import { deleteAdminContent, fetchAdminContents } from '@/services/admin';

/** 小册管理：列表与删除 */
const Booklets: React.FC = () => {
  const { message } = App.useApp();
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <PageContainer title="小册管理">
      <ProTable
        key={reloadKey}
        rowKey="id"
        search={false}
        pagination={DEFAULT_TABLE_PAGINATION}
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
              <>
                <a href={`${getUserWebOrigin()}/content/${r.id}`}>{r.title}</a>
                {r.reviewStatus === 'PENDING' ? (
                  <Tag color="processing" style={{ marginLeft: 8 }}>
                    待审核
                  </Tag>
                ) : r.importRestriction === 'PRIVATE_UNTIL_LICENSED' ? (
                  <Tag color="orange" style={{ marginLeft: 8 }}>
                    待审公开
                  </Tag>
                ) : null}
              </>
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
