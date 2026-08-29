import React, { useEffect, useRef } from 'react';
import { AiXWelcome } from '@/components/ai-x';

interface AiWorkspaceWelcome {
  title: string;
  description: string;
}

interface AiWorkspaceFrameProps {
  className?: string;
  sidePanel?: React.ReactNode;
  messageArea: React.ReactNode;
  composer: React.ReactNode;
  showWelcome?: boolean;
  welcome?: AiWorkspaceWelcome;
  autoScrollKey?: React.Key;
  onLoadMoreBefore?: () => void;
}

/**
 * AI 三类创作页的统一工作区骨架。
 *
 * 这里集中控制 1080px 内容宽度、消息区高度和底部输入区间距，
 * 避免 Chat / Image / Video 各自维护一套布局后出现体验漂移。
 */
const AiWorkspaceFrame: React.FC<AiWorkspaceFrameProps> = ({
  className,
  sidePanel,
  messageArea,
  composer,
  showWelcome = false,
  welcome,
  autoScrollKey,
  onLoadMoreBefore,
}) => {
  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = messageRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [autoScrollKey, showWelcome]);

  return (
    <div
      className={['ph-ai-workspace-frame', className]
        .filter(Boolean)
        .join(' ')}
    >
      {sidePanel && <aside className="ph-ai-workspace-side">{sidePanel}</aside>}
      <section className="ph-ai-workspace-main">
        <div
          className="ph-ai-workspace-messages"
          ref={messageRef}
          onScroll={(event) => {
            if (event.currentTarget.scrollTop <= 24) {
              onLoadMoreBefore?.();
            }
          }}
        >
          {showWelcome && welcome ? (
            <div className="ph-ai-workspace-welcome">
              <AiXWelcome
                description={welcome.description}
                title={welcome.title}
              />
            </div>
          ) : (
            messageArea
          )}
        </div>
        <div className="ph-ai-workspace-composer">{composer}</div>
      </section>
    </div>
  );
};

export default AiWorkspaceFrame;
