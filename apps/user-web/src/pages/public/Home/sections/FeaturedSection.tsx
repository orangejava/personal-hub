import { Link } from '@umijs/max';
import React from 'react';
import { ContentCard, SectionSkeleton } from '@/components/shared';
import { useRequest } from '@/hooks/useRequest';
import { fetchContentMeta, fetchFeatured } from '@/services/content';
import { FEATURED_SAMPLES } from '../content';

/** 精选来自内容中心。没有数据时用示例卡片；请求失败时单独说明，不说成还没有。 */
const FeaturedSection: React.FC = () => {
  const { data, loading, error } = useRequest(fetchFeatured);
  const { data: meta } = useRequest(fetchContentMeta);
  const featured = data ?? [];
  const categories = meta?.categories ?? [];
  const unavailable = !loading && error != null;
  const showSamples = !loading && !error && featured.length === 0;

  return (
    <div className="ph-home-section">
      <h2>精选内容</h2>
      <p className="ph-home-section-note">
        {unavailable
          ? '暂时读不到内容。'
          : showSamples
            ? '这里接内容中心里标成精选的文章。现在还没有，先放三篇示例。'
            : '从内容中心里挑出来的文章，和上面的分类入口是同一块。'}
      </p>
      {categories.length > 0 ? (
        <div className="ph-home-categories">
          {categories.map((category) => (
            <Link key={category.slug} to={`/content?category=${category.slug}`}>
              {category.name}
              <span>{category.count}</span>
            </Link>
          ))}
        </div>
      ) : null}
      {loading ? (
        <SectionSkeleton variant="card" count={3} columns={3} />
      ) : unavailable ? null : showSamples ? (
        <div className="ph-home-featured-grid">
          {FEATURED_SAMPLES.map((item) => (
            <article key={item.key} className="ph-home-sample-card">
              <img src={item.cover} alt="" />
              <div>
                <span>{item.category}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="ph-home-featured-grid">
          {featured.map((item) => (
            <ContentCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
};

export default FeaturedSection;
