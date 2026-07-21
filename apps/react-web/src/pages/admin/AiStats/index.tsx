import { ProTable } from '@ant-design/pro-components';
import type {
  AdminAiModelUsageDistribution,
  AdminAiToolUsageShare,
  AdminAiUsageTrendPoint,
  AdminAiUserUsageRank,
} from '@personal-hub/shared-types';
import { useRequest } from '@umijs/max';
import { Card, Col, Progress, Row, Segmented, Statistic, Tag } from 'antd';
import React, { useState } from 'react';
import { ErrorState, PageContainer, SectionSkeleton } from '@/components/shared';
import { fetchAdminAiStats } from '@/services/admin';

/** 后台 AI 统计：阶段 5 用 mock 数据跑通 Token、调用次数和费用看板。 */
const AiStats: React.FC = () => {
  const [range, setRange] = useState('7d');
  const { data, loading, error, run } = useRequest(fetchAdminAiStats);

  if (error) {
    return (
      <PageContainer title="AI 统计">
        <ErrorState title="AI 统计加载失败" onRetry={run} />
      </PageContainer>
    );
  }

  if (loading && !data) {
    return (
      <PageContainer title="AI 统计">
        <SectionSkeleton variant="card" count={4} columns={4} />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="AI 统计"
      extra={
        <Segmented
          value={range}
          onChange={(value) => setRange(String(value))}
          options={[
            { label: '近 7 天', value: '7d' },
            { label: '近 30 天', value: '30d' },
            { label: '本月', value: 'month' },
          ]}
        />
      }
    >
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="消耗 Token" value={data?.summary.totalTokens ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="调用次数" value={data?.summary.totalCalls ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="预估费用"
              value={data?.summary.estimatedCost ?? 0}
              precision={2}
              prefix="¥"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="活跃用户" value={data?.summary.activeUsers ?? 0} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={14}>
          <Card title="近 7 天消耗趋势">
            <ProTable<AdminAiUsageTrendPoint>
              rowKey="date"
              search={false}
              pagination={false}
              dataSource={data?.trends ?? []}
              columns={[
                { title: '日期', dataIndex: 'date' },
                { title: 'Token', dataIndex: 'tokens', renderText: (value) => value.toLocaleString() },
                { title: '调用', dataIndex: 'calls' },
                {
                  title: '费用',
                  dataIndex: 'estimatedCost',
                  renderText: (value) => `¥${value.toFixed(2)}`,
                },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="工具消耗占比">
            <ProTable<AdminAiToolUsageShare>
              rowKey="toolType"
              search={false}
              pagination={false}
              dataSource={data?.toolShares ?? []}
              columns={[
                {
                  title: '工具',
                  dataIndex: 'toolName',
                  render: (_, record) => (
                    <>
                      <Tag>{record.toolType}</Tag>
                      {record.toolName}
                    </>
                  ),
                },
                {
                  title: '占比',
                  dataIndex: 'ratio',
                  render: (_, record) => (
                    <Progress percent={record.ratio} size="small" format={(percent) => `${percent}%`} />
                  ),
                },
                { title: '调用', dataIndex: 'calls' },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={12}>
          <Card title="用户消耗排行 Top 5">
            <ProTable<AdminAiUserUsageRank>
              rowKey="userId"
              search={false}
              pagination={false}
              dataSource={data?.userRanks ?? []}
              columns={[
                { title: '排名', dataIndex: 'rank', width: 72 },
                { title: '用户', dataIndex: 'nickname' },
                { title: 'Token', dataIndex: 'tokens', renderText: (value) => value.toLocaleString() },
                { title: '调用', dataIndex: 'calls' },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="模型消耗分布">
            <ProTable<AdminAiModelUsageDistribution>
              rowKey="modelId"
              search={false}
              pagination={false}
              dataSource={data?.modelDistributions ?? []}
              columns={[
                {
                  title: '模型',
                  dataIndex: 'modelName',
                  render: (_, record) => (
                    <>
                      <Tag color="blue">{record.providerName}</Tag>
                      {record.modelName}
                    </>
                  ),
                },
                { title: 'Token', dataIndex: 'tokens', renderText: (value) => value.toLocaleString() },
                {
                  title: '费用',
                  dataIndex: 'estimatedCost',
                  renderText: (value) => `¥${value.toFixed(2)}`,
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
};

export default AiStats;
