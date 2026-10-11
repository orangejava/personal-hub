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
    expect(publicConfig.loadingStyle).toBe('spinner');
    expect(publicConfig.loadingTitle).toBe('正在打开 Personal Hub');
    expect(publicConfig.loadingFileId).toBeNull();
    expect(publicConfig.loadingSvg).toBe('');
    expect(publicConfig.loadingShowSkeleton).toBe(true);
    expect(publicConfig.loadingMotion).toBe('none');
    expect(publicConfig.loadingSizeMode).toBe('default');
    expect(publicConfig.loadingMaxWidth).toBe(320);
    expect(publicConfig.loadingMaxHeight).toBe(320);
    expect(publicConfig.loadingWidth).toBe(72);
    expect(publicConfig.loadingHeight).toBe(72);
    expect(publicConfig.loadingVideoFileId).toBeNull();
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

  it('首屏 SVG 带脚本时公开结果清空，不把脚本发出去', () => {
    const publicConfig = assemblePublicSiteConfig(
      new Map([
        [
          'site.general',
          {
            loadingStyle: 'svg',
            loadingSvg: '<svg onload="alert(1)"><script>alert(1)</script></svg>',
          },
        ],
      ]),
    );
    expect(publicConfig.loadingStyle).toBe('svg');
    expect(publicConfig.loadingSvg).toBe('');
  });

  it('首屏 SVG 含 foreignObject 或外链时公开结果清空，普通图形保留', () => {
    const foreign = assemblePublicSiteConfig(
      new Map([
        [
          'site.general',
          {
            loadingStyle: 'svg',
            loadingSvg:
              '<svg><foreignObject><iframe src="https://evil.example"></iframe></foreignObject></svg>',
          },
        ],
      ]),
    );
    const linked = assemblePublicSiteConfig(
      new Map([
        [
          'site.general',
          {
            loadingStyle: 'svg',
            loadingSvg: '<svg><path d="M0 0" href="https://evil.example/a"/></svg>',
          },
        ],
      ]),
    );
    const plain = assemblePublicSiteConfig(
      new Map([
        [
          'site.general',
          {
            loadingStyle: 'svg',
            loadingSvg: '<svg viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>',
          },
        ],
      ]),
    );
    expect(foreign.loadingSvg).toBe('');
    expect(linked.loadingSvg).toBe('');
    expect(plain.loadingSvg).toContain('<path');
  });

  it('自定义宽高超过限制时公开结果收到限制以内', () => {
    const publicConfig = assemblePublicSiteConfig(
      new Map([
        [
          'site.general',
          {
            loadingSizeMode: 'custom',
            loadingMaxWidth: 160,
            loadingMaxHeight: 120,
            loadingWidth: 400,
            loadingHeight: 400,
          },
        ],
      ]),
    );
    expect(publicConfig.loadingWidth).toBe(160);
    expect(publicConfig.loadingHeight).toBe(120);
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

  it('旧首页模块只有 4 个 key 时补上新区块，并保留已保存的显隐', () => {
    const homepage = parseGroupValue('site.homepage', {
      modules: [
        { key: 'hero', title: 'Hero 区块', visible: true, sort: 1 },
        { key: 'featured', title: '精选内容', visible: false, sort: 2 },
        { key: 'aiTools', title: 'AI 工具推荐', visible: true, sort: 3 },
        { key: 'techStack', title: '技术栈展示', visible: true, sort: 4 },
      ],
    }) as { modules: { key: string; visible: boolean; sort: number }[] };
    expect(homepage.modules.map((item) => item.key)).toEqual([
      'hero',
      'capabilities',
      'featured',
      'aiTools',
      'showcase',
      'techStack',
      'performance',
    ]);
    expect(homepage.modules.find((item) => item.key === 'featured')?.visible).toBe(false);
    expect(homepage.modules.find((item) => item.key === 'capabilities')?.visible).toBe(true);
  });

  it('首页模块已包含全部默认 key 时尊重后台保存的排序', () => {
    const homepage = parseGroupValue('site.homepage', {
      modules: [
        { key: 'techStack', title: '技术栈展示', visible: true, sort: 1 },
        { key: 'hero', title: 'Hero 区块', visible: false, sort: 2 },
        { key: 'capabilities', title: '平台能力', visible: true, sort: 3 },
        { key: 'featured', title: '精选内容与分类入口', visible: true, sort: 4 },
        { key: 'aiTools', title: 'AI 工具推荐', visible: true, sort: 5 },
        { key: 'showcase', title: '作品矩阵预告', visible: true, sort: 6 },
        { key: 'performance', title: '性能数据', visible: true, sort: 7 },
      ],
    }) as { modules: { key: string; visible: boolean; sort: number }[] };
    expect(homepage.modules.find((item) => item.key === 'techStack')?.sort).toBe(1);
    expect(homepage.modules.find((item) => item.key === 'hero')?.visible).toBe(false);
  });

  it('拒绝单端超过六张截图', () => {
    expect(() =>
      parseGroupValue('site.layout', {
        projectVisualAssets: [
          {
            key: 'user-web',
            coverFileId: null,
            screenshotFileIds: Array.from(
              { length: 7 },
              (_, index) => `00000000-0000-4000-8000-00000000000${index}`,
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
