import { CrownOutlined, LogoutOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useModel } from '@umijs/max';
import { Avatar, Button, Popover } from 'antd';
import React from 'react';
import { buildAdminWebUrl } from '@personal-hub/app-origins';
import { buildLoginPath } from '@/utils/loginPath';
import { loginOut } from '@/utils/loginOut';
import './index.less';

export type UserAccountPopoverVariant = 'base' | 'ai';

interface UserAccountPopoverProps {
  variant?: UserAccountPopoverVariant;
  quotaText?: string;
  planName?: string;
  triggerClassName?: string;
  children?: React.ReactNode;
}

type AccountUser = {
  email: string;
  nickname?: string;
  avatar?: string;
  role?: string;
  permissions?: string[];
};

function isAdminUser(user?: { role?: string; permissions?: string[] }) {
  return user?.role === 'admin' || Boolean(user?.permissions?.includes('admin:access'));
}

function AccountActions({
  variant,
  admin,
  onLogout,
}: {
  variant: UserAccountPopoverVariant;
  admin: boolean;
  onLogout: () => void;
}) {
  const actionClass = variant === 'ai' ? 'ph-ai-user-card-actions' : 'ph-user-account-card-actions';
  return (
    <div className={actionClass}>
      <Link to={variant === 'ai' ? '/ai/profile' : '/workspace/profile'}>
        <UserOutlined />
        {variant === 'ai' ? 'AI 个人中心' : '个人设置'}
      </Link>
      <Link to="/workspace">
        <SettingOutlined />
        工作区
      </Link>
      {variant === 'base' && (
        <Link to="/workspace/usage">
          <SettingOutlined />
          我的 AI 用量
        </Link>
      )}
      {admin && (
        <a href={buildAdminWebUrl()}>
          <CrownOutlined />
          后台管理
        </a>
      )}
      <button type="button" onClick={onLogout}>
        <LogoutOutlined />
        退出登录
      </button>
    </div>
  );
}

/** AI 弹窗沿用原权益/额度分区，不复制尚未落地的存储、训练余额。 */
function AiAccountCard({
  user,
  displayName,
  admin,
  planName,
  quotaText,
  onLogout,
}: {
  user: AccountUser;
  displayName: string;
  admin: boolean;
  planName?: string;
  quotaText?: string;
  onLogout: () => void;
}) {
  return (
    <div className="ph-ai-user-card">
      <div className="ph-ai-user-card-header">
        <Avatar size={52} src={user.avatar} icon={<UserOutlined />} />
        <div>
          <strong>{displayName}</strong>
          <span>{user.email}</span>
        </div>
      </div>
      <div className="ph-ai-user-card-plan">
        <div className="ph-ai-user-card-plan-head">
          <strong>{planName ?? '当前套餐'}</strong>
          <Link to="/ai/membership">
            <Button type="primary">查看权益</Button>
          </Link>
        </div>
      </div>
      <div className="ph-ai-user-card-quota">
        <div>
          <strong>{quotaText ?? '加载中'}</strong>
          <span>剩余 Token</span>
        </div>
        <Link to="/workspace/usage">我的用量</Link>
      </div>
      <AccountActions variant="ai" admin={admin} onLogout={onLogout} />
    </div>
  );
}

/**
 * 公开前台、工作区和 AI 共用的基础用户菜单。
 * AI 变体额外展示额度摘要，不复制尚未落地的存储/训练余额。
 */
const UserAccountPopover: React.FC<UserAccountPopoverProps> = ({
  variant = 'base',
  quotaText,
  planName,
  triggerClassName,
  children,
}) => {
  const { initialState, setInitialState } = useModel('@@initialState');
  const user = initialState?.currentUser;

  const handleLogout = () => {
    void loginOut(setInitialState);
  };

  if (!user) {
    return (
      <Link to={buildLoginPath()}>
        <Button type="primary">登录</Button>
      </Link>
    );
  }

  const displayName = user.nickname ?? user.email;
  const admin = isAdminUser(user);
  const card =
    variant === 'ai' ? (
      <AiAccountCard
        user={user}
        displayName={displayName}
        admin={admin}
        planName={planName}
        quotaText={quotaText}
        onLogout={handleLogout}
      />
    ) : (
      <div className="ph-user-account-card">
        <div className="ph-user-account-card-header">
          <Avatar size={52} src={user.avatar} icon={<UserOutlined />} />
          <div>
            <strong>{displayName}</strong>
            <span>{user.email}</span>
          </div>
        </div>
        <AccountActions variant="base" admin={admin} onLogout={handleLogout} />
      </div>
    );

  return (
    <Popover
      arrow={false}
      content={card}
      classNames={{
        root: variant === 'ai' ? 'ph-ai-user-popover' : 'ph-user-account-popover',
      }}
      placement="bottomRight"
      trigger={['hover', 'click']}
    >
      {children ?? (
        <Button className={triggerClassName ?? 'ph-user-account-trigger'} type="text">
          <Avatar size={28} src={user.avatar} icon={<UserOutlined />} />
          <span>{displayName}</span>
        </Button>
      )}
    </Popover>
  );
};

export default UserAccountPopover;
