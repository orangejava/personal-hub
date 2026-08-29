import { Link, useIntl, useRequest } from '@umijs/max';
import { Card, Col, Row, Statistic } from 'antd';
import React from 'react';
import {
  AnimatedList,
  ErrorState,
  PageContainer,
  ResultState,
  SectionSkeleton,
} from '@/components/shared';
import {
  fetchContinueReading,
  fetchWorkspaceStats,
} from '@/services/workspace';

/** 工作台：统计卡片 + 继续阅读 */
const Dashboard: React.FC = () => {
  const intl = useIntl();
  const { data: stats, error, loading } = useRequest(fetchWorkspaceStats);
  const { data: continueList, loading: cLoading } =
    useRequest(fetchContinueReading);

  if (error)
    return (
      <PageContainer>
        <ErrorState
          title={intl.formatMessage({ id: 'workspace.common.error' })}
        />
      </PageContainer>
    );

  const statCards = [
    { titleId: 'workspace.dashboard.myDocs', value: stats?.contentCount, key: 'c' },
    { titleId: 'workspace.dashboard.drafts', value: stats?.draftCount, key: 'd' },
    { titleId: 'workspace.dashboard.published', value: stats?.publishedCount, key: 'p' },
    { titleId: 'workspace.dashboard.favorites', value: stats?.favoriteCount, key: 'f' },
    { titleId: 'workspace.dashboard.booklets', value: stats?.bookletCount, key: 'b' },
  ];

  return (
    <PageContainer title={intl.formatMessage({ id: 'workspace.dashboard.title' })}>
      {loading ? (
        <SectionSkeleton variant="card" count={5} columns={5} rows={2} />
      ) : (
        <Row gutter={16}>
          {statCards.map((s) => (
            <Col span={4} key={s.key}>
              <Card>
                <Statistic
                  title={intl.formatMessage({ id: s.titleId })}
                  value={s.value ?? 0}
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Card
        title={intl.formatMessage({ id: 'workspace.dashboard.continueReading' })}
        style={{ marginTop: 24 }}
        loading={cLoading}
      >
        {(continueList?.length ?? 0) > 0 ? (
          <AnimatedList
            className="ph-inline-list"
            items={continueList ?? []}
            getKey={(item) => item.contentId}
            renderItem={(item) => (
              <div className="ph-inline-list-item">
                <div>
                  <div className="ph-inline-list-title">{item.title}</div>
                  <div className="ph-inline-list-description">
                    {intl.formatMessage(
                      { id: 'workspace.dashboard.progress' },
                      { percent: item.percent, date: item.updatedAt },
                    )}
                  </div>
                </div>
                <Link to={`/content/${item.contentId}`}>
                  {intl.formatMessage({ id: 'workspace.dashboard.continue' })}
                </Link>
              </div>
            )}
          />
        ) : (
          <ResultState
            status="empty"
            description={intl.formatMessage({
              id: 'workspace.dashboard.emptyReading',
            })}
          />
        )}
      </Card>
    </PageContainer>
  );
};

export default Dashboard;
