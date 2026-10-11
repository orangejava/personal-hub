import { MoreOutlined } from '@ant-design/icons';
import { Button, Drawer } from 'antd';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import viewportBands from '@/config/viewport-bands.json';

export interface ReaderBarAction {
  key: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}

interface ReaderActionBarProps {
  /** 底栏主按钮。数组前面的优先留在外面。 */
  primary: ReaderBarAction[];
  /** 始终放在「更多」里的低频操作。 */
  more: ReaderBarAction[];
  /** 贴在按钮上方的状态，例如阅读进度。不传则底栏只有按钮。 */
  notice?: React.ReactNode;
  /**
   * 手机档才按剩余宽度从 primary 末尾收回「更多」。
   * 平板和矮桌面用固定的整组主按钮，不再套手机算法。
   */
  progressive: boolean;
}

/** 按标签实际字数估算最小宽度，避免按钮被 flex 压到 44px 以下。 */
function actionMinWidth(label: string): number {
  return Math.max(viewportBands.controlMinSize, label.length * 16 + 40);
}

/**
 * 阅读页底部操作栏。
 * Portal 到 body，避免页面切换动画的 transform 把 fixed 栏困在滚动容器里。
 */
const ReaderActionBar: React.FC<ReaderActionBarProps> = ({
  primary,
  more,
  progressive,
  notice,
}) => {
  const rootRef = useRef<HTMLElement>(null);
  const pendingActionRef = useRef<(() => void) | undefined>(undefined);
  const [moreOpen, setMoreOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(progressive ? 1 : primary.length);

  useLayoutEffect(() => {
    if (!progressive) {
      setVisibleCount(primary.length);
      return;
    }
    const root = rootRef.current;
    if (!root) return;

    const fit = () => {
      const available = root.clientWidth - 16;
      let used = actionMinWidth('更多') + 8;
      let count = 0;
      for (const item of primary) {
        const need = actionMinWidth(item.label) + 8;
        if (count > 0 && used + need > available) break;
        used += need;
        count += 1;
      }
      setVisibleCount(Math.max(1, Math.min(count, primary.length)));
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(root);
    return () => observer.disconnect();
  }, [primary, progressive]);

  if (typeof document === 'undefined') return null;

  const visible = primary.slice(0, visibleCount);
  const overflow = [...primary.slice(visibleCount), ...more];

  const run = (action: ReaderBarAction) => {
    if (!moreOpen) {
      action.onClick();
      return;
    }
    pendingActionRef.current = action.onClick;
    setMoreOpen(false);
  };

  const handleMoreAfterOpenChange = (nextOpen: boolean) => {
    if (nextOpen || !pendingActionRef.current) return;
    const action = pendingActionRef.current;
    pendingActionRef.current = undefined;
    action();
  };

  return createPortal(
    <>
      <nav
        ref={rootRef}
        className={
          notice
            ? 'ph-reader-mobile-controls ph-reader-mobile-controls-with-notice'
            : 'ph-reader-mobile-controls'
        }
        aria-label="阅读操作"
      >
        {notice}
        <div className="ph-reader-mobile-controls-actions">
          {visible.map((action) => (
            <Button
              key={action.key}
              type="text"
              icon={action.icon}
              disabled={action.disabled}
              onClick={() => run(action)}
            >
              {action.label}
            </Button>
          ))}
          <Button type="text" icon={<MoreOutlined />} onClick={() => setMoreOpen(true)}>
            更多
          </Button>
        </div>
      </nav>
      <Drawer
        afterOpenChange={handleMoreAfterOpenChange}
        className="ph-booklet-mobile-action-sheet"
        placement="bottom"
        size="auto"
        title="更多"
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
      >
        <div className="ph-booklet-mobile-action-grid">
          {overflow.map((action) => (
            <Button
              key={action.key}
              type="text"
              icon={action.icon}
              disabled={action.disabled}
              onClick={() => run(action)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </Drawer>
    </>,
    document.body,
  );
};

export default ReaderActionBar;
