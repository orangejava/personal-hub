import { ArrowLeftOutlined } from '@ant-design/icons';
import { history } from '@umijs/max';
import { Button } from 'antd';
import React from 'react';
import PerfRouteMarker from '@/components/perf/PerfRouteMarker';
import ThemeRuntimeSync from '@/components/ThemeRuntimeSync';
import { usePublicTheme } from '@/hooks/usePublicTheme';

/**
 * 登录页不一定有站内来源。有 redirect 就回到那个地址，否则退回上一页，再不行回首页。
 */
function goAuthBack() {
  const redirect = new URLSearchParams(window.location.search).get('redirect');
  if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
    history.push(redirect);
    return;
  }
  if (window.history.length > 1) {
    history.back();
    return;
  }
  history.push('/');
}

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
      <Button className="ph-auth-back" icon={<ArrowLeftOutlined />} type="text" onClick={goAuthBack}>
        返回
      </Button>
      {/* 登录不走 PublicLayout，计时结束点放在这里，否则站内进入后写不进登录卡片。 */}
      <PerfRouteMarker>{children}</PerfRouteMarker>
    </div>
  );
};
