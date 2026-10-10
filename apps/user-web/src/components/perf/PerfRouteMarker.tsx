import { useLocation } from '@umijs/max';
import React, { useLayoutEffect } from 'react';
import { markRouteEnd } from '@/utils/perf/routeTiming';

/**
 * 包住布局里的页面内容。
 * 计时结束放在提交后的下一帧，这样懒加载 fallback 还在时不会提前收口。
 */
const PerfRouteMarker: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(() => markRouteEnd(pathname));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return children;
};

export default PerfRouteMarker;
