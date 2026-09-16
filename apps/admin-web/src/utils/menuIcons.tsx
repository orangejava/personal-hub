import {
  AppstoreOutlined,
  AuditOutlined,
  BookOutlined,
  BgColorsOutlined,
  CloudUploadOutlined,
  CrownOutlined,
  DashboardOutlined,
  DesktopOutlined,
  EditOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  FolderOutlined,
  HomeOutlined,
  MenuOutlined,
  PieChartOutlined,
  ReadOutlined,
  RobotOutlined,
  SettingOutlined,
  StarOutlined,
  TagsOutlined,
  TeamOutlined,
  ToolOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { MenuItem } from '@personal-hub/shared-types';
import React from 'react';

/** 菜单 icon 字符串到 Ant Design 图标组件的映射 */
const iconMap: Record<string, React.ReactNode> = {
  home: <HomeOutlined />,
  read: <ReadOutlined />,
  project: <AppstoreOutlined />,
  appstore: <AppstoreOutlined />,
  user: <UserOutlined />,
  robot: <RobotOutlined />,
  dashboard: <DashboardOutlined />,
  fileText: <FileTextOutlined />,
  edit: <EditOutlined />,
  book: <BookOutlined />,
  star: <StarOutlined />,
  pieChart: <PieChartOutlined />,
  setting: <SettingOutlined />,
  desktop: <DesktopOutlined />,
  laptop: <DesktopOutlined />,
  crown: <CrownOutlined />,
  team: <TeamOutlined />,
  folder: <FolderOutlined />,
  tags: <TagsOutlined />,
  cloudUpload: <CloudUploadOutlined />,
  audit: <AuditOutlined />,
  menu: <MenuOutlined />,
  fileSearch: <FileSearchOutlined />,
  tool: <ToolOutlined />,
  bgColors: <BgColorsOutlined />,
};

/** 把 mock 菜单的 icon 字符串转成真实图标节点，供 ProLayout 渲染 */
export function withMenuIcons(menu: MenuItem[] | undefined): MenuItem[] {
  if (!menu) return [];
  return menu.map((m) => ({
    ...m,
    icon: m.icon ? (iconMap[m.icon] ?? null) : null,
    children: m.children ? withMenuIcons(m.children) : undefined,
  })) as unknown as MenuItem[];
}
