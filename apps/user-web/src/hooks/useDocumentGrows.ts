import { useEffect } from 'react';

/** 手机档长页用这个类名放开 html / body / #root 的固定高度。 */
const DOCUMENT_GROWS_CLASS = 'ph-document-grows';

/**
 * 页面样式离开路由后仍留在文档里。
 * 只在当前页挂载时加上类名，离开时拿掉，避免手机上其他页面被改高度。
 */
export function useDocumentGrows() {
  useEffect(() => {
    const root = document.getElementById('root');
    const nodes = [document.documentElement, document.body, root].filter(
      (node): node is HTMLElement => node != null,
    );
    for (const node of nodes) node.classList.add(DOCUMENT_GROWS_CLASS);
    return () => {
      for (const node of nodes) node.classList.remove(DOCUMENT_GROWS_CLASS);
    };
  }, []);
}
