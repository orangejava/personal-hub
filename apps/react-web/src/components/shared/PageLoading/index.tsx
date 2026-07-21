import { Spin } from 'antd';
import React from 'react';

interface PageLoadingProps {
  tip?: string;
  minHeight?: number | string;
}

/**
 * 页面级加载态。
 *
 * 用于路由首屏、权限初始化或整页数据等待，避免页面短暂白屏。
 * 区块内局部请求优先使用 SectionSkeleton，避免整页 loading 打断阅读。
 */
const PageLoading: React.FC<PageLoadingProps> = ({
  tip = '加载中',
  minHeight = 320,
}) => (
  <div className="ph-loading-center" style={{ minHeight }}>
    <Spin description={tip} />
  </div>
);

export default PageLoading;
