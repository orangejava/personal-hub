import { describe, expect, it } from 'vitest';
import { assemblePublicSiteConfig, parseGroupValue } from '../src/modules/system/config-registry';
import { wouldCreateCycle } from '../src/modules/system/menu-rules';

describe('系统配置注册表', () => {
  it('缺字段时用默认值补齐，公开组装含 logoFileId 占位', () => {
    const publicConfig = assemblePublicSiteConfig(new Map());
    expect(publicConfig.siteName).toBe('Personal Hub');
    expect(publicConfig.keywords).toBe('');
    expect(publicConfig.logoFileId).toBeNull();
    expect(publicConfig.logoMode).toBe('text');
    expect(publicConfig.logoText).toBe('');
    expect(publicConfig.faviconFileId).toBeNull();
    expect(publicConfig.faviconMode).toBe('text');
    expect(publicConfig.faviconText).toBe('');
    expect(publicConfig.faviconUrl).toBeNull();
    expect(publicConfig.homepage.featuredContent.contentIds).toEqual([]);
    expect(publicConfig.layout.homeHeroStyle).toBe('split');
    expect(publicConfig.layout.projectsTitle).toBe('项目');
    expect(publicConfig.layout.projectsIntro).toBe('');
    expect(publicConfig.about.title).toBe('关于我');
    expect(publicConfig.navigation.publicPosition).toBe('top');
    expect(publicConfig.aiEnabled).toBe(true);
    expect(publicConfig.theme.mode).toBe('dark');
    expect(publicConfig.theme.colorPrimary).toBe('#722ed1');
    expect(publicConfig.theme.colorSecondary).toBe('#14B8A6');
    expect(publicConfig.navigation.publicBlur).toBe(true);
    expect(publicConfig.projectVisualAssetFiles).toEqual([
      { key: 'user-web', coverFileId: null, screenshotFileIds: [] },
      { key: 'admin-web', coverFileId: null, screenshotFileIds: [] },
      { key: 'server', coverFileId: null, screenshotFileIds: [] },
      { key: 'flutter', coverFileId: null, screenshotFileIds: [] },
      { key: 'desktop', coverFileId: null, screenshotFileIds: [] },
    ]);
  });

  it('已有 Logo 文件且没写模式时仍按图片展示', () => {
    const publicConfig = assemblePublicSiteConfig(
      new Map([
        [
          'site.general',
          { logoFileId: '3f7d05d7-ea41-4565-94d1-05152c7ae64a' },
        ],
      ]),
    );
    expect(publicConfig.logoMode).toBe('image');
    expect(publicConfig.faviconMode).toBe('text');
  });

  it('站点名称超过 20 个字时拒绝', () => {
    expect(() => parseGroupValue('site.general', { siteName: 'a'.repeat(21) })).toThrow();
  });

  it('拒绝非法颜色', () => {
    expect(() => parseGroupValue('site.theme', { colorPrimary: 'blue' })).toThrow();
  });

  it('旧 layout JSON 缺项目字段时用默认值补齐', () => {
    const layout = parseGroupValue('site.layout', {
      homeHeroStyle: 'center',
      contentCardStyle: 'compact',
      contentReaderWidth: 'wide',
      showBreadcrumb: false,
    }) as { projectsTitle: string; homeHeroStyle: string };
    expect(layout.homeHeroStyle).toBe('center');
    expect(layout.projectsTitle).toBe('项目');
  });

  it('拒绝缺少固定端或重复端的项目视觉资产', () => {
    expect(() =>
      parseGroupValue('site.layout', {
        projectVisualAssets: [
          { key: 'user-web', coverFileId: null, screenshotFileIds: [] },
          { key: 'user-web', coverFileId: null, screenshotFileIds: [] },
        ],
      }),
    ).toThrow();
  });

  it('拒绝单端超过六张截图', () => {
    expect(() =>
      parseGroupValue('site.layout', {
        projectVisualAssets: [
          {
            key: 'user-web',
            coverFileId: null,
            screenshotFileIds: Array.from({ length: 7 }, (_, index) =>
              `00000000-0000-4000-8000-00000000000${index}`,
            ),
          },
          { key: 'admin-web', coverFileId: null, screenshotFileIds: [] },
          { key: 'server', coverFileId: null, screenshotFileIds: [] },
          { key: 'flutter', coverFileId: null, screenshotFileIds: [] },
          { key: 'desktop', coverFileId: null, screenshotFileIds: [] },
        ],
      }),
    ).toThrow();
  });
});

describe('菜单环检测', () => {
  it('不能把节点挂到自己的子孙下', () => {
    const parentById = new Map<string, string | null>([
      ['root', null],
      ['child', 'root'],
      ['leaf', 'child'],
    ]);
    expect(wouldCreateCycle('root', 'leaf', parentById)).toBe(true);
    expect(wouldCreateCycle('leaf', 'root', parentById)).toBe(false);
  });
});
