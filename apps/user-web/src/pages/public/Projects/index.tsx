
import { Col, Row } from 'antd';
import { useRequest } from '@/hooks/useRequest';
import React from 'react';
import PublicLayout from '@/layouts/PublicLayout';
import {
  AnimatedList,
  ContentCard,
  ErrorState,
  ResultState,
  SectionSkeleton,
} from '@/components/shared';
import { fetchContentList } from '@/services/content';
import { ContentType } from '@personal-hub/shared-types';

/** 项目页：列出类型为 project 的内容 */
const Projects: React.FC = () => {
  const { data, loading, error, run } = useRequest(() =>
    fetchContentList({ type: ContentType.Project, page: 1, pageSize: 50 }),
  );
  const list = data?.list ?? [];

  return (
    <PublicLayout>
      <h2>项目</h2>
      {error && <ErrorState onRetry={run} />}
      {loading ? (
        <SectionSkeleton variant="card" count={3} columns={3} />
      ) : list.length > 0 ? (
        <Row gutter={16}>
          <AnimatedList
            items={list}
            getKey={(item) => item.id}
            wrapItem={false}
            renderItem={(item) => (
              <Col xs={24} md={12} lg={8}>
                <ContentCard item={item} />
              </Col>
            )}
          />
        </Row>
      ) : (
        <ResultState status="empty" description="暂无项目，将在后续补充" />
      )}
    </PublicLayout>
  );
};

export default Projects;
