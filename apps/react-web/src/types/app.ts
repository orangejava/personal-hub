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
  /** Nest 动作权限与 OWN/ALL 范围；mock 模式下为空 */
  permissionGrants?: Array<{ code: string; dataScope: 'OWN' | 'ALL' }>;
  menu?: MenuItem[];
  systemConfig?: SystemPublicConfig;
  /** 工作区 SettingDrawer 开关 */
  workspaceSettingDrawerOpen?: boolean;
  /** 公开前台主题抽屉开关 */
  publicSettingDrawerOpen?: boolean;
  /**
   * 启动时 refresh/me 因 403/5xx/断网失败，会话未必失效。
   * 为 true 时不要当成未登录踢回登录页。
   */
  sessionRestoreFailed?: boolean;
}
