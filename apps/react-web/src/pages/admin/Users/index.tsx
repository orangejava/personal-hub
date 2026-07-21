import { type ActionType, ProTable } from '@ant-design/pro-components';
import { UserRole, UserRoleLabel } from '@personal-hub/shared-types';
import { message, Popconfirm, Select, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import { PageContainer, ResultState } from '@/components/shared';
import {
  fetchAdminUsers,
  updateAdminUserRole,
  updateAdminUserStatus,
} from '@/services/admin';

/** 用户管理：列表、禁用/启用、角色分配 */
const Users: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [operatingId, setOperatingId] = useState<string>();
  const reload = () => actionRef.current?.reload();

  const updateStatus = async (id: string, status: 'active' | 'disabled') => {
    setOperatingId(id);
    try {
      const res = await updateAdminUserStatus(id, status);
      if (res?.code === 0) {
        message.success(status === 'active' ? '已启用' : '已禁用');
        reload();
      } else {
        message.error(res?.message || '操作失败');
      }
    } finally {
      setOperatingId(undefined);
    }
  };

  return (
    <PageContainer title="用户管理">
      <ProTable
        actionRef={actionRef}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        locale={{
          emptyText: <ResultState status="empty" description="暂无用户" />,
        }}
        request={async (params) => {
          const res = await fetchAdminUsers({
            current: params.current,
            pageSize: params.pageSize,
            email: params.email as string,
          });
          return {
            data: res.data?.list ?? [],
            success: res.code === 0,
            total: res.data?.total ?? 0,
          };
        }}
        columns={[
          { title: '邮箱', dataIndex: 'email' },
          { title: '昵称', dataIndex: 'nickname', search: false },
          {
            title: '角色',
            dataIndex: 'role',
            search: false,
            render: (_, r) => (
              <Select
                size="small"
                style={{ width: 120 }}
                value={r.role}
                disabled={operatingId === r.id}
                options={Object.values(UserRole).map((role) => ({
                  label: UserRoleLabel[role],
                  value: role,
                }))}
                onChange={async (role) => {
                  setOperatingId(r.id);
                  try {
                    const res = await updateAdminUserRole(r.id, role);
                    if (res?.code === 0) {
                      message.success('角色已更新');
                      reload();
                    } else {
                      message.error(res?.message || '更新失败');
                    }
                  } finally {
                    setOperatingId(undefined);
                  }
                }}
              />
            ),
          },
          {
            title: '状态',
            dataIndex: 'status',
            search: false,
            render: (_, r) => (
              <Tag color={r.status === 'active' ? 'success' : 'default'}>
                {r.status === 'active' ? '正常' : '已禁用'}
              </Tag>
            ),
          },
          { title: '注册时间', dataIndex: 'createdAt', search: false, valueType: 'dateTime' },
          {
            title: '操作',
            valueType: 'option',
            render: (_, r) => [
              r.status === 'active' ? (
                <Popconfirm
                  key="disable"
                  title="确认禁用该用户？"
                  onConfirm={() => updateStatus(r.id, 'disabled')}
                >
                  <a>{operatingId === r.id ? '处理中' : '禁用'}</a>
                </Popconfirm>
              ) : (
                <a
                  key="enable"
                  onClick={() => updateStatus(r.id, 'active')}
                >
                  {operatingId === r.id ? '处理中' : '启用'}
                </a>
              ),
            ],
          },
        ]}
      />
    </PageContainer>
  );
};

export default Users;
