import { ProTable } from '@ant-design/pro-components';
import { Line, Pie } from '@ant-design/plots';
import { useRequest } from '@/hooks/useRequest';
import type {
  AdminAiModelUsageDistribution,
  AdminAiToolUsageShare,
  AdminAiUsageTrendPoint,
  AdminAiUserUsageRank,
} from '@personal-hub/shared-types';

import { Card, Col, Empty, Progress, Row, Segmented, Space, Statistic, Tag } from 'antd';
import React, { useState, useSyncExternalStore } from 'react';
import { ErrorState, PageContainer, SectionSkeleton } from '@/components/shared';
import { fetchAdminAiStats } from '@/services/admin';
import { getWorkspaceThemeSettings, subscribeThemeRuntime } from '@/utils/themeRuntime';

function modelChartData(data: AdminAiModelUsageDistribution[] | undefined) {
  return (data ?? []).map((row) => ({
    name: `${row.providerName} · ${row.modelName}`,
    value: row.calls,
  }));
}

function toolChartData(data: AdminAiToolUsageShare[] | undefined) {
  return (data ?? []).map((row) => ({ name: row.toolName, value: row.calls }));
}

const jobStatusDisplay: Record<string, { label: string; color: string }> = {
  queued: { label: '排队中', color: 'default' },
  processing: { label: '生成中', color: 'processing' },
  succeeded: { label: '成功', color: 'success' },
  failed: { label: '失败', color: 'error' },
  canceled: { label: '已取消', color: 'warning' },
};

function chartTheme(isDark: boolean) {
  const foreground = isDark ? '#c9d1d9' : '#334155';
  return {
    type: isDark ? ('dark' as const) : ('classic' as const),
    components: {
      axis: { label: { style: { fill: foreground } }, title: { style: { fill: foreground } } },
      legend: { itemLabel: { style: { fill: foreground } } },
    },
  };
}

function chartAxis(isDark: boolean) {
  return {
    label: { style: { fill: isDark ? '#c9d1d9' : '#334155', fontSize: 12 } },
    line: { style: { stroke: isDark ? '#475569' : '#cbd5e1' } },
    tickLine: { style: { stroke: isDark ? '#475569' : '#cbd5e1' } },
  };
}

function ChartEmpty({ description }: { description: string }) {
  return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description} />;
}

/** 后台 AI 运营看板：所有指标来自真实用量记录或生成任务。 */
const AiStats: React.FC = () => {
  const isDark =
    useSyncExternalStore(subscribeThemeRuntime, getWorkspaceThemeSettings).navTheme === 'realDark';
  const chartTextColor = isDark ? '#c9d1d9' : '#334155';
  const [range, setRange] = useState<'24h' | '7d' | '30d'>('7d');
  const { data, loading, error, run } = useRequest(() => fetchAdminAiStats(range), {
    refreshDeps: [range],
  });

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
          onChange={(value) => setRange(value as typeof range)}
          options={[
            { label: '近 24 小时', value: '24h' },
            { label: '近 7 天', value: '7d' },
            { label: '近 30 天', value: '30d' },
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
            <Statistic title="可计算价格估算" value={data?.summary.estimatedCost ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="平台实扣" value={data?.summary.platformCharged ?? 0} />
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {[
          ['未知估算调用', data?.summary.unknownEstimates ?? 0, '次'],
          ['图片任务', data?.summary.imageTasks ?? 0, '次'],
          ['视频任务', data?.summary.videoTasks ?? 0, '次'],
          ['活跃用户', data?.summary.activeUsers ?? 0, '人'],
          ['生成任务', data?.summary.generationTasks ?? 0, '次'],
          ['失败生成任务', data?.summary.failedCalls ?? 0, '次'],
          [
            '生成任务成功率',
            data?.summary.generationTasks ? (data.summary.successRate ?? 0) : '-',
            '%',
          ],
          ['平均耗时', data?.summary.averageDurationMs ?? 0, 'ms'],
        ].map(([title, value, suffix]) => (
          <Col xs={12} sm={8} lg={6} key={title as string}>
            <Card size="small">
              <Statistic
                title={title as string}
                value={value as number | string}
                suffix={suffix as string}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={14}>
          <Card title="调用与 Token 趋势">
            {data?.trends?.length ? (
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <div style={{ color: chartTextColor, marginBottom: 8 }}>Token</div>
                  <Line
                    data={data.trends}
                    xField="date"
                    yField="tokens"
                    theme={chartTheme(isDark)}
                    xAxis={chartAxis(isDark)}
                    yAxis={chartAxis(isDark)}
                    height={240}
                    smooth
                    point={{ size: 3 }}
                    tooltip={{ items: [{ channel: 'y', name: 'Token' }] }}
                  />
                </Col>
                <Col xs={24} md={12}>
                  <div style={{ color: chartTextColor, marginBottom: 8 }}>调用次数</div>
                  <Line
                    data={data.trends}
                    xField="date"
                    yField="calls"
                    theme={chartTheme(isDark)}
                    xAxis={chartAxis(isDark)}
                    yAxis={chartAxis(isDark)}
                    height={240}
                    smooth
                    point={{ size: 3 }}
                    tooltip={{ items: [{ channel: 'y', name: '调用次数' }] }}
                  />
                </Col>
              </Row>
            ) : (
              <ChartEmpty description="当前时间范围暂无调用数据" />
            )}
          </Card>
        </Col>
        <Col xs={24} xl={5}>
          <Card title="模型调用分布">
            {data?.modelDistributions?.length ? (
              <Pie
                data={modelChartData(data.modelDistributions)}
                angleField="value"
                colorField="name"
                height={280}
                innerRadius={0.62}
                theme={chartTheme(isDark)}
                label={{ text: 'name', style: { fill: chartTextColor, fontSize: 11 } }}
                legend={{
                  color: { position: 'bottom', itemLabel: { style: { fill: chartTextColor } } },
                }}
                tooltip={{ items: [{ channel: 'y', name: '调用次数' }] }}
              />
            ) : (
              <ChartEmpty description="暂无模型调用" />
            )}
          </Card>
        </Col>
        <Col xs={24} xl={5}>
          <Card title="工具调用分布">
            {data?.toolShares?.length ? (
              <Pie
                data={toolChartData(data.toolShares)}
                angleField="value"
                colorField="name"
                height={280}
                innerRadius={0.62}
                theme={chartTheme(isDark)}
                label={{ text: 'name', style: { fill: chartTextColor, fontSize: 11 } }}
                legend={{
                  color: { position: 'bottom', itemLabel: { style: { fill: chartTextColor } } },
                }}
                tooltip={{ items: [{ channel: 'y', name: '调用次数' }] }}
              />
            ) : (
              <ChartEmpty description="暂无工具调用" />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={14}>
          <Card title="消耗趋势">
            <ProTable<AdminAiUsageTrendPoint>
              rowKey="date"
              search={false}
              pagination={false}
              dataSource={data?.trends ?? []}
              columns={[
                { title: '日期', dataIndex: 'date' },
                {
                  title: 'Token',
                  dataIndex: 'tokens',
                  renderText: (value) => value.toLocaleString(),
                },
                { title: '调用次数', dataIndex: 'calls' },
                {
                  title: '平均耗时',
                  dataIndex: 'averageDurationMs',
                  renderText: (value) => (value ? `${value} ms` : '-'),
                },
                {
                  title: '价格估算',
                  dataIndex: 'estimatedCost',
                  renderText: (value) => value ?? 0,
                },
                {
                  title: '平台实扣',
                  dataIndex: 'platformCharged',
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
                    <Progress
                      percent={record.ratio}
                      size="small"
                      format={(percent) => `${percent}%`}
                    />
                  ),
                },
                { title: '调用', dataIndex: 'calls' },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Card title="图片 / 视频生成任务状态" style={{ marginTop: 16 }}>
        <Space wrap>
          {(data?.statusShares ?? []).map((item) => (
            <Tag key={item.status} color={jobStatusDisplay[item.status]?.color ?? 'default'}>
              {jobStatusDisplay[item.status]?.label ?? item.status}：{item.calls} 次（{item.ratio}%）
            </Tag>
          ))}
        </Space>
      </Card>

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
                {
                  title: 'Token',
                  dataIndex: 'tokens',
                  renderText: (value) => value.toLocaleString(),
                },
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
                {
                  title: 'Token',
                  dataIndex: 'tokens',
                  renderText: (value) => value.toLocaleString(),
                },
                {
                  title: '价格估算',
                  dataIndex: 'estimatedCost',
                  render: (_, record) =>
                    record.unknownEstimates
                      ? `${record.estimatedCost}（${record.unknownEstimates} 次未知）`
                      : record.estimatedCost,
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
