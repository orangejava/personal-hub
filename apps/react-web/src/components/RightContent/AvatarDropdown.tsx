import {
  CrownOutlined,
  LogoutOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { history, Link, useModel } from '@umijs/max';
import type { MenuProps } from 'antd';
import { Avatar, Button, Spin } from 'antd';
import React from 'react';
import { loginOut } from '@/utils/loginOut';
import useHeaderActionStyles from './style';
import HeaderDropdown from '../HeaderDropdown';

type AvatarDropdownProps = {
  children?: React.ReactNode;
};

export const AvatarDropdown: React.FC<AvatarDropdownProps> = ({ children }) => {
  const { initialState, setInitialState } = useModel('@@initialState');
  const { styles } = useHeaderActionStyles();
  const isAdmin = initialState?.currentUser?.role === 'admin';

  const menuItems: MenuProps['items'] = [
    { key: 'profile', icon: <SettingOutlined />, label: '个人设置' },
    ...(isAdmin
      ? [
          {
            key: 'admin',
            icon: <CrownOutlined />,
            label: <Link to="/admin/dashboard">后台管理</Link>,
          },
        ]
      : []),
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录' },
  ];

  const onMenuClick: MenuProps['onClick'] = (event) => {
    const { key } = event;
    if (key === 'logout') {
      void loginOut(setInitialState);
      return;
    }
    if (key === 'profile') {
      history.push('/workspace/profile');
    }
    if (key === 'admin') {
      history.push('/admin/dashboard');
    }
  };

  if (!initialState?.currentUser) {
    return <Spin size="small" />;
  }

  const { nickname, avatar } = initialState.currentUser;

  // 未传 children 时自渲染头像（供 RightContent 直接使用）
  const trigger = children ?? (
    <Button type="text" className={styles.action}>
      <Avatar size="small" src={avatar} icon={<UserOutlined />} />
      <span style={{ marginLeft: 8 }}>{nickname ?? '用户'}</span>
    </Button>
  );

  return (
    <HeaderDropdown
      placement="bottomRight"
      menu={{ selectedKeys: [], onClick: onMenuClick, items: menuItems }}
      arrow
    >
      {trigger}
    </HeaderDropdown>
  );
};
