import { useIntl, useRequest } from '@umijs/max';
import { Button, Card, List, message, Popconfirm, Space, Tag } from 'antd';
import React from 'react';
import {
  ErrorState,
  PageContainer,
  SectionSkeleton,
} from '@/components/shared';
import {
  type AuthSessionItem,
  fetchAuthSessions,
  nestError,
  revokeAuthSession,
  revokeOtherAuthSessions,
} from '@/services/auth';

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

/** 工作区登录设备：查看本账号活跃会话，可踢掉其它设备。 */
const Sessions: React.FC = () => {
  const intl = useIntl();
  const { data, loading, error, run } = useRequest(fetchAuthSessions);
  const sessions: AuthSessionItem[] = data ?? [];

  const handleRevoke = async (session: AuthSessionItem) => {
    try {
      await revokeAuthSession(session.id);
      message.success('已退出该设备');
      await run();
    } catch (err: unknown) {
      message.error(nestError(err).message || '操作失败');
    }
  };

  const handleRevokeOthers = async () => {
    try {
      const res = await revokeOtherAuthSessions();
      message.success(`已退出其它 ${res.data?.revokedCount ?? 0} 个会话`);
      await run();
    } catch (err: unknown) {
      message.error(nestError(err).message || '操作失败');
    }
  };

  if (error) {
    return (
      <PageContainer>
        <ErrorState
          title={intl.formatMessage({ id: 'workspace.common.error' })}
          onRetry={run}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={intl.formatMessage({ id: 'workspace.sessions.title' })}
      extra={
        <Popconfirm
          title="退出其它所有设备？"
          onConfirm={handleRevokeOthers}
          okText="确认"
          cancelText="取消"
        >
          <Button>退出其它设备</Button>
        </Popconfirm>
      }
    >
      <Card>
        {loading ? (
          <SectionSkeleton variant="list" count={3} />
        ) : (
          <List
            dataSource={sessions}
            locale={{ emptyText: '暂无活跃会话' }}
            renderItem={(item) => (
              <List.Item
                actions={
                  item.isCurrent
                    ? [
                        <Tag key="current" color="blue">
                          当前设备
                        </Tag>,
                      ]
                    : [
                        <Popconfirm
                          key="revoke"
                          title="退出该设备？"
                          onConfirm={() => handleRevoke(item)}
                        >
                          <Button type="link" danger>
                            退出
                          </Button>
                        </Popconfirm>,
                      ]
                }
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <span>
                        {item.deviceName} · {item.browser}
                      </span>
                    </Space>
                  }
                  description={`IP ${item.ipMasked ?? '未知'} · 最近活跃 ${formatTime(item.lastActiveAt)}`}
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </PageContainer>
  );
};

export default Sessions;
