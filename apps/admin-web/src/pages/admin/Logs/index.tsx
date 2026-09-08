import { ProTable } from '@ant-design/pro-components';
import React, { useState } from 'react';
import { PageContainer, ResultState } from '@/components/shared';
import { DEFAULT_TABLE_PAGINATION, DEFAULT_TABLE_SEARCH } from '@/constants/tablePagination';
import { fetchAdminLogs } from '@/services/admin';

/** 操作日志：只读列表 */
const Logs: React.FC = () => {
  const [reloadKey] = useState(0);

  return (
    <PageContainer title="操作日志">
      <ProTable
        key={reloadKey}
        rowKey="id"
        pagination={DEFAULT_TABLE_PAGINATION}
        search={DEFAULT_TABLE_SEARCH}
        locale={{
          emptyText: <ResultState status="empty" description="暂无操作日志" />,
        }}
        request={async (params) => {
          const res = await fetchAdminLogs({
            current: params.current,
            pageSize: params.pageSize,
            action: params.action as string,
            resource: params.resource as string,
          });
          return {
            data: res.list ?? [],
            success: true,
            total: res.total ?? 0,
          };
        }}
        columns={[
          { title: '操作', dataIndex: 'action' },
          { title: '资源', dataIndex: 'resource' },
          { title: '操作人', dataIndex: 'operator', search: false },
          { title: '详情', dataIndex: 'detail', ellipsis: true, search: false },
          { title: '时间', dataIndex: 'createdAt', valueType: 'dateTime', search: false },
        ]}
      />
    </PageContainer>
  );
};

export default Logs;
