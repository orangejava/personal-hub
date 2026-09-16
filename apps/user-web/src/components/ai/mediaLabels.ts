/** 图/视频配置与详情共用的参数文案，避免两处各写一套。 */
export const AI_MEDIA_QUALITY_LABELS: Record<string, string> = {
  low: '低画质',
  standard: '标准画质',
  high: '高画质',
};

export const AI_MEDIA_RESOLUTION_LABELS: Record<string, string> = {
  '1k': '1K',
  '2k': '2K',
  '4k': '4K',
};

export function formatAiMediaParamLabel(
  value: string | undefined,
  labels: Record<string, string>,
) {
  if (!value) return '未设置';
  return labels[value] ?? value;
}
