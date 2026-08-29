import {
  AudioOutlined,
  ClearOutlined,
  PauseCircleOutlined,
  SendOutlined,
  UndoOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Button, Input, Select, Space, Tooltip } from 'antd';
import React, { useCallback, useState } from 'react';

interface AiComposerModel {
  value?: string;
  options: { label: React.ReactNode; value: string; disabled?: boolean }[];
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  onChange: (modelId: string) => void;
}

interface AiComposerProps {
  value: string;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  submitDisabled?: boolean;
  defaultHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  model?: AiComposerModel;
  leadingActions?: React.ReactNode;
  extraActions?: React.ReactNode;
  attachments?: React.ReactNode;
  references?: React.ReactNode;
  footerExtra?: React.ReactNode;
  submitLabel?: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onStop?: () => void;
  onClear?: () => void;
  onVoice?: () => void;
  onOptimize?: (value: string) => string | Promise<string>;
}

const DEFAULT_MIN_HEIGHT = 132;
const DEFAULT_HEIGHT = 148;
const DEFAULT_MAX_HEIGHT = 260;

/**
 * AI 创作输入框。
 *
 * 组件只管理输入区交互和按钮编排，附件、引用内容、模型列表等业务状态由页面传入，
 * 这样 Chat / Image / Video 能共用同一套底部体验。
 */
const AiComposer: React.FC<AiComposerProps> = ({
  value,
  placeholder,
  disabled,
  loading,
  submitDisabled,
  defaultHeight,
  minHeight = DEFAULT_MIN_HEIGHT,
  maxHeight = DEFAULT_MAX_HEIGHT,
  model,
  leadingActions,
  extraActions,
  attachments,
  references,
  footerExtra,
  submitLabel = '发送',
  onChange,
  onSubmit,
  onStop,
  onClear,
  onVoice,
  onOptimize,
}) => {
  const [optimizeSnapshot, setOptimizeSnapshot] = useState<string>();
  const [optimizing, setOptimizing] = useState(false);
  const canSubmit = Boolean(value.trim()) && !disabled && !submitDisabled && !loading;

  const submit = useCallback(() => {
    if (!canSubmit) return;
    onSubmit(value);
  }, [canSubmit, onSubmit, value]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== 'Enter' || event.shiftKey) return;
      event.preventDefault();
      submit();
    },
    [submit],
  );

  const handleOptimize = useCallback(async () => {
    if (!onOptimize || !value.trim()) return;
    setOptimizeSnapshot(value);
    setOptimizing(true);
    try {
      const nextValue = await onOptimize(value);
      onChange(nextValue);
    } finally {
      setOptimizing(false);
    }
  }, [onChange, onOptimize, value]);

  return (
    <div className="ph-ai-composer">
      {(references || attachments) && (
        <div className="ph-ai-composer-context">
          {references}
          {attachments}
        </div>
      )}
      <Input.TextArea
        className="ph-ai-composer-input"
        disabled={disabled}
        placeholder={placeholder}
        style={{ height: defaultHeight ?? DEFAULT_HEIGHT, minHeight, maxHeight }}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="ph-ai-composer-footer">
        <Space className="ph-ai-composer-left" wrap size={8}>
          {model && (
            <Select
              className="ph-ai-composer-model"
              disabled={model.disabled}
              loading={model.loading}
              options={model.options}
              placeholder={model.placeholder ?? '选择模型'}
              size="small"
              value={model.value}
              onChange={model.onChange}
            />
          )}
          {leadingActions}
          {footerExtra}
        </Space>
        <Space className="ph-ai-composer-right" size={6}>
          {extraActions}
          {onOptimize && (
            <Tooltip title="优化提示词">
              <Button
                disabled={!value.trim() || disabled}
                icon={<ThunderboltOutlined />}
                loading={optimizing}
                size="small"
                type="text"
                onClick={handleOptimize}
              />
            </Tooltip>
          )}
          {optimizeSnapshot !== undefined && (
            <Tooltip title="撤销优化">
              <Button
                icon={<UndoOutlined />}
                size="small"
                type="text"
                onClick={() => {
                  onChange(optimizeSnapshot);
                  setOptimizeSnapshot(undefined);
                }}
              />
            </Tooltip>
          )}
          <Tooltip title="语音输入（占位）">
            <Button
              icon={<AudioOutlined />}
              size="small"
              type="text"
              onClick={onVoice}
            />
          </Tooltip>
          <Tooltip title="清空输入">
            <Button
              disabled={!value && !onClear}
              icon={<ClearOutlined />}
              size="small"
              type="text"
              onClick={onClear}
            />
          </Tooltip>
          {loading ? (
            <Tooltip title="停止生成">
              <Button
                icon={<PauseCircleOutlined />}
                shape="circle"
                type="primary"
                onClick={onStop}
              />
            </Tooltip>
          ) : (
            <Tooltip title={submitLabel}>
              <Button
                disabled={!canSubmit}
                icon={<SendOutlined />}
                shape="circle"
                type="primary"
                onClick={submit}
              />
            </Tooltip>
          )}
        </Space>
      </div>
    </div>
  );
};

export default AiComposer;
export type { AiComposerProps };
