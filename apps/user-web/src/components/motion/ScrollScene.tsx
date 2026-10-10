import { useMotionValueEvent, useScroll } from 'motion/react';
import React, { useRef, useState } from 'react';
import './motion.less';

interface ScrollSceneProps {
  /** 滚动进度 0–1。调用方用它切换步骤，不在这里写具体区块内容。 */
  children: (progress: number) => React.ReactNode;
  /** 固定视口重复几次。平台能力三张卡片用 3。 */
  steps?: number;
  className?: string;
}

/**
 * 把一段区域固定在顶栏下方，用原生滚动进度驱动内部动画。
 * 不接管滚轮，也不做整页吸附。
 */
const ScrollScene: React.FC<ScrollSceneProps> = ({
  children,
  steps = 1,
  className,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  });
  const [progress, setProgress] = useState(0);
  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    setProgress(value);
  });
  const count = Math.max(steps, 1);

  return (
    <div
      ref={ref}
      className={className}
      style={{ height: `calc(${count} * (100svh - var(--ph-header-height)))` }}
    >
      <div className="ph-scroll-scene-sticky">{children(progress)}</div>
    </div>
  );
};

export default ScrollScene;
