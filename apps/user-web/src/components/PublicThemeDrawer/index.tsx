import { App } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import type { PublicThemeDrawerProps } from './PublicThemeDrawerPanel';

type PanelComponent = React.ComponentType<PublicThemeDrawerProps>;

/**
 * 抽屉内的 ColorPicker 等依赖约 60 KiB，不进公开页首屏，第一次打开时再拉。
 * 不用 React.lazy：它会缓存失败的 import，之后再点也打不开，错误还会冒到全局 ErrorBoundary 把整页换掉。
 */
function loadPanel(): Promise<PanelComponent> {
  return import('./PublicThemeDrawerPanel').then((mod) => mod.default);
}

/**
 * 公开前台主题抽屉入口。
 * 加载成功后保持挂载，关闭动画和 destroyOnHidden={false} 的行为不变。
 * 加载失败时提示并关闭抽屉，下次点击重新请求分包。
 */
const PublicThemeDrawer: React.FC<PublicThemeDrawerProps> = (props) => {
  const { open, onClose } = props;
  const { message } = App.useApp();
  const [Panel, setPanel] = useState<PanelComponent | null>(null);
  /** 防止 StrictMode 双执行或请求未返回时重复发起加载、重复提示。 */
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!open || Panel || loadingRef.current) return;
    loadingRef.current = true;
    loadPanel()
      .then((component) => setPanel(() => component))
      .catch(() => {
        message.error('主题设置加载失败，请检查网络后重试');
        onClose();
      })
      .finally(() => {
        loadingRef.current = false;
      });
  }, [open, Panel, message, onClose]);

  return Panel ? <Panel {...props} /> : null;
};

export default PublicThemeDrawer;
