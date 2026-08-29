import React from 'react';
import ThemeRuntimeSync from '@/components/ThemeRuntimeSync';
import { usePublicTheme } from '@/hooks/usePublicTheme';

/**
 * 登录 / 注册 / 验证页没有 PublicLayout，但仍走公开区主题。
 * 用与前台相同的语义 class，亮暗和主色跟随站点主题，不写死浅色。
 */
export const AuthPageShell: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { settings, isDark } = usePublicTheme();

  return (
    <div
      className={
        isDark
          ? 'ph-public-layout ph-public-dark ph-auth-page'
          : 'ph-public-layout ph-auth-page'
      }
      style={{ ['--ph-color-primary' as string]: settings.colorPrimary }}
    >
      <ThemeRuntimeSync />
      {children}
    </div>
  );
};
