import React from 'react';

type MotionSurfaceVariant = 'page' | 'content' | 'soft' | 'none';

interface MotionSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: MotionSurfaceVariant;
  children: React.ReactNode;
}

/**
 * 轻量进入动效容器。
 *
 * 用于卡片区块、详情主体和局部内容切换。页面本身仍由 PageTransition 负责，
 * 这里避免页面里分散写 animation class，同时可通过 variant 控制强弱。
 */
const MotionSurface: React.FC<MotionSurfaceProps> = ({
  variant = 'content',
  className,
  children,
  ...rest
}) => {
  const motionClass =
    variant === 'none' ? '' : `ph-motion-surface ph-motion-surface-${variant}`;
  return (
    <div className={[motionClass, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  );
};

export default MotionSurface;
