import { ContentType } from '@personal-hub/shared-types';
import { useModel } from '@umijs/max';
import { Tag } from 'antd';
import React from 'react';
import { MotionRoot, Reveal } from '@/components/motion';
import ContentCard from '@/components/shared/ContentCard';
import SectionSkeleton from '@/components/shared/SectionSkeleton';
import { PROJECT_PROGRESS, PROJECT_SHOWCASE } from '@/config/projectShowcase';
import { useDocumentGrows } from '@/hooks/useDocumentGrows';
import { useRequest } from '@/hooks/useRequest';
import PublicLayout from '@/layouts/PublicLayout';
import { fetchContentList } from '@/services/content';
import { fetchPublicConfig } from '@/services/system';
import ArchitectureDiagram from './ArchitectureDiagram';
import ShowcaseCard from './ShowcaseCard';
import './index.less';

/** 项目页改成作品矩阵。文字来自静态配置，图片只读公开资产 URL。 */
const Projects: React.FC = () => {
  useDocumentGrows();
  const { initialState } = useModel('@@initialState');
  const { data: liveConfig } = useRequest(fetchPublicConfig);
  const layout = liveConfig?.layout ?? initialState?.systemConfig?.layout;
  const assets =
    liveConfig?.projectVisualAssets ??
    initialState?.systemConfig?.projectVisualAssets ??
    [];
  const assetByKey = new Map(assets.map((item) => [item.key, item]));
  const title = layout?.projectsTitle?.trim() || '项目';
  const intro = layout?.projectsIntro?.trim();
  // 更多作品先只展示一篇。分页等作品多了再加回来。
  const { data, loading, error } = useRequest(() =>
    fetchContentList({ type: ContentType.Project, page: 1, pageSize: 1 }),
  );
  const featuredWork = data?.list?.[0];
  const showWork = !loading && !error && featuredWork != null;

  return (
    <PublicLayout>
      <MotionRoot>
        <div className="ph-projects">
          <header className="ph-projects-header">
            <h1>{title}</h1>
            {intro ? <p>{intro}</p> : null}
          </header>

          <section className="ph-projects-overview">
            <Reveal>
              <p>personal-hub 把公开前台、管理端和服务端接在同一套接口上。</p>
              <ArchitectureDiagram />
            </Reveal>
          </section>

          <section className="ph-project-grid">
            {PROJECT_SHOWCASE.map((item) => (
              <ShowcaseCard
                key={item.key}
                item={item}
                asset={assetByKey.get(item.key)}
              />
            ))}
          </section>

          <section className="ph-project-progress">
            <h2>项目进度</h2>
            <ol>
              {PROJECT_PROGRESS.map((entry) => (
                <li key={entry.key}>
                  <div className="ph-project-progress-head">
                    <h3>{entry.title}</h3>
                    <Tag
                      color={
                        entry.status === '进行中' ? 'processing' : 'default'
                      }
                    >
                      {entry.status}
                    </Tag>
                    {entry.publishedAt ? (
                      <time dateTime={entry.publishedAt}>
                        {entry.publishedAt}
                      </time>
                    ) : null}
                  </div>
                  <ul>
                    {entry.changes.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </section>

          <section className="ph-projects-more">
            <h2>更多作品</h2>
            {loading ? (
              <SectionSkeleton variant="card" count={1} columns={1} />
            ) : null}
            {showWork && featuredWork ? (
              <div className="ph-projects-more-list">
                <ContentCard item={featuredWork} />
              </div>
            ) : loading ? null : (
              <p className="ph-projects-more-note">
                {error
                  ? '暂时读不到内容。'
                  : '这里以后放内容中心里类型为「项目」的文章。现在还没有，所以先留着这个位置。'}
              </p>
            )}
          </section>
        </div>
      </MotionRoot>
    </PublicLayout>
  );
};

export default Projects;
