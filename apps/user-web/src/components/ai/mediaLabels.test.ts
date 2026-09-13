import { describe, expect, it } from 'vitest';
import { AI_MEDIA_QUALITY_LABELS, formatAiMediaParamLabel } from './mediaLabels';

describe('formatAiMediaParamLabel', () => {
  it('空值显示未设置，已知枚举走中文', () => {
    expect(formatAiMediaParamLabel(undefined, AI_MEDIA_QUALITY_LABELS)).toBe('未设置');
    expect(formatAiMediaParamLabel('high', AI_MEDIA_QUALITY_LABELS)).toBe('高画质');
    expect(formatAiMediaParamLabel('custom', AI_MEDIA_QUALITY_LABELS)).toBe('custom');
  });
});
