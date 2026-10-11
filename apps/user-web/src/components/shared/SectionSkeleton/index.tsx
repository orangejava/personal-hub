import { Card, Col, Row, Skeleton } from 'antd';
import React from 'react';

type SectionSkeletonVariant =
  | 'card'
  | 'list'
  | 'content'
  | 'table'
  | 'article'
  | 'stats'
  | 'form'
  | 'media'
  | 'dashboard';

interface SectionSkeletonProps {
  variant?: SectionSkeletonVariant;
  rows?: number;
  count?: number;
  columns?: number;
  minHeight?: number | string;
  /** 占满顶栏以下的可视区域，避免路由等待时下半屏留白。 */
  fill?: boolean;
}

/**
 * 区块级骨架屏。
 *
 * 统一列表、卡片、表格和正文的加载占位尺寸，减少数据回来前后的布局跳动。
 */
const SectionSkeleton: React.FC<SectionSkeletonProps> = ({
  variant = 'card',
  rows = 4,
  count = 3,
  columns = 3,
  minHeight,
  fill = false,
}) => {
  const createKeys = (length: number, prefix: string) =>
    Array.from({ length }, (_, index) => `${prefix}-${index + 1}`);
  const rootClass = ['ph-section-skeleton', fill ? 'ph-section-skeleton-fill' : '']
    .filter(Boolean)
    .join(' ');

  if (variant === 'table') {
    return (
      <div className={`${rootClass} ph-table-skeleton`} style={{ minHeight }}>
        <Skeleton active title paragraph={{ rows: 1 }} />
        {createKeys(rows, 'table-row').map((key) => (
          <Skeleton
            // 表格骨架只表达稳定行高，不承载业务身份。
            key={key}
            active
            title={false}
            paragraph={{ rows: 1, width: ['100%'] }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={rootClass} style={{ minHeight }}>
        {createKeys(count, 'list-item').map((key) => (
          <Card key={key} className="ph-skeleton-card">
            <Skeleton active avatar paragraph={{ rows }} />
          </Card>
        ))}
      </div>
    );
  }

  // 和内容中心卡片同一套栅格：封面 16:9，下面标题和两行摘要，避免加载完高度跳变。
  if (variant === 'content') {
    return (
      <Row gutter={[16, 16]} className={rootClass} style={{ minHeight }}>
        {createKeys(count, 'content-card').map((key) => (
          <Col xs={24} md={12} lg={8} key={key}>
            <Card className="ph-skeleton-card ph-content-card-skeleton" cover={<div className="ph-content-card-cover" />}>
              <Skeleton active title paragraph={{ rows: 2 }} />
            </Card>
          </Col>
        ))}
      </Row>
    );
  }

  if (variant === 'article') {
    return (
      <Card className={rootClass} style={{ minHeight }}>
        <Skeleton active paragraph={{ rows: Math.max(rows, 8) }} />
      </Card>
    );
  }

  if (variant === 'form') {
    return (
      <Card className={`${rootClass} ph-form-skeleton`} style={{ minHeight }}>
        <Skeleton active title paragraph={{ rows: 2 }} />
        {createKeys(count, 'form-row').map((key) => (
          <div key={key} className="ph-form-skeleton-row">
            <Skeleton.Input active block />
            <Skeleton.Input active block />
          </div>
        ))}
      </Card>
    );
  }

  if (variant === 'media') {
    return (
      <div className={`${rootClass} ph-media-skeleton`} style={{ minHeight }}>
        <Skeleton.Node active className="ph-media-skeleton-node" />
        <Skeleton active title={false} paragraph={{ rows: 2 }} />
      </div>
    );
  }

  if (variant === 'stats' || variant === 'dashboard') {
    return (
      <Row gutter={[16, 16]} className={rootClass} style={{ minHeight }}>
        {createKeys(count, `${variant}-item`).map((key) => (
          <Col xs={24} sm={12} lg={Math.floor(24 / columns)} key={key}>
            <Card className="ph-skeleton-card ph-stats-skeleton-card">
              <Skeleton active title paragraph={{ rows: variant === 'dashboard' ? 3 : 1 }} />
            </Card>
          </Col>
        ))}
      </Row>
    );
  }

  return (
    <Row gutter={[16, 16]} className={rootClass} style={{ minHeight }}>
      {createKeys(count, 'card-item').map((key) => (
        <Col xs={24} sm={12} lg={Math.floor(24 / columns)} key={key}>
          <Card className="ph-skeleton-card">
            <Skeleton active paragraph={{ rows }} />
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default SectionSkeleton;
