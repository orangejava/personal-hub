import {
  DeleteOutlined,
  EditOutlined,
  MoreOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { AiConversation } from '@personal-hub/shared-types';
import { Button, Input, Skeleton, Tooltip } from 'antd';
import React, { useMemo, useState } from 'react';
import { AiXConversations } from '@/components/ai-x';
import { ResultState } from '@/components/shared';

interface AiConversationHistoryPanelProps {
  sessions: AiConversation[];
  activeKey?: string;
  loading?: boolean;
  onCreate: () => void;
  onActiveChange: (sessionId: string) => void;
  onRename: (sessionId: string, title: string) => void;
  onDelete: (sessionId: string, title: string) => void;
}

const PAGE_SIZE = 20;

/**
 * Chat 左侧会话历史。
 *
 * 顶部操作区固定，列表独立滚动；当前按已加载会话做前端分页。
 */
const AiConversationHistoryPanel: React.FC<AiConversationHistoryPanelProps> = ({
  sessions,
  activeKey,
  loading,
  onCreate,
  onActiveChange,
  onRename,
  onDelete,
}) => {
  const [keyword, setKeyword] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const normalizedKeyword = keyword.trim().toLowerCase();
  const filteredSessions = useMemo(
    () =>
      normalizedKeyword
        ? sessions.filter((session) =>
            [
              session.title,
              session.modelId,
              `${session.messageCount} 条消息`,
              `${session.totalTokens} Token`,
            ]
              .join(' ')
              .toLowerCase()
              .includes(normalizedKeyword),
          )
        : sessions,
    [normalizedKeyword, sessions],
  );
  const visibleSessions = filteredSessions.slice(0, visibleCount);
  const hasMore = visibleCount < filteredSessions.length;

  return (
    <div className="ph-ai-panel ph-ai-conversation-panel">
      <div className="ph-ai-conversation-panel-header">
        <Button
          block
          className="ph-ai-conversation-create"
          icon={<PlusOutlined />}
          type="primary"
          onClick={onCreate}
        >
          新建对话
        </Button>
        <Input.Search
          allowClear
          className="ph-ai-conversation-search"
          placeholder="搜索会话、模型或 Token"
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value);
            setVisibleCount(PAGE_SIZE);
          }}
          onSearch={(nextKeyword) => {
            setKeyword(nextKeyword);
            setVisibleCount(PAGE_SIZE);
          }}
        />
      </div>
      <div
        className="ph-ai-conversation-scroll"
        onScroll={(event) => {
          const element = event.currentTarget;
          if (
            hasMore &&
            element.scrollTop + element.clientHeight >= element.scrollHeight - 24
          ) {
            setVisibleCount((count) => Math.min(count + PAGE_SIZE, filteredSessions.length));
          }
        }}
      >
        {loading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : visibleSessions.length === 0 ? (
          <ResultState
            status={normalizedKeyword ? 'filtered-empty' : 'empty'}
            description={
              normalizedKeyword
                ? '未找到会话，换个关键词试试，或新建一个对话。'
                : '还没有对话。直接在右侧提问，或点上方新建对话。'
            }
            clearText={normalizedKeyword ? '清除搜索' : undefined}
            onClear={
              normalizedKeyword
                ? () => {
                    setKeyword('');
                    setVisibleCount(PAGE_SIZE);
                  }
                : undefined
            }
          />
        ) : (
          <>
            <AiXConversations
              activeKey={activeKey}
              items={visibleSessions.map((session) => ({
                key: session.id,
                label: (
                  <Tooltip mouseEnterDelay={0.3} title={session.title}>
                    <span className="ph-ai-conversation-title">{session.title}</span>
                  </Tooltip>
                ),
              }))}
              menu={(conversation) => {
                const session = visibleSessions.find((item) => item.id === conversation.key);
                const title = session?.title || '未命名对话';
                return {
                  trigger: (
                    <Button
                      aria-label={`打开“${title}”操作菜单`}
                      icon={<MoreOutlined />}
                      size="small"
                      type="text"
                    />
                  ),
                  items: [
                    {
                      key: 'rename',
                      icon: <EditOutlined />,
                      label: '重命名',
                      onClick: () => onRename(conversation.key, title),
                    },
                    {
                      key: 'delete',
                      danger: true,
                      icon: <DeleteOutlined />,
                      label: '删除',
                      onClick: () => onDelete(conversation.key, title),
                    },
                  ],
                };
              }}
              onActiveChange={onActiveChange}
            />
            {hasMore && (
              <button
                className="ph-ai-conversation-load-more"
                type="button"
                onClick={() =>
                  setVisibleCount((count) => Math.min(count + PAGE_SIZE, filteredSessions.length))
                }
              >
                加载更多会话
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AiConversationHistoryPanel;
