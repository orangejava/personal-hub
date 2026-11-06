import {
  ArrowRightOutlined,
  HistoryOutlined,
  SettingOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { history } from '@umijs/max';
import { Button, Card, Col, Empty, Row, Space, Statistic, Tag, Typography } from 'antd';
import React from 'react';
import { aiCheckinStatusText, getAiCheckinStatus, shanghaiCheckinMonth } from '@/components/ai/checkinStatus';
import PageContainer from '@/components/shared/PageContainer';
import { fetchAiHome, fetchAiCheckin } from '@/services/ai';
import { useRequest } from '@/hooks/useRequest';
import type { AiModel, AiRecentActivity } from '@personal-hub/shared-types';

function getRecentModels(activities: AiRecentActivity[], models: AiModel[]) {
  const modelsById = new Map(models.map((model) => [model.id, model]));
  const seen = new Set<string>();
  return activities
    .flatMap((activity) => {
      const modelId = activity.modelId;
      if (!modelId || seen.has(modelId)) return [];
      seen.add(modelId);
      const model = modelsById.get(modelId);
      return model ? [model] : [];
    })
    .slice(0, 4);
}

/** AI 管理首页：聚合真实额度、奖励状态、最近模型和常用入口。 */
const AiManagement: React.FC = () => {
  const { data: home, loading } = useRequest(fetchAiHome);
  const { data: checkin, error: checkinError } = useRequest(() => fetchAiCheckin(shanghaiCheckinMonth()));
  const recentModels = getRecentModels(home?.recentActivities ?? [], home?.models ?? []);
  const checkinStatus = getAiCheckinStatus(checkin, checkinError);

  return (
    <PageContainer title="AI 管理">
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="可用额度" value={home?.quota.remainingTokens ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="已使用额度" value={home?.quota.usedTokens ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="连续签到" value={checkin?.streak ?? 0} suffix="天" />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="今日奖励" value={aiCheckinStatusText[checkinStatus]} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="最近使用模型" loading={loading}>
            {recentModels.length ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                {recentModels.map((model) => (
                  <Space key={model.id} style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Space>
                      <Typography.Text strong>{model.name}</Typography.Text>
                      <Tag>{model.provider}</Tag>
                    </Space>
                    <Typography.Text type="secondary">
                      {model.source === 'USER' ? '自建' : '系统'}
                    </Typography.Text>
                  </Space>
                ))}
              </Space>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无模型数据" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="快捷入口">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button block icon={<ArrowRightOutlined />} onClick={() => history.push('/ai/chat')}>
                开始 AI 对话
              </Button>
              <Button
                block
                icon={<HistoryOutlined />}
                onClick={() => history.push('/workspace/ai/history')}
              >
                查看 AI 历史
              </Button>
              <Button
                block
                icon={<SettingOutlined />}
                onClick={() => history.push('/workspace/ai/providers')}
              >
                配置自备厂商与模型
              </Button>
              <Button
                block
                icon={<WalletOutlined />}
                onClick={() => history.push('/workspace/ai/quota')}
              >
                查看额度与签到
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
};

export default AiManagement;
