import { type ActionType, ProTable } from '@ant-design/pro-components';
import { App, Button, Drawer, Popconfirm, Space, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import { PageContainer, ResultState } from '@/components/shared';
import {
  fetchNestAdminUserSessions,
  fetchNestAdminUsers,
  nestError,
  revokeNestAdminUserSessions,
  type AuthSessionItem,
  type NestAdminUser,
} from '@/services/auth';

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: '系统所有者',
  ADMIN: '管理员',
  EDITOR: '编辑者',
  MEMBER: '普通会员',
};

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  ACTIVE: { text: '正常', color: 'success' },
  PENDING_VERIFICATION: { text: '待验证', color: 'warning' },
  DISABLED: { text: '已禁用', color: 'default' },
};

/**
 * 约束刀后台用户页：只读列表 + 查看会话 + 踢全部设备。
 * 禁用/改角色仍走 mock 契约，本页不再提供，避免 Nest ID 打到 mock。
 */
const Users: React.FC = () => {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [operatingId, setOperatingId] = useState<string>();
  const [sessionUser, setSessionUser] = useState<NestAdminUser | null>(null);
  const [sessions, setSessions] = useState<AuthSessionItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const openSessions = async (user: NestAdminUser) => {
    setSessionUser(user);
    setSessionsLoading(true);
    try {
      const res = await fetchNestAdminUserSessions(user.id);
      setSessions(res ?? []);
    } catch (error: unknown) {
      const nest = nestError(error);
      message.error(nest.message || '无法加载会话');
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  };

  const kickAll = async (user: NestAdminUser) => {
    setOperatingId(user.id);
    try {
      const res = await revokeNestAdminUserSessions(user.id);
      message.success(`已撤销 ${res.revokedCount ?? 0} 个会话`);
      if (sessionUser?.id === user.id) {
        setSessions([]);
      }
    } catch (error: unknown) {
      const nest = nestError(error);
      message.error(nest.message || '踢下线失败');
    } finally {
      setOperatingId(undefined);
    }
  };

  return (
    <PageContainer title="用户管理">
      <ProTable<NestAdminUser>
        actionRef={actionRef}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        locale={{
          emptyText: <ResultState status="empty" description="暂无用户" />,
        }}
        request={async (params) => {
          const res = await fetchNestAdminUsers({
            current: params.current,
            pageSize: params.pageSize,
            email: params.email as string,
          });
          return {
            data: res.list ?? [],
            success: true,
            total: res.total ?? 0,
          };
        }}
        columns={[
          { title: '邮箱', dataIndex: 'email' },
          {
            title: '昵称',
            dataIndex: 'nickname',
            search: false,
            render: (_, r) => r.nickname || '—',
          },
          {
            title: '角色',
            dataIndex: 'role',
            search: false,
            render: (_, r) => ROLE_LABEL[r.role] ?? r.role,
          },
          {
            title: '状态',
            dataIndex: 'status',
            search: false,
            render: (_, r) => {
              const status = STATUS_LABEL[r.status] ?? { text: r.status, color: 'default' };
              return <Tag color={status.color}>{status.text}</Tag>;
            },
          },
          { title: '注册时间', dataIndex: 'createdAt', search: false, valueType: 'dateTime' },
          {
            title: '操作',
            valueType: 'option',
            render: (_, r) => [
              <a key="sessions" onClick={() => void openSessions(r)}>
                查看会话
              </a>,
              <Popconfirm
                key="kick"
                title="确认踢出该用户全部设备？"
                description="对方需要重新登录。不能踢自己或越权踢管理员。"
                onConfirm={() => kickAll(r)}
              >
                <a>{operatingId === r.id ? '处理中' : '踢全部设备'}</a>
              </Popconfirm>,
            ],
          },
        ]}
      />
      <Drawer
        title={sessionUser ? `${sessionUser.email} 的登录设备` : '登录设备'}
        open={Boolean(sessionUser)}
        onClose={() => setSessionUser(null)}
        width={480}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {sessionsLoading ? (
            <span>加载中…</span>
          ) : sessions.length === 0 ? (
            <ResultState status="empty" description="没有活跃会话" />
          ) : (
            sessions.map((item) => (
              <div key={item.id}>
                {item.deviceName} · {item.browser}
                {item.isCurrent ? '（当前设备）' : ''}
                <div style={{ color: 'var(--ph-text-secondary, #888)', fontSize: 12 }}>
                  {item.ipMasked ?? 'IP 未知'} · {item.lastActiveAt}
                </div>
              </div>
            ))
          )}
          {sessionUser && (
            <Popconfirm
              title="确认踢出全部设备？"
              onConfirm={() => kickAll(sessionUser)}
            >
              <Button danger loading={operatingId === sessionUser.id}>
                踢全部设备
              </Button>
            </Popconfirm>
          )}
        </Space>
      </Drawer>
    </PageContainer>
  );
};

export default Users;
