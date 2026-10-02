import { SettingOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import React from 'react';
import { UserAccountPopover } from '@/components/shared';

interface PublicHeaderActionsProps {
  /** 打开主题设置抽屉；后续性能面板只在这里追加入口，不触碰布局结构。 */
  onOpenThemeSettings: () => void;
}

/** 公开顶栏右侧操作区，统一承载主题和账户入口。 */
const PublicHeaderActions: React.FC<PublicHeaderActionsProps> = ({ onOpenThemeSettings }) => (
  <div className="ph-public-header-actions">
    <Button
      type="text"
      aria-label="主题设置"
      icon={<SettingOutlined />}
      onClick={onOpenThemeSettings}
    />
    <UserAccountPopover variant="base" />
  </div>
);

export default PublicHeaderActions;
