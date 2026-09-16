import { useIntl } from '@umijs/max';
import { useRequest } from '@/hooks/useRequest';
import { Card, Col, Progress, Row, Statistic } from 'antd';
import React from 'react';
import { ErrorState, PageContainer, SectionSkeleton } from '@/components/shared';
import { fetchUsage } from '@/services/workspace';

/** 我的用量：Token 用量统计 */
const Usage: React.FC = () => {
  const intl = useIntl();
  const { data, loading, error, run } = useRequest(fetchUsage);
  if (error)
    return (
      <PageContainer>
        <ErrorState
          title={intl.formatMessage({ id: 'workspace.common.error' })}
          onRetry={run}
        />
      </PageContainer>
    );
  const used = data?.usedTokens ?? 0;
  const total = data?.totalTokens ?? 1;
  const percent = Math.round((used / total) * 100);

  return (
    <PageContainer title={intl.formatMessage({ id: 'workspace.usage.title' })}>
      {loading ? (
        <SectionSkeleton variant="stats" count={3} columns={3} />
      ) : (
        <Row gutter={16}>
          <Col span={8}>
            <Card>
              <Statistic
                title={intl.formatMessage({ id: 'workspace.usage.used' })}
                value={used}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title={intl.formatMessage({ id: 'workspace.usage.remaining' })}
                value={data?.remainingTokens ?? 0}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title={intl.formatMessage({ id: 'workspace.usage.total' })}
                value={total}
              />
            </Card>
          </Col>
        </Row>
      )}
      <Card
        title={intl.formatMessage({ id: 'workspace.usage.progress' })}
        style={{ marginTop: 24 }}
      >
        <Progress
          percent={percent}
          status={percent > 80 ? 'exception' : 'normal'}
        />
        <div style={{ color: 'rgba(0,0,0,0.45)', marginTop: 8 }}>
          AI 用量来自 Nest 额度账本，刷新本页即可看到最近结算结果。
        </div>
      </Card>
    </PageContainer>
  );
};

export default Usage;
