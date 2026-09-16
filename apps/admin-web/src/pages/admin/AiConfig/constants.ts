import type { AiToolStatus, AiToolType } from '@personal-hub/shared-types';

export const toolStatusLabels: Record<AiToolStatus, { text: string; color: string }> = {
  enabled: { text: '已启用', color: 'success' },
  disabled: { text: '已禁用', color: 'default' },
  comingSoon: { text: '即将上线', color: 'warning' },
};

export const navGroupLabels: Record<string, string> = {
  home: '首页',
  create: '创作',
  assets: '资产',
  profile: '个人',
  commerce: '会员',
  help: '帮助',
  open: '开放',
};

export const aiToolTypeOptions: Array<{ label: string; value: AiToolType }> = [
  { label: 'AI 对话', value: 'chat' },
  { label: '文本生成', value: 'text' },
  { label: '图片生成', value: 'image' },
  { label: '视频生成', value: 'video' },
  { label: 'WebUI', value: 'webui' },
  { label: 'ComfyUI', value: 'comfyui' },
  { label: 'LoRA 训练', value: 'lora' },
  { label: 'AI 应用', value: 'apps' },
];
