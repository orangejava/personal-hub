import { SettingOutlined } from '@ant-design/icons';
import { Button, Input, Modal, Select, Space, Switch, Tag } from 'antd';
import React, { useState } from 'react';
import { useOpenAfterComposerMoreCloses } from '../AiComposer/moreActionContext';

export interface AiChatAdvancedSettingsValue {
  modelId?: string;
  systemPrompt: string;
  contextLimit: number;
  enableKnowledgeReference: boolean;
}

interface AiChatAdvancedSettingsProps {
  value: AiChatAdvancedSettingsValue;
  modelOptions: Array<{ label: React.ReactNode; value: string }>;
  modelLoading?: boolean;
  hasModels: boolean;
  showModelSelect?: boolean;
  /** 手机档只留图标按钮，避免设置条把输入区顶出可视范围。 */
  compact?: boolean;
  onChange: (value: AiChatAdvancedSettingsValue) => void;
}

const contextLimitOptions = [
  { label: '最近 10 条', value: 10 },
  { label: '最近 20 条', value: 20 },
  { label: '最近 40 条', value: 40 },
];

const defaultSystemPrompt =
  '你是 Personal Hub AI，回答时先理解用户目标，再给出结构清晰、可执行的建议。';

/**
 * Chat 高级设置。
 * 各宽度都用对话框：保存才写回，点遮罩或取消丢弃草稿。模型选择留在输入栏，不放进这里。
 */
const AiChatAdvancedSettings: React.FC<AiChatAdvancedSettingsProps> = ({
  value,
  modelOptions,
  modelLoading,
  hasModels,
  showModelSelect = true,
  compact = false,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const openAfterMoreCloses = useOpenAfterComposerMoreCloses();

  const openModal = () => {
    setDraft(value);
    setOpen(true);
  };

  const handleOpenModal = () => {
    openAfterMoreCloses(openModal);
  };

  const patchDraft = (patch: Partial<AiChatAdvancedSettingsValue>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  return (
    <div
      className={
        compact
          ? 'ph-ai-chat-settings ph-ai-chat-settings-compact'
          : 'ph-ai-chat-settings'
      }
    >
      {compact ? (
        <Button
          aria-label="高级设置"
          icon={<SettingOutlined />}
          size="small"
          type="text"
          onClick={handleOpenModal}
        >
          高级设置
        </Button>
      ) : (
        <div className="ph-ai-chat-settings-summary">
          <Space wrap>
            {showModelSelect && (
              <Tag color="blue">{value.modelId || '等待模型'}</Tag>
            )}
            <Tag>{value.contextLimit} 条上下文</Tag>
            {value.enableKnowledgeReference && (
              <Tag color="green">允许引用知识内容</Tag>
            )}
          </Space>
          <Button
            icon={<SettingOutlined />}
            size="small"
            type="text"
            onClick={handleOpenModal}
          >
            高级设置
          </Button>
        </div>
      )}

      <Modal
        centered
        open={open}
        rootClassName="ph-ai-chat-settings-modal"
        title="高级设置"
        okText="保存"
        cancelText="取消"
        onOk={() => {
          onChange(draft);
          setOpen(false);
        }}
        onCancel={() => setOpen(false)}
      >
        <div className="ph-ai-chat-settings-body">
          <div className="ph-ai-chat-settings-grid">
            {showModelSelect && (
              <div className="ph-ai-field">
                <span>对话模型</span>
                <Select
                  aria-label="选择 Chat 对话模型"
                  value={draft.modelId}
                  options={modelOptions}
                  loading={modelLoading}
                  disabled={!hasModels}
                  placeholder="选择 Chat 模型"
                  onChange={(modelId) => patchDraft({ modelId })}
                />
              </div>
            )}
            <div className="ph-ai-field">
              <span>上下文窗口</span>
              <Select
                aria-label="选择 Chat 上下文窗口"
                value={draft.contextLimit}
                options={contextLimitOptions}
                onChange={(contextLimit) => patchDraft({ contextLimit })}
              />
            </div>
            <div className="ph-ai-field ph-ai-chat-settings-switch">
              <span>知识内容引用</span>
              <Switch
                aria-label="开启或关闭知识内容引用"
                checked={draft.enableKnowledgeReference}
                checkedChildren="开"
                unCheckedChildren="关"
                onChange={(enableKnowledgeReference) =>
                  patchDraft({ enableKnowledgeReference })
                }
              />
            </div>
          </div>
          <div className="ph-ai-field">
            <span>System Prompt</span>
            <Input.TextArea
              aria-label="编辑 Chat System Prompt"
              autoSize={{ minRows: 3, maxRows: 6 }}
              maxLength={800}
              placeholder={defaultSystemPrompt}
              showCount
              value={draft.systemPrompt}
              onChange={(event) =>
                patchDraft({ systemPrompt: event.target.value })
              }
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AiChatAdvancedSettings;
