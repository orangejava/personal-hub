import { Link } from '@umijs/max';
import { Alert, Button, Space, Typography } from 'antd';
import type { AiQuotaSummary } from '@personal-hub/shared-types';
import React from 'react';

export interface AiQuotaAlertProps {
  quota?: AiQuotaSummary;
  estimatedTokens: number;
  toolName: string;
  /** 访客额度是 0，不和试用次数叠在一起提示。 */
  visible?: boolean;
}

/**
 * AI 工具额度提示。
 *
 * 基于后端额度摘要做前端提示，最终扣费仍由服务端校验。
 */
const AiQuotaAlert: React.FC<AiQuotaAlertProps> = ({
  quota,
  estimatedTokens,
  toolName,
  visible = true,
}) => {
  if (!visible || !quota) return null;

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
            额度由服务端预占和结算，这里只做余额提示。
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
