/**
 * 布局状态 model：当前布局区域、侧栏折叠、导航状态
 */
import { useCallback, useState } from 'react';

export type LayoutRegion = 'public' | 'workspace' | 'admin';

export default function LayoutModel() {
  /** 工作区/后台侧栏是否折叠 */
  const [collapsed, setCollapsed] = useState(false);
  /** 当前所处布局区域，用于切换布局样式 */
  const [region, setRegion] = useState<LayoutRegion>('public');

  const toggleCollapsed = useCallback(() => setCollapsed((c) => !c), []);

  return { collapsed, setCollapsed, toggleCollapsed, region, setRegion };
}
