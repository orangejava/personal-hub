/** 与 Ant Design Pro SettingDrawer 一致的主题色预设 */
export const THEME_COLOR_PRESETS = [
  { key: 'techBlue', color: '#1677FF', title: '科技蓝（默认）' },
  { key: 'daybreak', color: '#1890ff', title: '拂晓蓝' },
  { key: 'dust', color: '#F5222D', title: '薄暮' },
  { key: 'volcano', color: '#FA541C', title: '火山' },
  { key: 'sunset', color: '#FAAD14', title: '日暮' },
  { key: 'cyan', color: '#13C2C2', title: '明青' },
  { key: 'green', color: '#52C41A', title: '极光绿' },
  { key: 'geekblue', color: '#2F54EB', title: '极客蓝' },
  { key: 'purple', color: '#722ED1', title: '酱紫' },
] as const;

export type NavThemePreset = 'light' | 'realDark';

export const NAV_THEME_PRESETS: {
  key: NavThemePreset;
  title: string;
}[] = [
  { key: 'light', title: '亮色风格' },
  { key: 'realDark', title: '暗色风格' },
];
