import React from 'react';
import { siteFiling } from '@/config/siteFiling';
import './index.less';

/** 仅由公开入口显式挂载，避免影响 AI 工具操作区和登录后页面。 */
const SiteFiling: React.FC = () => (
  <footer className="ph-site-filing">
    <a href={siteFiling.icpLookupUrl} rel="noopener noreferrer" target="_blank">
      {siteFiling.icpNumber}
    </a>
  </footer>
);

export default SiteFiling;
