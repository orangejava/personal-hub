import { useRequest } from '@/hooks/useRequest';
import {
  CheckCircleOutlined,
  GiftOutlined,
  LineChartOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useModel } from '@umijs/max';
import { Alert, Button, Card, Col, Progress, Row, Skeleton, Space, Statistic, Tag } from 'antd';
import React from 'react';
import { AiPageHeader } from '@/components/ai';
import AiLayout from '@/layouts/AiLayout';
import { fetchAiMembership } from '@/services/ai';

const AiMembershipPage: React.FC = () => {
  const { runtimeConfig, setMembership, updateRuntimeConfig } = useModel('ai');
  const { data, loading, error } = useRequest(fetchAiMembership, {
    onSuccess: (membership) => {
      setMembership(membership);
      updateRuntimeConfig({
        quota: membership.quota,
        currentPlanName: membership.currentPlanName,
      });
    },
  });

  const quota = data?.quota ?? runtimeConfig.quota;
  const usagePercent = quota
    ? Math.round((quota.usedTokens / quota.totalTokens) * 100)
    : 0;
  const usageOverview = data?.usageOverview;
  const maxTrendTokens = Math.max(
    ...(usageOverview?.trend.map((item) => item.tokens) ?? [1]),
    1,
  );
  const toolUsageTotal = Math.max(
    usageOverview?.toolUsage.reduce((total, item) => total + item.tokens, 0) ?? 0,
    1,
  );
  const balanceAlertType =
    usageOverview?.balanceStatus === 'insufficient'
      ? 'error'
      : usageOverview?.balanceStatus === 'low'
        ? 'warning'
        : 'success';

  return (
    <AiLayout
      brandName={runtimeConfig.brandName}
      quotaText={
        quota ? `${quota.remainingTokens.toLocaleString()} Token` : undefined
      }
    >
      <AiPageHeader
        description="展示当前角色权益和额度摘要。套餐购买、充值和邀请奖励后置，本页不提供伪开通。"
        title="会员中心"
      />

      {loading ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : error ? (
        <Alert
          showIcon
          type="warning"
          title="会员中心暂不可用"
          description={error.message || '后台恢复启用后再访问。'}
        />
      ) : (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <div className="ph-ai-membership-summary">
            <Card>
              <Statistic
                title="当前套餐"
                value={data?.currentPlanName ?? runtimeConfig.currentPlanName ?? '免费版'}
              />
            </Card>
            <Card>
              <Statistic
                title="剩余 Token"
                value={quota?.remainingTokens ?? 0}
                suffix="Token"
              />
            </Card>
            <Card>
              <div className="ph-ai-membership-progress">
                <span>本期用量</span>
                <Progress percent={usagePercent} size="small" />
              </div>
            </Card>
          </div>

          {usageOverview && (
            <Card title="用量概览">
              <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                <Alert
                  showIcon
                  type={balanceAlertType}
                  title={usageOverview.balanceStatusText}
                  description={`当前剩余 ${quota?.remainingTokens.toLocaleString() ?? 0} Token，低余额阈值 ${quota?.lowBalanceThreshold.toLocaleString() ?? 0} Token。`}
                />
                <div className="ph-ai-membership-usage-grid">
                  <Card size="small">
                    <Statistic
                      prefix={<LineChartOutlined />}
                      title={`近 ${usageOverview.trendDays} 天消耗`}
                      value={usageOverview.trend.reduce((total, item) => total + item.tokens, 0)}
                      suffix="Token"
                    />
                    <div className="ph-ai-membership-trend">
                      {usageOverview.trend.map((item) => (
                        <span
                          key={item.date}
                          style={{ height: `${Math.max((item.tokens / maxTrendTokens) * 100, 6)}%` }}
                          title={`${item.date} 消耗 ${item.tokens} Token`}
                        />
                      ))}
                    </div>
                  </Card>
                  <Card size="small">
                    <Statistic
                      prefix={<ThunderboltOutlined />}
                      title="访客试用"
                      value={usageOverview.guestTrial.remaining}
                      suffix={`/ ${usageOverview.guestTrial.dailyLimit} 次剩余`}
                    />
                    <Progress
                      percent={Math.round(
                        (usageOverview.guestTrial.used / usageOverview.guestTrial.dailyLimit) * 100,
                      )}
                      size="small"
                      status={usageOverview.guestTrial.exceeded ? 'exception' : 'active'}
                    />
                  </Card>
                </div>
                <div className="ph-ai-membership-tool-usage">
                  {usageOverview.toolUsage.map((item) => (
                    <div className="ph-ai-membership-tool-row" key={item.toolType}>
                      <div>
                        <strong>{item.toolName}</strong>
                        <span>{item.calls} 次调用</span>
                      </div>
                      <Progress
                        percent={Math.round((item.tokens / toolUsageTotal) * 100)}
                        size="small"
                        format={() => `${item.tokens.toLocaleString()} Token`}
                      />
                    </div>
                  ))}
                </div>
              </Space>
            </Card>
          )}

          <Row gutter={[16, 16]}>
            {(data?.plans ?? []).map((plan) => (
              <Col key={plan.id} lg={8} md={12} xs={24}>
                <Card
                  className={
                    plan.highlighted
                      ? 'ph-ai-membership-plan ph-ai-membership-plan-highlighted'
                      : 'ph-ai-membership-plan'
                  }
                  hoverable
                >
                  <Space align="start" orientation="vertical" size={12}>
                    <Space wrap>
                      <Tag color={plan.highlighted ? 'blue' : 'default'}>
                        {plan.priceLabel}
                      </Tag>
                      {plan.badge && <Tag color="green">{plan.badge}</Tag>}
                    </Space>
                    <div>
                      <h3>{plan.name}</h3>
                      <p className="ph-text-secondary">{plan.description}</p>
                    </div>
                    <Statistic
                      title="月度额度"
                      value={plan.monthlyTokens}
                      suffix="Token"
                    />
                    <div className="ph-ai-membership-benefits">
                      {plan.benefits.map((benefit) => (
                        <div className="ph-ai-membership-benefit" key={benefit}>
                          <CheckCircleOutlined style={{ color: '#1677ff', marginRight: 8 }} />
                          {benefit}
                        </div>
                      ))}
                    </div>
                    <Button block disabled type="primary">
                      {plan.id === data?.currentPlanId ? '当前套餐' : '购买后置'}
                    </Button>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>

          {(data?.inviteRecords?.length ?? 0) > 0 ? (
          <Card title="邀请奖励">
            <div className="ph-ai-membership-invite-list">
              {(data?.inviteRecords ?? []).map((record) => (
                <div className="ph-ai-membership-invite" key={record.id}>
                  <GiftOutlined />
                  <div>
                    <strong>{record.title}</strong>
                    <div className="ph-text-secondary">
                      {record.rewardTokens.toLocaleString()} Token ·{' '}
                      {new Date(record.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Tag color={record.status === 'claimed' ? 'green' : 'gold'}>
                    {record.status === 'claimed' ? '已领取' : '待领取'}
                  </Tag>
                </div>
              ))}
            </div>
          </Card>
          ) : null}
        </Space>
      )}
    </AiLayout>
  );
};

export default AiMembershipPage;
