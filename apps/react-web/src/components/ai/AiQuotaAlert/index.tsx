import { Link } from '@umijs/max';
import { Alert, Button, Space, Typography } from 'antd';
import type { AiQuotaSummary } from '@personal-hub/shared-types';
import React from 'react';

export interface AiQuotaAlertProps {
  quota?: AiQuotaSummary;
  estimatedTokens: number;
  toolName: string;
}

/**
 * AI 工具额度提示。
 *
 * 阶段 5 先基于 mock 余额做前端拦截，后续接真实后端时仍保留这层提示，
 * 服务端再做最终扣费和并发校验，避免只依赖前端状态。
 */
const AiQuotaAlert: React.FC<AiQuotaAlertProps> = ({
  quota,
  estimatedTokens,
  toolName,
}) => {
  if (!quota) return null;

  const insufficient = quota.remainingTokens < estimatedTokens;
  const lowBalance = quota.remainingTokens <= quota.lowBalanceThreshold;

  if (!insufficient && !lowBalance) return null;

  return (
    <Alert
      showIcon
      className="ph-ai-quota-alert"
      type={insufficient ? 'warning' : 'info'}
      title={insufficient ? 'Token 余额不足' : 'Token 余额偏低'}
      description={
        <Space orientation="vertical" size={4}>
          <Typography.Text>
            {toolName}本次预计消耗 {estimatedTokens.toLocaleString()} Token，
            当前剩余 {quota.remainingTokens.toLocaleString()} Token。
          </Typography.Text>
          <Typography.Text type="secondary">
            阶段 5 暂使用 mock 会员和配额数据，真实扣费会在后端接入后统一校验。
          </Typography.Text>
        </Space>
      }
      action={
        <Link to="/ai/membership">
          <Button size="small" type={insufficient ? 'primary' : 'default'}>
            查看会员
          </Button>
        </Link>
      }
    />
  );
};

export default AiQuotaAlert;
