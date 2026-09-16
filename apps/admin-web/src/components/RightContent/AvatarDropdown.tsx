import {
  LogoutOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useModel } from '@umijs/max';
import type { MenuProps } from 'antd';
import { Avatar, Button, Spin } from 'antd';
import React from 'react';
import { getUserWebOrigin } from '@personal-hub/app-origins';
import { loginOut } from '@/utils/loginOut';
import HeaderDropdown from '../HeaderDropdown';
import useHeaderActionStyles from './style';

type AvatarDropdownProps = {
  children?: React.ReactNode;
};

export const AvatarDropdown: React.FC<AvatarDropdownProps> = ({ children }) => {
  const { initialState, setInitialState } = useModel('@@initialState');
  const { styles } = useHeaderActionStyles();

  const menuItems: MenuProps['items'] = [
    { key: 'profile', icon: <SettingOutlined />, label: '个人设置' },
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
      window.location.href = `${getUserWebOrigin()}/workspace/profile`;
    }
  };

  if (!initialState?.currentUser) {
    return <Spin size="small" />;
  }

  const { nickname, avatar } = initialState.currentUser;

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
