import React from 'react';

interface AiPageHeaderProps {
  title: string;
  description?: string;
  extra?: React.ReactNode;
}

/** AI 页面标题区，统一控制标题和说明的密度。 */
const AiPageHeader: React.FC<AiPageHeaderProps> = ({
  title,
  description,
  extra,
}) => (
  <div className="ph-ai-page-header">
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
      <div>
        <h1 className="ph-ai-page-title">{title}</h1>
        {description && (
          <div className="ph-ai-page-description">{description}</div>
        )}
      </div>
      {extra}
    </div>
  </div>
);

export default AiPageHeader;

