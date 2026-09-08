import { describe, expect, it } from 'vitest';
import { assemblePublicSiteConfig, parseGroupValue } from '../src/modules/system/config-registry';
import { wouldCreateCycle } from '../src/modules/system/menu-rules';

describe('系统配置注册表', () => {
  it('缺字段时用默认值补齐，公开组装含 logoFileId 占位', () => {
    const publicConfig = assemblePublicSiteConfig(new Map());
    expect(publicConfig.siteName).toBe('Personal Hub');
    expect(publicConfig.logoFileId).toBeNull();
    expect(publicConfig.homepage.featuredContent.contentIds).toEqual([]);
    expect(publicConfig.layout.homeHeroStyle).toBe('split');
    expect(publicConfig.layout.projectsTitle).toBe('项目');
    expect(publicConfig.layout.projectsIntro).toBe('');
    expect(publicConfig.about.title).toBe('关于我');
    expect(publicConfig.navigation.publicPosition).toBe('top');
    expect(publicConfig.aiEnabled).toBe(false);
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
