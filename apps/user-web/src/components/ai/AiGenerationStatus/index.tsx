import React from 'react';

/**
 * 生成过程中固定一句状态。
 * 停在输入区附近，不跟着流式文本跳动。
 */
const AiGenerationStatus: React.FC<{ active: boolean }> = ({ active }) => {
  if (!active) return null;
  return (
    <p className="ph-ai-generation-status" role="status">
      正在生成，可以停止当前任务
    </p>
  );
};

export default AiGenerationStatus;
