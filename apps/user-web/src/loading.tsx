import React from 'react';
import SectionSkeleton from '@/components/shared/SectionSkeleton';

/** 内容列表用卡片骨架，阅读页用正文骨架，避免进页后再换成另一种。 */
function routeSkeletonVariant(pathname: string): 'content' | 'article' {
  if (pathname === '/content') return 'content';
  return 'article';
}

/**
 * 路由分包还没下来时占住整屏。
 * 形状和目标页自己的大骨架一致，分包下来后不会再换一套。
 */
const Loading: React.FC = () => (
  <div className="ph-route-loading">
    <SectionSkeleton variant={routeSkeletonVariant(window.location.pathname)} rows={16} count={6} fill />
  </div>
);

export default Loading;
