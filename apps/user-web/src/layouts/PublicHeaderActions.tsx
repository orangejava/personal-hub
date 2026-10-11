import { SettingOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import React from 'react';
import PerfPanelButton from '@/components/perf/PerfPanelButton';
import UserAccountPopover from '@/components/shared/UserAccountPopover';

interface PublicHeaderActionsProps {
  /** 打开主题设置抽屉；后续性能面板只在这里追加入口，不触碰布局结构。 */
  onOpenThemeSettings: () => void;
  /** 站点关闭「允许用户切换」时不渲染主题按钮，账号入口仍保留。 */
  showThemeButton?: boolean;
}

/** 公开顶栏右侧操作区，统一承载性能、主题和账户入口。 */
const PublicHeaderActions: React.FC<PublicHeaderActionsProps> = ({
  onOpenThemeSettings,
  showThemeButton = true,
}) => {
  return (
    <div className="ph-public-header-actions">
      <PerfPanelButton />
      {showThemeButton ? (
        <Button
          type="text"
          aria-label="主题设置"
          icon={<SettingOutlined />}
          onClick={onOpenThemeSettings}
        />
      ) : null}
      <UserAccountPopover variant="base" />
    </div>
  );
};

export default PublicHeaderActions;
