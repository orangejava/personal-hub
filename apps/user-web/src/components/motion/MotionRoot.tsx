import { LazyMotion, MotionConfig } from 'motion/react';
import React from 'react';

/**
 * 动画功能包不进首屏同步包。页面只包一层，区块组件使用 `m`，不要直接引 `motion`。
 */
const loadMotionFeatures = () =>
  import('motion/react').then((mod) => mod.domAnimation);

/** 首页和项目页的滚动动效根节点。系统开启减少动态效果时，位移动画关闭，淡入保留。 */
const MotionRoot: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
};

export default MotionRoot;
