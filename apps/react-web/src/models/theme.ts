/**
 * 主题状态 model：主题模式（亮/暗/跟随系统）
 * 主题 token 主要来自系统配置 initialState，此处只管理用户手动覆盖的模式
 */

import type { ThemeMode } from '@personal-hub/shared-types';
import { useCallback, useState } from 'react';

export default function ThemeModel() {
  const [mode, setMode] = useState<ThemeMode>('light');

  const toggleMode = useCallback(() => {
    setMode((m) => (m === 'light' ? 'dark' : 'light'));
  }, []);

  return { mode, setMode, toggleMode };
}
