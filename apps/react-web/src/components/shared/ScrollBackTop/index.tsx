import { FloatButton } from 'antd';
import React from 'react';
import { createPortal } from 'react-dom';

export interface ScrollBackTopProps {
  /** 滚动超过该距离（px）后显示，默认 200 */
  visibilityHeight?: number;
  /** 回到顶部的滚动动画时长（ms） */
  duration?: number;
  className?: string;
}

/** 监听 window 滚动，供 BackTop 绑定；模块级常量避免 effect 反复解绑/重绑 */
const getWindowScrollTarget = () => window;

/**
 * 页面回到顶部：挂到 body，避免 PageTransition 的 transform 破坏 fixed 定位。
 * 使用 antd BackTop 内置的 fade 显隐动画；监听 window 滚动。
 */
const ScrollBackTop: React.FC<ScrollBackTopProps> = ({
  visibilityHeight = 200,
  duration = 450,
  className = 'ph-scroll-back-top',
}) => {
  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <FloatButton.BackTop
      className={className}
      visibilityHeight={visibilityHeight}
      duration={duration}
      target={getWindowScrollTarget}
      aria-label="回到顶部"
    />,
    document.body,
  );
};

export default ScrollBackTop;
