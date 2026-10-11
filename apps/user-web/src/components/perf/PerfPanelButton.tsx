import { DashboardOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import React, { lazy, Suspense, useState } from 'react';

const PerfDrawer = lazy(() => import('@/components/perf/PerfDrawer'));

/** 顶栏性能入口。抽屉按打开再加载，公开页、AI 和工作区共用这一个按钮。 */
const PerfPanelButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  const openPanel = () => setOpen(true);
  const closePanel = () => setOpen(false);

  return (
    <span>
      <Button
        type="text"
        aria-label="性能面板"
        icon={<DashboardOutlined />}
        onClick={openPanel}
      />
      {open ? (
        <Suspense fallback={null}>
          <PerfDrawer open onClose={closePanel} />
        </Suspense>
      ) : null}
    </span>
  );
};

export default PerfPanelButton;
