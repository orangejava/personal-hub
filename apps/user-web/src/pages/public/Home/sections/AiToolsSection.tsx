import { history } from '@umijs/max';
import React from 'react';
import type { PublicHomepageConfig } from '@/services/system';
import { aiToolPath } from '../content';

interface AiToolsSectionProps {
  tools: PublicHomepageConfig['aiTools'];
}

/** 只展示后台 enabled 的工具。整块是否出现由首页根据 aiEnabled 决定。 */
const AiToolsSection: React.FC<AiToolsSectionProps> = ({ tools }) => {
  const enabled = tools.filter((item) => item.enabled);
  if (enabled.length === 0) return null;

  const openTool = (key: string) => {
    const path = aiToolPath(key);
    if (path) history.push(path);
  };

  return (
    <div className="ph-home-section">
      <h2>AI 工具</h2>
      <div className="ph-home-ai-row">
        {enabled.map((item) => (
          <button
            key={item.key}
            type="button"
            className="ph-home-ai-card"
            onClick={() => openTool(item.key)}
          >
            <strong>{item.title}</strong>
            <span>{item.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default AiToolsSection;
