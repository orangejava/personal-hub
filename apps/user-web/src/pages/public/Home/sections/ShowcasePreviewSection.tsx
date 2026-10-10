import type { PublicProjectVisualAsset } from '@personal-hub/shared-types';
import { Link } from '@umijs/max';
import React from 'react';
import ShowcaseImage from '@/components/showcase/ShowcaseImage';
import {
  PROJECT_SHOWCASE,
  showcasePlaceholder,
} from '@/config/projectShowcase';

interface ShowcasePreviewSectionProps {
  assets?: PublicProjectVisualAsset[];
}

/** 一行一个作品。悬停封面只在桌面样式里打开，点击统一去项目页。 */
const ShowcasePreviewSection: React.FC<ShowcasePreviewSectionProps> = ({
  assets,
}) => {
  const coverByKey = new Map(
    (assets ?? []).map((item) => [item.key, item.coverUrl]),
  );

  return (
    <div className="ph-home-section">
      <h2>作品</h2>
      <div className="ph-home-showcase-list">
        {PROJECT_SHOWCASE.map((item) => (
          <Link key={item.key} to="/projects" className="ph-home-showcase-row">
            <span className="ph-home-showcase-name">{item.name}</span>
            <span className="ph-home-showcase-meta">
              {item.status}
              <i />
              {item.year}
            </span>
            <ShowcaseImage
              className="ph-home-showcase-cover"
              src={coverByKey.get(item.key)}
              fallback={showcasePlaceholder(item.key)}
              alt=""
            />
          </Link>
        ))}
      </div>
    </div>
  );
};

export default ShowcasePreviewSection;
