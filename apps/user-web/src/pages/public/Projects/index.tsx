import { Col, Pagination, Row, Typography } from 'antd';
import { useRequest } from '@/hooks/useRequest';
import { useModel } from '@umijs/max';
import React, { useState } from 'react';
import PublicLayout from '@/layouts/PublicLayout';
import {
  AnimatedList,
  ContentCard,
  ErrorState,
  ResultState,
  SectionSkeleton,
} from '@/components/shared';
import { DEFAULT_TABLE_PAGE_SIZE, DEFAULT_TABLE_PAGINATION } from '@/constants/tablePagination';
import { fetchContentList } from '@/services/content';
import { fetchPublicConfig } from '@/services/system';
import { ContentType } from '@personal-hub/shared-types';

const { Title, Paragraph } = Typography;

/** 项目页：标题/简介来自系统配置，列表仍按内容类型 Project 拉取。 */
const Projects: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const { data: liveConfig } = useRequest(fetchPublicConfig);
  const layout = liveConfig?.layout ?? initialState?.systemConfig?.layout;
  const title = layout?.projectsTitle?.trim() || '项目';
  const intro = layout?.projectsIntro?.trim();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const { data, loading, error, run } = useRequest(
    () => fetchContentList({ type: ContentType.Project, page, pageSize }),
    { refreshDeps: [page, pageSize] },
  );
  const list = data?.list ?? [];
  const total = data?.total ?? 0;

  const handlePageChange = (nextPage: number, nextSize: number) => {
    setPage(nextPage);
    setPageSize(nextSize);
  };

  return (
    <PublicLayout>
      <Title level={2} style={{ marginTop: 0 }}>
        {title}
      </Title>
      {intro ? (
        <Paragraph type="secondary" style={{ marginBottom: 24 }}>
          {intro}
        </Paragraph>
      ) : null}
      {error && <ErrorState onRetry={run} />}
      {loading ? (
        <SectionSkeleton variant="card" count={3} columns={3} />
      ) : list.length > 0 ? (
        <>
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
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Pagination
              {...DEFAULT_TABLE_PAGINATION}
              current={page}
              pageSize={pageSize}
              total={total}
              onChange={handlePageChange}
            />
          </div>
        </>
      ) : (
        <ResultState status="empty" description="暂无项目，将在后续补充" />
      )}
    </PublicLayout>
  );
};

export default Projects;
