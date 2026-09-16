import { Card, Col, Row, Skeleton } from 'antd';
import React from 'react';

type SectionSkeletonVariant =
  | 'card'
  | 'list'
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
}) => {
  const createKeys = (length: number, prefix: string) =>
    Array.from({ length }, (_, index) => `${prefix}-${index + 1}`);

  if (variant === 'table') {
    return (
      <div className="ph-section-skeleton ph-table-skeleton" style={{ minHeight }}>
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
      <div className="ph-section-skeleton" style={{ minHeight }}>
        {createKeys(count, 'list-item').map((key) => (
          <Card key={key} className="ph-skeleton-card">
            <Skeleton active avatar paragraph={{ rows }} />
          </Card>
        ))}
      </div>
    );
  }

  if (variant === 'article') {
    return (
      <Card className="ph-section-skeleton" style={{ minHeight }}>
        <Skeleton active paragraph={{ rows: Math.max(rows, 8) }} />
      </Card>
    );
  }

  if (variant === 'form') {
    return (
      <Card className="ph-section-skeleton ph-form-skeleton" style={{ minHeight }}>
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
      <div className="ph-section-skeleton ph-media-skeleton" style={{ minHeight }}>
        <Skeleton.Node active className="ph-media-skeleton-node" />
        <Skeleton active title={false} paragraph={{ rows: 2 }} />
      </div>
    );
  }

  if (variant === 'stats' || variant === 'dashboard') {
    return (
      <Row gutter={[16, 16]} className="ph-section-skeleton" style={{ minHeight }}>
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
    <Row gutter={[16, 16]} className="ph-section-skeleton" style={{ minHeight }}>
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
