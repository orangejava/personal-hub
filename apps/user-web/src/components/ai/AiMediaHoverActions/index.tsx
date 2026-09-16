import React from 'react';

export interface AiMediaHoverAction {
  key: string;
  icon: React.ReactNode;
  title: string;
  href?: string;
  onClick?: () => void;
}

interface AiMediaHoverActionsProps {
  top?: AiMediaHoverAction[];
  bottom?: AiMediaHoverAction[];
}

function AiMediaHoverButton({
  action,
  showLabel,
}: {
  action: AiMediaHoverAction;
  showLabel: boolean;
}) {
  const className = 'ph-ai-media-hover-btn';
  const content = (
    <>
      {action.icon}
      {showLabel ? <span>{action.title}</span> : null}
    </>
  );
  if (action.href) {
    return (
      <a
        className={className}
        href={action.href}
        rel="noreferrer"
        target="_blank"
        title={action.title}
      >
        {content}
      </a>
    );
  }
  return (
    <button
      className={className}
      type="button"
      title={action.title}
      onClick={action.onClick}
    >
      {content}
    </button>
  );
}

function AiMediaHoverBar({
  actions,
  placement,
}: {
  actions: AiMediaHoverAction[];
  placement: 'top' | 'bottom';
}) {
  if (actions.length === 0) return null;
  return (
    <div className={`ph-ai-media-hover ph-ai-media-hover-${placement}`}>
      <div
        className={`ph-ai-media-hover-bar ph-ai-media-hover-bar-${actions.length}`}
      >
        {actions.map((action) => (
          <AiMediaHoverButton
            action={action}
            key={action.key}
            showLabel={actions.length === 1}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * 图片/视频卡片上的 hover 操作条。
 * 宽度始终小于媒体本身；1/2/3 个按钮在条内均分。
 */
const AiMediaHoverActions: React.FC<AiMediaHoverActionsProps> = ({
  top = [],
  bottom = [],
}) => (
  <>
    <AiMediaHoverBar actions={top} placement="top" />
    <AiMediaHoverBar actions={bottom} placement="bottom" />
  </>
);

export default AiMediaHoverActions;
