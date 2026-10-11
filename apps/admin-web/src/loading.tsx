import React from 'react';
import SectionSkeleton from '@/components/shared/SectionSkeleton';

/** 后台路由分包等待。侧栏已经在，只占内容区，不盖住菜单。 */
const Loading: React.FC = () => (
  <div className="ph-route-loading" style={{ padding: '8px 0 24px' }}>
    <SectionSkeleton variant="table" rows={12} />
  </div>
);

export default Loading;
