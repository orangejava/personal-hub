import type { PublicProjectVisualAsset } from '@personal-hub/shared-types';
import { Link } from '@umijs/max';
import { Image, Tag } from 'antd';
import React, { useState } from 'react';
import { renderImagePreviewActions } from '@/components/shared/imagePreviewActions';
import {
  type ProjectShowcaseItem,
  showcasePlaceholder,
} from '@/config/projectShowcase';

interface ShowcaseCardProps {
  item: ProjectShowcaseItem;
  asset?: PublicProjectVisualAsset;
}

/** 封面点击打开截图。没有上传时预览占位图，加载失败同样回落。 */
const ShowcaseCard: React.FC<ShowcaseCardProps> = ({ item, asset }) => {
  const placeholder = showcasePlaceholder(item.key);
  const [coverFailed, setCoverFailed] = useState(false);
  const cover = !asset?.coverUrl || coverFailed ? placeholder : asset.coverUrl;
  const shots = (asset?.screenshotUrls ?? []).filter((url) => url.length > 0);
  const previewItems = shots.length > 0 ? shots : [cover];

  return (
    <article className="ph-project-card">
      <Image.PreviewGroup
        items={previewItems}
        preview={{ actionsRender: renderImagePreviewActions }}
      >
        <Image
          className="ph-project-cover"
          src={cover}
          alt={`${item.name}封面`}
          preview={{ cover: '查看截图' }}
          onError={() => setCoverFailed(true)}
        />
      </Image.PreviewGroup>
      <div className="ph-project-card-body">
        <div className="ph-project-card-title">
          <h3>{item.name}</h3>
          <Tag color={item.status === '已上线' ? 'success' : 'default'}>
            {item.status}
          </Tag>
        </div>
        <p>{item.summary}</p>
        <ul className="ph-project-stack">
          {item.stack.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
        <ul className="ph-project-highlights">
          {item.highlights.slice(0, 3).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {item.href || item.performanceHref ? (
          <div className="ph-project-links">
            {item.href ? <Link to={item.href}>打开</Link> : null}
            {item.performanceHref ? (
              <Link to={item.performanceHref}>查看性能</Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
};

export default ShowcaseCard;
