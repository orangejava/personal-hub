import { HistoryOutlined, SettingOutlined } from '@ant-design/icons';
import { history } from '@umijs/max';
import { Button, Card, Col, List, Progress, Row, Space, Statistic, Tag, Typography } from 'antd';
import React from 'react';
import { aiCheckinStatusText, getAiCheckinStatus, shanghaiCheckinMonth } from '@/components/ai/checkinStatus';
import PageContainer from '@/components/shared/PageContainer';
import CheckinCalendar from '../Dashboard/CheckinCalendar';
import { useRequest } from '@/hooks/useRequest';
import { fetchAiCheckin, fetchAiQuota } from '@/services/ai';
import { fetchUsage } from '@/services/workspace';

/** AI 额度与奖励详情：把首页摘要展开为可操作的账本和签到入口。 */
const AiQuota: React.FC = () => {
  const { data: quota, loading, refresh: refreshQuota } = useRequest(fetchAiQuota);
  const { data: checkin, error: checkinError, refresh: refreshCheckin } = useRequest(() =>
    fetchAiCheckin(shanghaiCheckinMonth()),
  );
  const { data: usage, refresh: refreshUsage } = useRequest(fetchUsage);
  const used = quota?.usedTokens ?? 0;
  const total = quota?.totalTokens ?? 0;
  const percent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const checkinStatus = getAiCheckinStatus(checkin, checkinError);

  return (
    <PageContainer
      title="AI 额度与奖励"
      extra={
        <Space wrap>
          <Button icon={<HistoryOutlined />} onClick={() => history.push('/workspace/ai/history')}>
            AI 历史
          </Button>
          <Button
            icon={<SettingOutlined />}
            onClick={() => history.push('/workspace/ai/providers')}
          >
            自备厂商与模型
          </Button>
        </Space>
      }
    >
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="可用额度" value={quota?.remainingTokens ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="已使用" value={used} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="总额度" value={total} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="今日奖励" value={aiCheckinStatusText[checkinStatus]} />
          </Card>
        </Col>
      </Row>
      <Card title="额度使用情况" style={{ marginTop: 16 }}>
        <Progress percent={percent} status={percent >= 80 ? 'exception' : 'active'} />
        <Typography.Text type="secondary">
          平台模型消耗会从额度账本扣除；自建模型不扣平台额度。
        </Typography.Text>
      </Card>
      <Card title="近期用量" style={{ marginTop: 16 }}>
        <List
          size="small"
          dataSource={(usage?.recent ?? []).slice(0, 6)}
          locale={{ emptyText: '暂无用量记录' }}
          renderItem={(item) => (
            <List.Item>
              <Typography.Text>{item.reason || 'AI 调用'}</Typography.Text>
              <Space>
                <Typography.Text type="secondary">{item.date}</Typography.Text>
                <Typography.Text strong>{item.tokens.toLocaleString()} Token</Typography.Text>
                {item.platformCost !== undefined && (
                  <Typography.Text type="secondary">
                    平台扣额 {item.platformCost.toLocaleString()}
                  </Typography.Text>
                )}
              </Space>
            </List.Item>
          )}
        />
      </Card>
      <Card title="奖励状态" style={{ marginTop: 16 }}>
        <Space wrap>
          <Tag color={checkinStatus === 'claimed' ? 'green' : checkinStatus === 'unclaimed' ? 'gold' : 'default'}>
            今日签到：{aiCheckinStatusText[checkinStatus]}
          </Tag>
          <Tag color="blue">连续签到：{checkin?.streak ?? 0} 天</Tag>
          <Typography.Text type="secondary">
            每日登录 / refresh 活跃奖励由服务端按上海自然日自动发放。
          </Typography.Text>
        </Space>
      </Card>
      <CheckinCalendar
        onClaimed={async () => {
          await Promise.all([refreshQuota(), refreshCheckin(), refreshUsage()]);
        }}
      />
    </PageContainer>
  );
};

export default AiQuota;
