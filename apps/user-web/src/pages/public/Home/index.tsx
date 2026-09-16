import { Link, history, useModel } from '@umijs/max';
import { useRequest } from '@/hooks/useRequest';
import { Button, Card, Col, Row, Typography } from 'antd';
import React from 'react';
import PublicLayout from '@/layouts/PublicLayout';
import { ContentCard, ErrorState, SectionSkeleton } from '@/components/shared';
import { fetchFeatured, fetchContentMeta } from '@/services/content';

const { Title, Paragraph } = Typography;

/** 首页：Hero 文案与排版来自公开系统配置，精选内容仍走内容接口。 */
const Home: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const heroTitle =
    initialState?.systemConfig?.heroTitle?.trim() || '把知识沉淀成可复用的资产';
  const heroSubtitle =
    initialState?.systemConfig?.heroSubtitle?.trim() || '内容阅读 · 内容生产 · AI 工具，一站完成';
  const heroStyle = initialState?.systemConfig?.layout?.homeHeroStyle ?? 'split';
  const { data, loading, error } = useRequest(fetchFeatured);
  const featured = data ?? [];
  const { data: meta } = useRequest(fetchContentMeta);
  const categories = meta?.categories ?? [];

  return (
    <PublicLayout>
      {/* Hero */}
      <Card className={`ph-home-hero ph-home-hero-${heroStyle}`}>
        <Title level={2} style={{ marginTop: 0 }}>
          {heroTitle}
        </Title>
        <Paragraph type="secondary" style={{ fontSize: 16 }}>
          {heroSubtitle}
        </Paragraph>
        <Button type="primary" onClick={() => history.push('/content')}>
          浏览内容
        </Button>
      </Card>

      {/* 分类入口 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {categories.map((c) => (
          <Col span={6} key={c.slug}>
            <Link to={`/content?category=${c.slug}`}>
              <Card hoverable>
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                <div className="ph-category-count">{c.count} 篇</div>
              </Card>
            </Link>
          </Col>
        ))}
      </Row>

      {/* 精选内容 */}
      <Title level={3}>精选内容</Title>
      {error && <ErrorState onRetry={() => window.location.reload()} />}
      {loading ? (
        <SectionSkeleton variant="card" count={3} columns={3} />
      ) : (
        <Row gutter={16}>
          {featured.map((item) => (
            <Col span={8} key={item.id}>
              <ContentCard item={item} />
            </Col>
          ))}
        </Row>
      )}

      {/* AI 入口占位 */}
      <Card style={{ marginTop: 24 }} title="AI 工具（即将上线）">
        <Paragraph type="secondary">阶段 5 上线 AI 对话、文本与图片生成，敬请期待。</Paragraph>
      </Card>
    </PublicLayout>
  );
};

export default Home;
