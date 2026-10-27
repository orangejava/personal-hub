import { type ActionType, ProTable } from '@ant-design/pro-components';
import { ContentType } from '@personal-hub/shared-types';
import { App, Button, Popconfirm, Space, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import { PageContainer } from '@/components/shared';
import { useAdminTablePlaceholder } from '@/components/shared/useAdminTablePlaceholder';
import { DEFAULT_TABLE_PAGINATION } from '@/constants/tablePagination';
import { getUserWebOrigin } from '@personal-hub/app-origins';
import { settleBatch } from '@/utils/settleBatch';
import { deleteAdminContent, fetchAdminContents } from '@/services/admin';

/** 小册管理：列表与删除 */
const Booklets: React.FC = () => {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const batchRunningRef = useRef(false);
  const tablePlaceholder = useAdminTablePlaceholder('暂无小册');
  const runBatchDelete = async () => {
    if (batchRunningRef.current) return;
    const ids = selectedRowKeys.map(String);
    batchRunningRef.current = true;
    setBatchRunning(true);
    try {
      const results = await settleBatch(ids, deleteAdminContent);
      const succeeded = results.filter((result) => result.status === 'fulfilled').length;
      const failed = results.length - succeeded;
      if (succeeded) message.success(`已删除 ${succeeded} 本小册`);
      if (failed) {
        const failedIds = ids.filter((_, index) => results[index]?.status === 'rejected');
        message.warning(
          `${failed} 本小册删除失败（${failedIds.slice(0, 5).join('、')}${failedIds.length > 5 ? '…' : ''}）`,
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
    <PageContainer title="小册管理">
      <ProTable
        actionRef={actionRef}
        rowKey="id"
        rowSelection={{ selectedRowKeys, preserveSelectedRowKeys: true, onChange: setSelectedRowKeys }}
        tableAlertOptionRender={() => (
          <Space>
            <Popconfirm
              title="确认删除所选小册？"
              onConfirm={runBatchDelete}
              okButtonProps={{ loading: batchRunning, disabled: batchRunning }}
            >
              <Button size="small" danger loading={batchRunning} disabled={batchRunning}>
                批量删除
              </Button>
            </Popconfirm>
            <a onClick={() => setSelectedRowKeys([])}>清除选择</a>
          </Space>
        )}
        search={false}
        pagination={DEFAULT_TABLE_PAGINATION}
        {...tablePlaceholder}
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
                    公开前需提交审核
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
                  actionRef.current?.reload();
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
