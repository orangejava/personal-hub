import type { Settings as LayoutSettings } from '@ant-design/pro-components';
import defaultSettings from '../../config/defaultSettings';
import { publicDefaultSettings } from '@/config/publicDefaultSettings';
import type { PublicThemeSettings } from '@/types/app';

type Listener = () => void;

/** 供根级 ThemeProvider 读取；由 ThemeRuntimeSync 与设置面板写入 */
let publicSettings: PublicThemeSettings = { ...publicDefaultSettings };
let workspaceSettings: Partial<LayoutSettings> = {
  ...(defaultSettings as Partial<LayoutSettings>),
};
const listeners = new Set<Listener>();

export function getPublicThemeSettings(): PublicThemeSettings {
  return publicSettings;
}

export function getWorkspaceThemeSettings(): Partial<LayoutSettings> {
  return workspaceSettings;
}

export function setPublicThemeSettings(next: PublicThemeSettings): void {
  publicSettings = next;
  for (const listener of listeners) listener();
}

export function setWorkspaceThemeSettings(
  next: Partial<LayoutSettings>,
): void {
  workspaceSettings = next;
  for (const listener of listeners) listener();
}

export function subscribeThemeRuntime(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 启动期 initialState 写入一次，避免首屏闪烁 */
export function bootstrapThemeRuntime(state: {
  publicSettings?: PublicThemeSettings;
  settings?: Partial<LayoutSettings>;
}): void {
  if (state.publicSettings) publicSettings = state.publicSettings;
  if (state.settings) workspaceSettings = state.settings;
}
