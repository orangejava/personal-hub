import { SettingOutlined } from '@ant-design/icons';
import { Button, Modal, Popover, Space } from 'antd';
import React, { useState } from 'react';
import { useViewportBand } from '@/hooks/useViewportBand';
import {
  useIsComposerMoreSurface,
  useOpenAfterComposerMoreCloses,
} from '../AiComposer/moreActionContext';

type AiConfigValue = string | number;

/** 接口可能把数字存成字符串，用宽松比较才能标出当前选中项。 */
function isConfigOptionActive(option: AiConfigValue, current?: AiConfigValue) {
  if (current === undefined || current === null || current === '') return false;
  return String(option) === String(current);
}

interface AiConfigOption {
  label: React.ReactNode;
  value: AiConfigValue;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface AiConfigGroup {
  key: string;
  title: string;
  type: 'segmented' | 'grid';
  value?: AiConfigValue;
  columns?: number;
  options: AiConfigOption[];
  onChange: (value: AiConfigValue) => void;
}

interface AiConfigPopoverProps {
  title?: string;
  buttonText?: string;
  groups: AiConfigGroup[];
}

/**
 * 图片 / 视频生成参数弹窗。
 *
 * 配置内容完全由分组 schema 驱动，点击选项立即写回页面状态，
 * 关闭弹窗时自然保留当前选择。
 */
const AiConfigPopover: React.FC<AiConfigPopoverProps> = ({
  title = '生成配置',
  buttonText = '配置',
  groups,
}) => {
  const { band } = useViewportBand();
  const [open, setOpen] = useState(false);
  const openAfterMoreCloses = useOpenAfterComposerMoreCloses();
  const inMoreSurface = useIsComposerMoreSurface();
  const content = (
    <div className="ph-ai-config-popover">
      {groups.map((group) => (
        <section className="ph-ai-config-group" key={group.key}>
          <h3>{group.title}</h3>
          <div
            className={[
              'ph-ai-config-options',
              group.type === 'grid' ? 'ph-ai-config-options-grid' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={
              group.type === 'grid'
                ? {
                    gridTemplateColumns: `repeat(${group.columns ?? 3}, minmax(0, 1fr))`,
                  }
                : undefined
            }
          >
            {group.options.map((option) => {
              const active = isConfigOptionActive(option.value, group.value);
              return (
                <button
                  className={[
                    'ph-ai-config-option',
                    active ? 'ph-ai-config-option-active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={option.disabled}
                  key={String(option.value)}
                  type="button"
                  onClick={() => group.onChange(option.value)}
                >
                  {option.icon && (
                    <span className="ph-ai-config-option-icon">{option.icon}</span>
                  )}
                  <span>{option.label}</span>
                  {option.description && (
                    <small>{option.description}</small>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );

  // 手机或已收进「更多」时使用 Modal，避免 Popover 锚在退出中的底部 Drawer 上。
  if (band === 'phone' || inMoreSurface) {
    return (
      <>
        <Button
          icon={<SettingOutlined />}
          size="small"
          onClick={() => openAfterMoreCloses(() => setOpen(true))}
        >
          {buttonText}
        </Button>
        <Modal
          centered
          footer={null}
          open={open}
          rootClassName="ph-ai-config-modal"
          title={title}
          width="min(560px, calc(100vw - 32px))"
          onCancel={() => setOpen(false)}
        >
          {content}
        </Modal>
      </>
    );
  }

  return (
    <Popover
      arrow={false}
      classNames={{ root: 'ph-ai-config-popover-root' }}
      content={content}
      placement="topLeft"
      title={title}
      trigger="click"
    >
      <Button icon={<SettingOutlined />} size="small">
        <Space size={4}>{buttonText}</Space>
      </Button>
    </Popover>
  );
};

export default AiConfigPopover;
export type { AiConfigGroup, AiConfigOption, AiConfigValue };
