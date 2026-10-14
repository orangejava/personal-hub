import { Link } from '@umijs/max';
import React from 'react';
import { PageContainer } from '@/components/shared';
import MetricsSettings from '../SystemSite/MetricsSettings';

/** 全站上报比例。从系统配置卡片进入，不和站点名称、Logo 放在同一张表单里。 */
const SystemMetrics: React.FC = () => (
  <PageContainer
    title="性能汇总"
    extra={<Link to="/admin/system">返回系统配置</Link>}
  >
    <MetricsSettings />
  </PageContainer>
);

export default SystemMetrics;
