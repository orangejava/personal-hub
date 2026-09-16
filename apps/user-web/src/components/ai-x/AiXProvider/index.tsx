import { XProvider, type XProviderProps } from '@ant-design/x';
import React from 'react';

/**
 * Ant Design X 本地 Provider。
 *
 * 页面统一从这里进入 X 组件体系，后续如果要调整 X 组件主题、
 * locale 或替换底层实现，只需要收敛在本地封装层。
 */
const AiXProvider: React.FC<XProviderProps> = ({ children, ...rest }) => (
  <XProvider {...rest}>{children}</XProvider>
);

export default AiXProvider;

