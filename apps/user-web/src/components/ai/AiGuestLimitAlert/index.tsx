import { Link, useLocation } from '@umijs/max';
import { Alert, Button, Space, Typography } from 'antd';
import React from 'react';
import { buildLoginPath } from '@/utils/loginPath';

export interface AiGuestLimitAlertProps {
  isGuest: boolean;
  exceeded?: boolean;
  toolName: string;
  dailyLimit?: number;
  remainingUses?: number;
}

/**
 * 次数来自公开首页 guestTrial，不再用查询参数模拟。
 */
const AiGuestLimitAlert: React.FC<AiGuestLimitAlertProps> = ({
  isGuest,
  exceeded,
  toolName,
  dailyLimit = 3,
  remainingUses = 1,
}) => {
  const location = useLocation();
  if (!isGuest) return null;

  return (
    <Alert
      showIcon
      className="ph-ai-guest-limit-alert"
      type={exceeded ? 'warning' : 'info'}
      title={exceeded ? '访客试用已用完' : '访客试用模式'}
      description={
        <Space orientation="vertical" size={4}>
          <Typography.Text>
            {exceeded
              ? `${toolName}今日访客试用次数已达 ${dailyLimit} 次上限。`
              : `${toolName}今日访客可试用 ${dailyLimit} 次，剩余 ${remainingUses} 次。`}
          </Typography.Text>
          <Typography.Text type="secondary">
            登录后可保存历史、使用会员额度，并解除访客试用次数限制。
          </Typography.Text>
        </Space>
      }
      action={
        <Link
          to={buildLoginPath(
            `${location.pathname}${location.search}${location.hash}`,
          )}
        >
          <Button size="small" type={exceeded ? 'primary' : 'default'}>
            去登录
          </Button>
        </Link>
      }
    />
  );
};

export default AiGuestLimitAlert;
