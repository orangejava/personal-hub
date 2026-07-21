/**
 * 应用运行时类型
 */
import type { Settings as ProSettings } from '@ant-design/pro-components';
import type {
  MenuItem,
  PermissionCode,
  SystemPublicConfig,
  User,
} from '@personal-hub/shared-types';

/** ProLayout 设置类型（pro-components 导出名为 Settings，等价于 ProSettings） */
export type LayoutSettings = ProSettings;

/** 公开前台主题（与工作区 ProLayout settings 分离） */
export interface PublicThemeSettings {
  navTheme: 'light' | 'realDark';
  colorPrimary: string;
}

/** @@initialState 结构 */
export interface InitialState {
  /** 工作区 ProLayout 主题与布局 */
  settings?: Partial<LayoutSettings>;
  /** 公开前台主题 */
  publicSettings?: PublicThemeSettings;
  currentUser?: User;
  permissions?: PermissionCode[];
  menu?: MenuItem[];
  systemConfig?: SystemPublicConfig;
  /** 工作区 SettingDrawer 开关 */
  workspaceSettingDrawerOpen?: boolean;
  /** 公开前台主题抽屉开关 */
  publicSettingDrawerOpen?: boolean;
}
