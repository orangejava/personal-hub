import React from 'react';

interface PageContainerProps {
  title?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}

/** 简单页面容器：标题 + 操作区 + 内容 */
const PageContainer: React.FC<PageContainerProps> = ({
  title,
  extra,
  children,
}) => (
  <div className="ph-page">
    {(title || extra) && (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        {title && <h2 style={{ margin: 0 }}>{title}</h2>}
        {extra}
      </div>
    )}
    {children}
  </div>
);

export default PageContainer;
