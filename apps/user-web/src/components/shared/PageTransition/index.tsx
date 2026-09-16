import React from 'react';

interface PageTransitionProps {
  routeKey: string;
  children: React.ReactNode;
}

/**
 * 路由内容统一切换动画。
 *
 * 只包页面主体，不包顶栏/侧栏，避免 ProLayout 导航区域在页面切换时抖动。
 * 动画细节统一由 motion.less 控制，并通过 prefers-reduced-motion 自动降级。
 */
const PageTransition: React.FC<PageTransitionProps> = ({
  routeKey,
  children,
}) => (
  <div key={routeKey} className="ph-page-transition">
    {children}
  </div>
);

export default PageTransition;
