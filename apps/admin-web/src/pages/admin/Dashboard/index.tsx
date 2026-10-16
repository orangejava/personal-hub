import { Card, Col, Row, Statistic } from 'antd';
import { useRequest } from '@/hooks/useRequest';
import React from 'react';
import { ErrorState, PageContainer, SectionSkeleton } from '@/components/shared';
import { fetchAdminDashboardStats } from '@/services/admin';

/** 运营概览：展示真实内容、用户与阅读统计。 */
const Dashboard: React.FC = () => {
  const { data, loading, error, run } = useRequest(fetchAdminDashboardStats);
  const stats = data;

  return (
    <PageContainer title="运营概览">
      {error && <ErrorState onRetry={run} />}
      {loading ? (
        <SectionSkeleton variant="card" count={4} columns={4} rows={2} />
      ) : !error ? (
        <Row gutter={[16, 16]}>
          {[
            { title: '内容总数', value: stats?.contentTotal ?? 0 },
            { title: '注册用户', value: stats?.userTotal ?? 0 },
            { title: '今日内容读者', value: stats?.contentReadersToday ?? 0 },
            { title: '本周发布', value: stats?.publishedThisWeek ?? 0 },
          ].map((item) => (
            <Col xs={24} sm={12} lg={6} key={item.title}>
              <Card>
                <Statistic title={item.title} value={item.value} />
              </Card>
            </Col>
          ))}
        </Row>
      ) : null}
    </PageContainer>
  );
};

export default Dashboard;
