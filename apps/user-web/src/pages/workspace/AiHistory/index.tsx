import { type ActionType, ProTable } from '@ant-design/pro-components';
import type { AiConversation } from '@personal-hub/shared-types';
import { history, Link, useIntl } from '@umijs/max';
import { Button, Input, message, Modal, Popconfirm, Space, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import { PageContainer, ResultState } from '@/components/shared';
import {
  batchDeleteWorkspaceAiHistory,
  deleteWorkspaceAiHistory,
  fetchWorkspaceAiHistory,
  renameWorkspaceAiHistory,
} from '@/services/workspace';

/** 工作区 AI 历史：复用 AI 会话 mock，并跳转到 AI 工作台继续对话。 */
const AiHistory: React.FC = () => {
  const intl = useIntl();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [renaming, setRenaming] = useState<AiConversation | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [operating, setOperating] = useState(false);

  const reload = () => actionRef.current?.reload();

  const continueChat = (sessionId: string) => {
    history.push(sessionId ? `/ai/chat?sessionId=${encodeURIComponent(sessionId)}` : '/ai/chat');
  };

  const removeOne = async (id: string) => {
    setOperating(true);
    try {
      await deleteWorkspaceAiHistory(id);
      message.success('已删除会话');
      reload();
    } finally {
      setOperating(false);
    }
  };

  const removeBatch = async () => {
    if (!selectedRowKeys.length) {
      message.warning('请先选择要删除的会话');
      return;
    }
    setOperating(true);
    try {
      const res = await batchDeleteWorkspaceAiHistory(selectedRowKeys.map(String));
      message.success(`已删除 ${res.deleted.length} 个会话`);
      setSelectedRowKeys([]);
      reload();
    } finally {
      setOperating(false);
    }
  };

  const submitRename = async () => {
    if (!renaming) return;
    const title = renameTitle.trim();
    if (!title) {
      message.warning('请输入会话标题');
      return;
    }
    setOperating(true);
    try {
      await renameWorkspaceAiHistory(renaming.id, title);
      message.success('会话已重命名');
      setRenaming(null);
      reload();
    } finally {
      setOperating(false);
    }
  };

  return (
    <PageContainer
      title={intl.formatMessage({ id: 'workspace.aiHistory.title' })}
      extra={
        <Button type="primary" onClick={() => continueChat('')}>
          发起对话
        </Button>
      }
    >
      <ProTable<AiConversation>
        actionRef={actionRef}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        tableAlertOptionRender={() => (
          <Space>
            <Popconfirm
              title="确认批量删除？"
              description="删除后该 mock 会话会从工作区历史和 AI 会话列表中移除。"
              onConfirm={removeBatch}
            >
              <a>{operating ? '处理中' : '批量删除'}</a>
            </Popconfirm>
            <a onClick={() => setSelectedRowKeys([])}>取消选择</a>
          </Space>
        )}
        locale={{
          emptyText: (
            <ResultState
              status="empty"
              title="暂无 AI 对话历史"
              description="去 AI 工作台开始第一次对话，历史会出现在这里。"
              actionText="开始对话"
              actionTo="/ai/chat"
            />
          ),
        }}
        request={async (params) => {
          const res = await fetchWorkspaceAiHistory({
            page: params.current,
            pageSize: params.pageSize,
            keyword: params.keyword as string,
          });
          return {
            data: res.list ?? [],
            success: true,
            total: res.total ?? 0,
          };
        }}
        columns={[
          { title: '关键字', dataIndex: 'keyword', hideInTable: true },
          {
            title: '会话标题',
            dataIndex: 'title',
            render: (_, record) => (
              <Link to={`/ai/chat?sessionId=${record.id}`}>{record.title}</Link>
            ),
          },
          {
            title: '模型',
            dataIndex: 'modelId',
            search: false,
            render: (_, record) => <Tag color="blue">{record.modelId}</Tag>,
          },
          {
            title: '消息数',
            dataIndex: 'messageCount',
            search: false,
          },
          {
            title: 'Token',
            dataIndex: 'totalTokens',
            search: false,
            render: (_, record) => record.totalTokens.toLocaleString(),
          },
          {
            title: '最后更新',
            dataIndex: 'lastMessageAt',
            search: false,
            valueType: 'dateTime',
          },
          {
            title: '操作',
            valueType: 'option',
            render: (_, record) => [
              <a key="continue" onClick={() => continueChat(record.id)}>
                继续对话
              </a>,
              <a
                key="rename"
                onClick={() => {
                  setRenaming(record);
                  setRenameTitle(record.title);
                }}
              >
                重命名
              </a>,
              <Popconfirm
                key="delete"
                title="确认删除该会话？"
                description="删除后 mock 会话列表也会同步移除。"
                onConfirm={() => removeOne(record.id)}
              >
                <a style={{ color: '#ff4d4f' }}>{operating ? '处理中' : '删除'}</a>
              </Popconfirm>,
            ],
          },
        ]}
      />

      <Modal
        title="重命名 AI 会话"
        open={!!renaming}
        confirmLoading={operating}
        onCancel={() => setRenaming(null)}
        onOk={submitRename}
      >
        <Input
          value={renameTitle}
          maxLength={40}
          showCount
          placeholder="请输入新的会话标题"
          onChange={(event) => setRenameTitle(event.target.value)}
          onPressEnter={submitRename}
        />
      </Modal>
    </PageContainer>
  );
};

export default AiHistory;
