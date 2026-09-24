import React from 'react';

interface PageContainerProps {
  title?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** 简单页面容器：标题 + 操作区 + 内容 */
const PageContainer: React.FC<PageContainerProps> = ({
  title,
  extra,
  children,
  className,
}) => (
  <div className={['ph-page', className].filter(Boolean).join(' ')}>
    {(title || extra) && (
      <div className="ph-page-header">
        {title && <h2 className="ph-page-header-title">{title}</h2>}
        {extra && <div className="ph-page-header-extra">{extra}</div>}
      </div>
    )}
    {children}
  </div>
);

export default PageContainer;
