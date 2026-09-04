import { ContentType } from '@personal-hub/shared-types';
import { useRequest } from '@/hooks/useRequest';
import { history, Link, useIntl } from '@umijs/max';
import { Button, Card, Col, Row, Tag } from 'antd';
import React from 'react';
import {
  AnimatedList,
  ErrorState,
  PageContainer,
  ResultState,
  SectionSkeleton,
} from '@/components/shared';
import { fetchContentList } from '@/services/content';
import { fetchLocalBooklets } from '@/services/workspace';

/** 小册管理：本地同步小册 + mock 小册，可打开阅读 */
const Booklets: React.FC = () => {
  const intl = useIntl();
  const {
    data: localData,
    loading: localLoading,
    error: localError,
    run: reloadLocal,
  } = useRequest(fetchLocalBooklets);
  const localBooklets = localData?.booklets ?? [];
  const syncedAt = localData?.syncedAt;

  const {
    data: mockData,
    loading: mockLoading,
    error: mockError,
    run: reloadMock,
  } = useRequest(() =>
    fetchContentList({ type: ContentType.Booklet, page: 1, pageSize: 50 }),
  );
  const mockBooklets = mockData?.list ?? [];

  return (
    <PageContainer
      title={intl.formatMessage({ id: 'workspace.booklets.title' })}
      extra={
        <Link to="/workspace/content/new">
          <Button type="primary">
            {intl.formatMessage({ id: 'workspace.content.new' })}
          </Button>
        </Link>
      }
    >
      <Card
        title={intl.formatMessage({ id: 'workspace.booklets.local' })}
        extra={
          syncedAt ? (
            <span style={{ color: 'rgba(0,0,0,0.45)' }}>同步于 {syncedAt}</span>
          ) : null
        }
        style={{ marginBottom: 24 }}
      >
        {localError && <ErrorState onRetry={reloadLocal} />}
        {localLoading ? (
          <SectionSkeleton variant="card" count={2} columns={3} />
        ) : localBooklets.length > 0 ? (
          <Row gutter={16}>
            <AnimatedList
              items={localBooklets}
              getKey={(b) => b.id}
              wrapItem={false}
              renderItem={(b) => (
                <Col xs={24} md={12} lg={8}>
                  <Card
                    hoverable
                    title={b.title}
                    onClick={() => history.push(`/content/${b.id}`)}
                  >
                    <p style={{ color: 'rgba(0,0,0,0.65)', minHeight: 44 }}>
                      {b.summary}
                    </p>
                    <Tag color="green">本地</Tag>
                    <span style={{ marginLeft: 8, color: 'rgba(0,0,0,0.45)' }}>
                      {b.chapterCount} 章
                    </span>
                  </Card>
                </Col>
              )}
            />
          </Row>
        ) : (
          <ResultState
            status="empty"
            description="未同步到本地小册，可执行 pnpm sync:booklets"
          />
        )}
      </Card>

      <Card title={intl.formatMessage({ id: 'workspace.booklets.site' })}>
        {mockError && <ErrorState onRetry={reloadMock} />}
        {mockLoading ? (
          <SectionSkeleton variant="card" count={3} columns={3} />
        ) : mockBooklets.length > 0 ? (
          <Row gutter={16}>
            <AnimatedList
              items={mockBooklets}
              getKey={(b) => b.id}
              wrapItem={false}
              renderItem={(b) => (
                <Col xs={24} md={12} lg={8}>
                  <Card
                    hoverable
                    title={b.title}
                    onClick={() => history.push(`/content/${b.id}`)}
                  >
                    <p style={{ color: 'rgba(0,0,0,0.65)', minHeight: 44 }}>
                      {b.summary}
                    </p>
                    <span style={{ color: 'rgba(0,0,0,0.45)' }}>{b.author}</span>
                  </Card>
                </Col>
              )}
            />
          </Row>
        ) : (
          <ResultState status="empty" description="暂无站点小册" />
        )}
      </Card>
    </PageContainer>
  );
};

export default Booklets;
