import type { AdminAiBrandingConfig } from '@personal-hub/shared-types';
import { Button, Card, Col, Progress, Row, Space } from 'antd';
import React from 'react';

interface AiConfigSummaryCardsProps {
  branding?: AdminAiBrandingConfig;
  enabledProviderCount: number;
  providerCount: number;
  visibleModelCount: number;
  modelCount: number;
  enabledToolCount: number;
  toolCount: number;
  onEditBranding: () => void;
}

/** AI 配置概览只负责展示统计，编辑状态仍由页面容器统一管理。 */
const AiConfigSummaryCards: React.FC<AiConfigSummaryCardsProps> = ({
  branding,
  enabledProviderCount,
  providerCount,
  visibleModelCount,
  modelCount,
  enabledToolCount,
  toolCount,
  onEditBranding,
}) => (
  <>
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={8}>
        <Card
          title="品牌设置"
          extra={
            <Button size="small" type="link" onClick={onEditBranding}>
              编辑
            </Button>
          }
        >
          <Space orientation="vertical" size={4}>
            <strong>{branding?.brandName ?? 'Personal Hub AI'}</strong>
            <span style={{ color: '#667085' }}>Logo 文案：{branding?.logoText ?? 'PH AI'}</span>
          </Space>
        </Card>
      </Col>
      <Col xs={24} lg={8}>
        <Card title="用户可见模型">
          <Progress
            percent={Math.round((visibleModelCount / Math.max(modelCount, 1)) * 100)}
            format={() => `${visibleModelCount}/${modelCount}`}
            strokeColor="#1677ff"
          />
        </Card>
      </Col>
      <Col xs={24} lg={8}>
        <Card title="已启用工具">
          <Progress
            percent={Math.round((enabledToolCount / Math.max(toolCount, 1)) * 100)}
            format={() => `${enabledToolCount}/${toolCount}`}
            strokeColor="#52c41a"
          />
        </Card>
      </Col>
    </Row>
    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
      <Col xs={24} lg={8}>
        <Card title="厂商状态">
          <Progress
            percent={Math.round((enabledProviderCount / Math.max(providerCount, 1)) * 100)}
            format={() => `${enabledProviderCount}/${providerCount}`}
          />
        </Card>
      </Col>
    </Row>
  </>
);

export default AiConfigSummaryCards;
