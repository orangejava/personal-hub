import type { AiGenerationTask } from '@personal-hub/shared-types';
import React from 'react';
import {
  AI_MEDIA_QUALITY_LABELS,
  AI_MEDIA_RESOLUTION_LABELS,
} from '@/components/ai/mediaLabels';

interface AiMediaPromptConfigProps {
  task: AiGenerationTask;
  modelNames?: Record<string, string>;
}

function resolveModelLabel(
  task: AiGenerationTask,
  labels?: Record<string, string>,
) {
  return labels?.[task.modelId] || task.modelName || task.modelId;
}

/** 跟在提示词后面的模型 + 用户配置，图/视频共用。 */
function resolveConfigItems(
  task: AiGenerationTask,
  modelNames?: Record<string, string>,
) {
  const params = task.params ?? {};
  const items: string[] = [];
  const modelLabel = resolveModelLabel(task, modelNames);
  if (modelLabel) items.push(modelLabel);
  if (params.size) items.push(params.size);
  if (task.toolType === 'video') {
    if (params.durationSeconds != null) items.push(`${params.durationSeconds} 秒`);
  } else {
    if (params.count) items.push(`${params.count} 张`);
    if (params.quality) items.push(AI_MEDIA_QUALITY_LABELS[params.quality] ?? params.quality);
    if (params.resolution) {
      items.push(AI_MEDIA_RESOLUTION_LABELS[params.resolution] ?? params.resolution);
    }
  }
  if (params.style) items.push(params.style);
  return items;
}

/**
 * 图片/视频记录里、提示词右侧的配置摘要。
 * 颜色走次级文本 token，深浅色都比提示词更浅。
 */
const AiMediaPromptConfig: React.FC<AiMediaPromptConfigProps> = ({
  task,
  modelNames,
}) => {
  const items = resolveConfigItems(task, modelNames);
  if (items.length === 0) return null;
  return (
    <span className="ph-ai-media-prompt-config">
      {items.map((item, index) => (
        <React.Fragment key={item}>
          {index > 0 && (
            <span className="ph-ai-media-prompt-config-sep" aria-hidden>
              ·
            </span>
          )}
          <span className="ph-ai-media-prompt-config-item">{item}</span>
        </React.Fragment>
      ))}
    </span>
  );
};

export default AiMediaPromptConfig;
