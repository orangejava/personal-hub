import React, { useLayoutEffect, useRef } from 'react';
import { AiXWelcome } from '@/components/ai-x';
import { shouldFireLoadMoreOnce } from '@/components/ai/workspaceScroll';

interface AiWorkspaceWelcome {
  title: string;
  description: string;
}

interface AiWorkspaceFrameProps {
  className?: string;
  sidePanel?: React.ReactNode;
  rightPanel?: React.ReactNode;
  messageArea: React.ReactNode;
  composer: React.ReactNode;
  showWelcome?: boolean;
  welcome?: AiWorkspaceWelcome;
  autoScrollKey?: React.Key;
  onLoadMoreBefore?: () => void;
  /** 图/视频进页要钉到底；聊天流式更新时不要每次都把用户拽回去。 */
  resetPinOnKeyChange?: boolean;
}

/**
 * AI 三类创作页的统一工作区骨架。
 *
 * 左中右三栏：左侧会话、中间消息+输入、右侧筛选。中间栏有上限宽度，
 * 小屏时自动收缩，避免搜索条挤进对话流。
 */
const AiWorkspaceFrame: React.FC<AiWorkspaceFrameProps> = ({
  className,
  sidePanel,
  rightPanel,
  messageArea,
  composer,
  showWelcome = false,
  welcome,
  autoScrollKey,
  onLoadMoreBefore,
  resetPinOnKeyChange = true,
}) => {
  const messageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pinToBottomRef = useRef(true);
  const readyForLoadMoreRef = useRef(false);
  const loadMoreArmedRef = useRef(true);

  useLayoutEffect(() => {
    if (resetPinOnKeyChange) {
      pinToBottomRef.current = true;
      readyForLoadMoreRef.current = false;
      loadMoreArmedRef.current = true;
    }
    const scroller = messageRef.current;
    const content = contentRef.current;
    if (!scroller || showWelcome) return;

    const stickToBottom = () => {
      if (!pinToBottomRef.current) return;
      scroller.scrollTop = scroller.scrollHeight;
      if (scroller.scrollHeight > scroller.clientHeight + 8) {
        readyForLoadMoreRef.current = true;
      }
    };

    stickToBottom();
    let innerFrame = 0;
    const outerFrame = requestAnimationFrame(() => {
      stickToBottom();
      innerFrame = requestAnimationFrame(stickToBottom);
    });

    // 滚动容器高度固定，只有内部内容变高时才需要再钉一次底部。
    const observer = new ResizeObserver(stickToBottom);
    observer.observe(scroller);
    if (content) observer.observe(content);

    return () => {
      cancelAnimationFrame(outerFrame);
      cancelAnimationFrame(innerFrame);
      observer.disconnect();
    };
  }, [autoScrollKey, resetPinOnKeyChange, showWelcome]);

  const handleMessagesScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    pinToBottomRef.current = distance <= 80;
    const loadMore = shouldFireLoadMoreOnce({
      scrollTop: element.scrollTop,
      ready: readyForLoadMoreRef.current,
      armed: loadMoreArmedRef.current,
    });
    loadMoreArmedRef.current = loadMore.armed;
    if (loadMore.fire) {
      onLoadMoreBefore?.();
    }
  };

  return (
    <div
      className={[
        'ph-ai-workspace-frame',
        sidePanel ? 'ph-ai-workspace-frame-with-side' : '',
        rightPanel ? 'ph-ai-workspace-frame-with-right' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {sidePanel && <aside className="ph-ai-workspace-side">{sidePanel}</aside>}
      <section className="ph-ai-workspace-main">
        <div
          className="ph-ai-workspace-messages"
          ref={messageRef}
          onScroll={handleMessagesScroll}
        >
          <div className="ph-ai-workspace-messages-inner" ref={contentRef}>
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
        </div>
        <div className="ph-ai-workspace-composer">{composer}</div>
      </section>
      {rightPanel && <aside className="ph-ai-workspace-right">{rightPanel}</aside>}
    </div>
  );
};

export default AiWorkspaceFrame;
