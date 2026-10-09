import type { SystemPublicConfig } from '@personal-hub/shared-types';
import { describe, expect, it } from 'vitest';
import { faviconTextDataUrl, siteHeadFromConfig } from './siteHead';

function config(partial: Partial<SystemPublicConfig> = {}): SystemPublicConfig {
  return {
    siteName: 'Personal Hub',
    navigation: 'top',
    theme: { colorPrimary: '#1677ff', mode: 'dark' },
    ...partial,
  };
}

describe('faviconTextDataUrl', () => {
  it('底色使用传入的站点主色', () => {
    const href = faviconTextDataUrl('Pe', '#1677ff');
    expect(decodeURIComponent(href)).toContain('fill="#1677ff"');
  });

  it('颜色不是十六进制时回落到默认紫', () => {
    const href = faviconTextDataUrl('Pe', 'blue');
    expect(decodeURIComponent(href)).toContain('fill="#722ed1"');
  });
});

describe('siteHeadFromConfig', () => {
  it('图片模式使用已签名地址', () => {
    const head = siteHeadFromConfig(
      config({ faviconMode: 'image', faviconUrl: 'https://cdn.example/icon.png' }),
    );
    expect(head.faviconUrl).toBe('https://cdn.example/icon.png');
  });

  it('图片模式没有地址时改画文字图标，并带上主色', () => {
    const head = siteHeadFromConfig(config({ faviconMode: 'image', faviconUrl: null }));
    expect(head.faviconUrl?.startsWith('data:image/svg+xml')).toBe(true);
    expect(decodeURIComponent(head.faviconUrl ?? '')).toContain('fill="#1677ff"');
  });

  it('文字模式用站点名的前两个字和主色', () => {
    const head = siteHeadFromConfig(config({ faviconMode: 'text', faviconText: '' }));
    const svg = decodeURIComponent(head.faviconUrl ?? '');
    expect(svg).toContain('>Pe<');
    expect(svg).toContain('fill="#1677ff"');
  });
});
