import { SettingOutlined } from '@ant-design/icons';
import { Button, Input, Select, Space, Switch, Tag } from 'antd';
import React from 'react';

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
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
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
 * Chat 高级设置面板。
 *
 * 阶段 5 先把模型、System Prompt、上下文窗口等会话级配置沉淀为独立业务组件；
 * 后续接真实会话接口时，页面只需要把这里的 value 透传给 service。
 */
const AiChatAdvancedSettings: React.FC<AiChatAdvancedSettingsProps> = ({
  value,
  modelOptions,
  modelLoading,
  hasModels,
  showModelSelect = true,
  expanded,
  onExpandedChange,
  onChange,
}) => {
  const patchValue = (patch: Partial<AiChatAdvancedSettingsValue>) => {
    onChange({ ...value, ...patch });
  };

  return (
    <div className="ph-ai-chat-settings">
      <div className="ph-ai-chat-settings-summary">
        <Space wrap>
          {showModelSelect && <Tag color="blue">{value.modelId || '等待模型'}</Tag>}
          <Tag>{value.contextLimit} 条上下文</Tag>
          {value.enableKnowledgeReference && <Tag color="green">允许引用知识内容</Tag>}
        </Space>
        <Button
          icon={<SettingOutlined />}
          size="small"
          type="text"
          onClick={() => onExpandedChange(!expanded)}
        >
          高级设置
        </Button>
      </div>

      {expanded && (
        <div className="ph-ai-chat-settings-body">
          <div className="ph-ai-chat-settings-grid">
            {showModelSelect && (
              <div className="ph-ai-field">
                <span>对话模型</span>
                <Select
                  aria-label="选择 Chat 对话模型"
                  value={value.modelId}
                  options={modelOptions}
                  loading={modelLoading}
                  disabled={!hasModels}
                  placeholder="选择 Chat 模型"
                  onChange={(modelId) => patchValue({ modelId })}
                />
              </div>
            )}
            <div className="ph-ai-field">
              <span>上下文窗口</span>
              <Select
                aria-label="选择 Chat 上下文窗口"
                value={value.contextLimit}
                options={contextLimitOptions}
                onChange={(contextLimit) => patchValue({ contextLimit })}
              />
            </div>
            <div className="ph-ai-field ph-ai-chat-settings-switch">
              <span>知识内容引用</span>
              <Switch
                aria-label="开启或关闭知识内容引用"
                checked={value.enableKnowledgeReference}
                checkedChildren="开"
                unCheckedChildren="关"
                onChange={(enableKnowledgeReference) =>
                  patchValue({ enableKnowledgeReference })
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
              value={value.systemPrompt}
              onChange={(event) => patchValue({ systemPrompt: event.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AiChatAdvancedSettings;
