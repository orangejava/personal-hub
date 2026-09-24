import { history, useLocation } from '@umijs/max';
import { Modal, Typography } from 'antd';
import React, { useEffect, useState } from 'react';
import { buildLoginPath } from '@/utils/loginPath';

export interface AiGuestLimitAlertProps {
  isGuest: boolean;
  exceeded?: boolean;
  toolName: string;
  dailyLimit?: number;
  remainingUses?: number;
  requiresLogin?: boolean;
  /** 页面在拦截发送时递增，用来在用户关掉弹窗后再次打开。 */
  promptSignal?: number;
}

/**
 * 访客额度提示。
 * 还有剩余次数时不占输入区；必须登录或次数用完才打开对话框，遮罩可关。
 */
const AiGuestLimitAlert: React.FC<AiGuestLimitAlertProps> = ({
  isGuest,
  exceeded,
  toolName,
  dailyLimit = 3,
  remainingUses = 1,
  requiresLogin,
  promptSignal = 0,
}) => {
  const location = useLocation();
  const blocked = Boolean(requiresLogin || exceeded);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isGuest && blocked) setOpen(true);
  }, [blocked, isGuest]);

  useEffect(() => {
    if (!isGuest || !blocked || promptSignal <= 0) return;
    setOpen(true);
  }, [blocked, isGuest, promptSignal]);

  if (!isGuest || !blocked) return null;

  const loginPath = buildLoginPath(
    `${location.pathname}${location.search}${location.hash}`,
  );

  return (
    <Modal
      open={open}
      title={requiresLogin ? '需要登录' : '访客试用已用完'}
      okText="去登录"
      cancelText="关闭"
      onOk={() => history.push(loginPath)}
      onCancel={() => setOpen(false)}
    >
      <Typography.Paragraph>
        {requiresLogin
          ? `${toolName}需要登录后使用，访客无法直接生成。`
          : `${toolName}今日访客试用次数已达 ${dailyLimit} 次上限，剩余 ${remainingUses} 次。`}
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary">
        登录后可保存历史、使用会员额度，并解除访客试用次数限制。
      </Typography.Paragraph>
    </Modal>
  );
};

export default AiGuestLimitAlert;
