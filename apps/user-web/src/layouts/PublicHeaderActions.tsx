import { DashboardOutlined, SettingOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import React, { lazy, Suspense, useState } from 'react';
import UserAccountPopover from '@/components/shared/UserAccountPopover';

const PerfDrawer = lazy(() => import('@/components/perf/PerfDrawer'));

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
  const [perfOpen, setPerfOpen] = useState(false);
  const openPerf = () => setPerfOpen(true);
  const closePerf = () => setPerfOpen(false);

  return (
    <div className="ph-public-header-actions">
      <Button
        type="text"
        aria-label="性能面板"
        icon={<DashboardOutlined />}
        onClick={openPerf}
      />
      {showThemeButton ? (
        <Button
          type="text"
          aria-label="主题设置"
          icon={<SettingOutlined />}
          onClick={onOpenThemeSettings}
        />
      ) : null}
      <UserAccountPopover variant="base" />
      {perfOpen ? (
        <Suspense fallback={null}>
          <PerfDrawer open onClose={closePerf} />
        </Suspense>
      ) : null}
    </div>
  );
};

export default PublicHeaderActions;
