import { Link } from '@umijs/max';
import { Button, Tag } from 'antd';
import type { AiTemplate } from '@personal-hub/shared-types';
import React from 'react';

interface AiTemplateCardProps {
  template: AiTemplate;
}

const toolPathMap: Record<AiTemplate['toolType'], string> = {
  chat: '/ai/chat',
  text: '/ai/text',
  image: '/ai/image',
  video: '/ai/video',
};

/** 首页模板卡片：hover 后展示模型和使用入口。 */
const AiTemplateCard: React.FC<AiTemplateCardProps> = ({ template }) => (
  <article className="ph-ai-template-card">
    <div
      className="ph-ai-template-cover"
      style={{ backgroundImage: `url(${template.coverUrl})` }}
    />
    <div className="ph-ai-template-overlay">
      <div className="ph-ai-template-model">
        <Tag color="blue">{template.modelId}</Tag>
      </div>
      <div>
        <div className="ph-ai-template-title">{template.title}</div>
        <div className="ph-ai-template-description">{template.description}</div>
        <div className="ph-ai-template-action" style={{ marginTop: 12 }}>
          <Link
            to={`${toolPathMap[template.toolType]}?templateId=${template.id}`}
          >
            <Button size="small" type="primary">
              使用模板
            </Button>
          </Link>
        </div>
      </div>
    </div>
  </article>
);

export default AiTemplateCard;

