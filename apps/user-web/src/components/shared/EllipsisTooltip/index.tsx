import { Tooltip } from 'antd';
import clsx from 'clsx';
import React, { useEffect, useRef, useState } from 'react';

interface EllipsisTooltipProps {
  /** 完整文本，用于 Tooltip 与溢出检测 */
  title: string;
  /** 展示行数：1 单行省略，2 两行省略 */
  lines?: 1 | 2;
  className?: string;
  /** 默认渲染 title；可传入 Link 等子节点，仍以 title 作为 Tooltip 文案 */
  children?: React.ReactNode;
}

/**
 * 文本溢出省略 + Tooltip：仅在内容被截断时显示完整提示，避免短文本误弹。
 */
const EllipsisTooltip: React.FC<EllipsisTooltipProps> = ({
  title,
  lines = 1,
  className,
  children,
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [overflowed, setOverflowed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const check = () => {
      if (lines === 1) {
        setOverflowed(el.scrollWidth > el.clientWidth + 1);
      } else {
        setOverflowed(el.scrollHeight > el.clientHeight + 1);
      }
    };

    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [title, lines]);

  return (
    <Tooltip title={overflowed ? title : undefined}>
      <span
        ref={ref}
        className={clsx(
          'ph-ellipsis-tooltip',
          lines === 1 ? 'ph-ellipsis-1' : 'ph-ellipsis-2',
          className,
        )}
      >
        {children ?? title}
      </span>
    </Tooltip>
  );
};

export default EllipsisTooltip;
