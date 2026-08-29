import { SettingOutlined } from '@ant-design/icons';
import { useModel } from '@umijs/max';
import { Button } from 'antd';
import React from 'react';
import useHeaderActionStyles from './style';

/** 顶栏主题设置按钮：独立 action，避免与语言/头像共享 hover 区域 */
export const ThemeSettingButton: React.FC = () => {
  const { setInitialState } = useModel('@@initialState');
  const { styles } = useHeaderActionStyles();

  return (
    <Button
      type="text"
      className={styles.action}
      aria-label="主题设置"
      icon={<SettingOutlined />}
      onClick={() =>
        setInitialState((s) => ({ ...s, workspaceSettingDrawerOpen: true }))
      }
    />
  );
};
