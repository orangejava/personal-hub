import { z } from 'zod';

/**
 * 类型化配置分组。公开接口只拼装 is_public 组里允许外露的字段，
 * 密钥类配置不得进入 assemblePublicSiteConfig。
 */
export const SYSTEM_CONFIG_GROUPS = [
  'site.general',
  'site.theme',
  'site.homepage',
  'site.about',
  'site.navigation',
  'site.layout',
  'ai.branding',
  'file.policies',
  'ops.metrics',
] as const;

export type SystemConfigGroup = (typeof SYSTEM_CONFIG_GROUPS)[number];

/** 公开接口不得拼装这些组；一期也没有独立「文件策略」后台页。 */
export const PRIVATE_SYSTEM_CONFIG_GROUPS: ReadonlySet<SystemConfigGroup> = new Set([
  'file.policies',
  'ops.metrics',
]);

export function isPublicSystemConfigGroup(group: SystemConfigGroup): boolean {
  return !PRIVATE_SYSTEM_CONFIG_GROUPS.has(group);
}

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, '颜色必须是 #RGB / #RRGGBB');

const nullableUuid = z.string().uuid().nullable();

/** 旧配置没有模式字段：已经绑了文件就继续当图片，否则显示文字。 */
export function resolveBrandMode(mode: unknown, fileId: string | null): 'text' | 'image' {
  if (mode === 'text' || mode === 'image') return mode;
  return fileId ? 'image' : 'text';
}

const shortText = z.string().max(200);
const longText = z.string().max(20000);
const urlOrEmpty = z.union([z.string().url().max(2048), z.literal('')]);

export const PROJECT_SHOWCASE_KEYS = [
  'user-web',
  'admin-web',
  'server',
  'flutter',
  'desktop',
] as const;

export type ProjectShowcaseKey = (typeof PROJECT_SHOWCASE_KEYS)[number];

const projectVisualAssetSchema = z.object({
  key: z.enum(PROJECT_SHOWCASE_KEYS),
  coverFileId: nullableUuid,
  screenshotFileIds: z.array(z.string().uuid()).max(6),
});

const projectVisualAssetsSchema = z
  .array(projectVisualAssetSchema)
  .length(PROJECT_SHOWCASE_KEYS.length)
  .superRefine((assets, context) => {
    const keys = new Set(assets.map((asset) => asset.key));
    if (keys.size !== PROJECT_SHOWCASE_KEYS.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: '项目视觉资产必须各包含一次固定端 key',
      });
      return;
    }
    for (const key of PROJECT_SHOWCASE_KEYS) {
      if (!keys.has(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `项目视觉资产缺少 ${key}`,
        });
      }
    }
  });

const actionSchema = z.object({
  label: shortText,
  target: z.string().max(500),
});

const LOADING_SVG_TAGS = new Set([
  'svg',
  'g',
  'path',
  'circle',
  'rect',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'defs',
  'lineargradient',
  'radialgradient',
  'stop',
  'title',
  'desc',
  'clippath',
  'mask',
]);

/**
 * 首屏脚本会把这段插进页面。只保留图形标签。
 * 出现脚本、事件、外链、foreignObject 或其他标签时整段丢掉，避免只删一半还留下可执行内容。
 */
function sanitizeLoadingSvg(value: string): string {
  const text = value.trim();
  if (!/^<svg[\s>]/i.test(text) || !/<\/svg>\s*$/i.test(text)) return '';
  if (
    /<\s*(script|foreignobject|iframe|embed|object|image|use|set|animate|animatetransform|animatemotion|style|link|meta|audio|video|canvas)\b/i.test(
      text,
    )
  ) {
    return '';
  }
  if (/javascript\s*:|\son[a-z0-9_-]+\s*=|(?:xlink:)?href\s*=/i.test(text)) return '';
  const tags = text.match(/<\/?\s*([a-zA-Z][\w:-]*)/g) ?? [];
  for (const raw of tags) {
    const name = raw.replace(/<\/?\s*/, '').toLowerCase();
    if (!LOADING_SVG_TAGS.has(name)) return '';
  }
  return text;
}

export const siteGeneralSchema = z.object({
  siteName: z.string().min(1).max(20),
  siteDescription: z.string().max(500),
  keywords: z.string().max(500),
  logoFileId: nullableUuid,
  /** 未写入时由 resolveBrandMode 按有没有文件决定，避免把已上传的 Logo 收成文字。 */
  logoMode: z.enum(['text', 'image']).optional(),
  logoText: z.string().max(20).optional(),
  faviconFileId: nullableUuid,
  faviconMode: z.enum(['text', 'image']).optional(),
  faviconText: z.string().max(2).optional(),
  /** 首屏占位的图形。旧配置没有这项时用圆点转圈。 */
  loadingStyle: z.enum(['spinner', 'square', 'image', 'svg', 'video']).optional(),
  loadingTitle: z.string().max(40).optional(),
  loadingSubtitle: z.string().max(80).optional(),
  /** 图片、SVG、视频的动效。圆点和方块不用这项。 */
  loadingMotion: z.enum(['none', 'spin', 'pulse', 'float']).optional(),
  /** 默认用素材自身宽高；custom 时使用下面的宽高。两者都不能超过限制宽高。 */
  loadingSizeMode: z.enum(['default', 'custom']).optional(),
  loadingMaxWidth: z.number().int().min(48).max(480).optional(),
  loadingMaxHeight: z.number().int().min(48).max(480).optional(),
  loadingWidth: z.number().int().min(48).max(480).optional(),
  loadingHeight: z.number().int().min(48).max(480).optional(),
  /** 旧的正方形边长。没有 loadingSizeMode 且不是 72 时，当成自定义正方形。 */
  loadingSize: z.number().int().min(48).max(240).optional(),
  loadingVideoFileId: nullableUuid,
  /** 标题下面三道灰色骨架。旧配置没有这项时仍然显示。 */
  loadingShowSkeleton: z.boolean().optional(),
  /** 进度百分比后面的秒数。旧配置没有这项时仍然显示。 */
  loadingShowElapsed: z.boolean().optional(),
  loadingFileId: nullableUuid,
  loadingSvg: z
    .string()
    .max(8000)
    .optional()
    .transform((value) => (value ? sanitizeLoadingSvg(value) : '')),
  avatarFileId: nullableUuid,
  ownerName: shortText,
  githubUrl: urlOrEmpty,
  email: z.union([z.string().email().max(320), z.literal('')]),
});

export const siteThemeSchema = z.object({
  colorPrimary: hexColor,
  colorSuccess: hexColor,
  colorWarning: hexColor,
  colorError: hexColor,
  colorSecondary: hexColor,
  colorAccent: hexColor,
  borderRadius: z.number().int().min(0).max(24),
  fontFamily: z.string().max(80),
  mode: z.enum(['light', 'dark', 'auto']),
  allowUserSwitch: z.boolean(),
});

export const siteHomepageSchema = z.object({
  hero: z.object({
    title: z.string().max(120),
    subtitle: z.string().max(300),
    primaryAction: actionSchema,
    secondaryAction: actionSchema,
  }),
  modules: z.array(
    z.object({
      key: z.string().max(80),
      title: z.string().max(80),
      visible: z.boolean(),
      sort: z.number().int(),
    }),
  ),
  featuredContent: z.object({
    contentIds: z.array(z.string().max(80)),
  }),
  aiTools: z.array(
    z.object({
      key: z.string().max(80),
      title: z.string().max(80),
      description: z.string().max(200),
      enabled: z.boolean(),
    }),
  ),
  techStack: z.array(
    z.object({
      name: z.string().max(80),
      icon: z.string().max(80).optional(),
      category: z.string().max(80),
    }),
  ),
});

export const siteAboutSchema = z.object({
  title: z.string().max(120),
  markdown: longText,
});

export const siteNavigationSchema = z.object({
  publicPosition: z.enum(['top', 'left', 'right']),
  publicSticky: z.boolean(),
  publicBlur: z.boolean(),
  publicShowLogo: z.boolean(),
  publicShowAuthEntry: z.boolean(),
  workspaceCollapsible: z.boolean(),
  adminCollapsible: z.boolean(),
});

export const siteLayoutSchema = z.object({
  homeHeroStyle: z.enum(['split', 'center', 'minimal']),
  contentCardStyle: z.enum(['cover', 'compact']),
  contentReaderWidth: z.enum(['narrow', 'comfortable', 'wide']),
  showBreadcrumb: z.boolean(),
  /** 公开项目页标题；放 layout 组避免再开一组配置。 */
  projectsTitle: z.string().max(80),
  projectsIntro: longText,
  /**
   * 后台仅保存文件 ID；公开配置在 SystemService 转成短期签名 URL，
   * 避免把对象存储内部标识交给匿名访问者。
   */
  projectVisualAssets: projectVisualAssetsSchema,
});

export const aiBrandingSchema = z.object({
  aiEnabled: z.boolean(),
  brandName: z.string().min(1).max(40),
  logoText: z.string().min(1).max(12),
});

const filePurposePolicySchema = z.object({
  mimeTypes: z.array(z.string().max(127)).max(20).optional(),
  maxBytes: z
    .number()
    .int()
    .nonnegative()
    .refine(Number.isSafeInteger, '文件大小必须是安全整数')
    .optional(),
});

export const opsMetricsSchema = z.object({
  /** 0 到 1。0.2 表示约 20% 的访问会上报。 */
  sampleRate: z.number().min(0).max(1),
  /** 小时直方图保留天数。日汇总不按这个删除。 */
  hourRetentionDays: z.number().int().min(1).max(365),
});

export const filePoliciesSchema = z.object({
  AVATAR: filePurposePolicySchema.optional(),
  COVER: filePurposePolicySchema.optional(),
  CONTENT_FILE: filePurposePolicySchema.optional(),
  BOOKLET_SOURCE: filePurposePolicySchema.optional(),
  TEMPORARY_IMPORT: filePurposePolicySchema.optional(),
  AI_ASSET: filePurposePolicySchema.optional(),
});

export const GROUP_SCHEMAS = {
  'site.general': siteGeneralSchema,
  'site.theme': siteThemeSchema,
  'site.homepage': siteHomepageSchema,
  'site.about': siteAboutSchema,
  'site.navigation': siteNavigationSchema,
  'site.layout': siteLayoutSchema,
  'ai.branding': aiBrandingSchema,
  'file.policies': filePoliciesSchema,
  'ops.metrics': opsMetricsSchema,
} as const;

export type SiteGeneral = z.infer<typeof siteGeneralSchema>;
export type SiteTheme = z.infer<typeof siteThemeSchema>;
export type SiteHomepage = z.infer<typeof siteHomepageSchema>;
export type SiteAbout = z.infer<typeof siteAboutSchema>;
export type SiteNavigation = z.infer<typeof siteNavigationSchema>;
export type SiteLayout = z.infer<typeof siteLayoutSchema>;
export type ProjectVisualAssetConfig = z.infer<typeof projectVisualAssetSchema>;
export type AiBranding = z.infer<typeof aiBrandingSchema>;
export type FilePolicies = z.infer<typeof filePoliciesSchema>;
export type OpsMetrics = z.infer<typeof opsMetricsSchema>;

export interface PublicProjectVisualAsset {
  key: ProjectShowcaseKey;
  coverUrl: string | null;
  screenshotUrls: string[];
}

export interface PublicSiteConfig {
  siteName: string;
  siteDescription: string;
  keywords: string;
  logoUrl: string | null;
  logoMode: 'text' | 'image';
  logoText: string;
  faviconUrl: string | null;
  faviconMode: 'text' | 'image';
  faviconText: string;
  loadingStyle: 'spinner' | 'square' | 'image' | 'svg' | 'video';
  loadingTitle: string;
  loadingSubtitle: string;
  loadingMotion: 'none' | 'spin' | 'pulse' | 'float';
  loadingSizeMode: 'default' | 'custom';
  /** 默认宽高和自定义宽高都不能超过这组限制。 */
  loadingMaxWidth: number;
  loadingMaxHeight: number;
  loadingWidth: number;
  loadingHeight: number;
  loadingVideoUrl: string | null;
  /** 为 false 时加载页不画标题下的三道骨架。 */
  loadingShowSkeleton: boolean;
  /** 为 false 时进度只显示百分比，不带秒数。 */
  loadingShowElapsed: boolean;
  /** 图片模式的签名地址。文件 ID 不进公开响应。 */
  loadingImageUrl: string | null;
  /** 已去掉脚本的 SVG 标记。其它样式时为空字符串。 */
  loadingSvg: string;
  avatarFileId: string | null;
  ownerName: string;
  githubUrl: string;
  email: string;
  theme: SiteTheme;
  homepage: SiteHomepage;
  about: SiteAbout;
  navigation: SiteNavigation;
  layout: Omit<SiteLayout, 'projectVisualAssets'>;
  projectVisualAssets: PublicProjectVisualAsset[];
  aiEnabled: boolean;
}

export interface AssembledPublicSiteConfig extends Omit<PublicSiteConfig, 'projectVisualAssets'> {
  /** 只给签名使用，公开响应发出前会去掉。 */
  logoFileId: string | null;
  faviconFileId: string | null;
  loadingFileId: string | null;
  loadingVideoFileId: string | null;
  projectVisualAssetFiles: ProjectVisualAssetConfig[];
}

export const DEFAULT_SYSTEM_CONFIGS: Record<SystemConfigGroup, unknown> = {
  'site.general': {
    siteName: 'Personal Hub',
    siteDescription: '个人知识中台 + 内容管理平台 + AI 工具箱',
    keywords: '',
    logoFileId: null,
    faviconFileId: null,
    loadingStyle: 'spinner',
    loadingTitle: '正在打开 Personal Hub',
    loadingSubtitle: '首次打开会先拉取页面资源，请稍候',
    loadingShowSkeleton: true,
    loadingShowElapsed: true,
    loadingMotion: 'none',
    loadingSizeMode: 'default',
    loadingMaxWidth: 320,
    loadingMaxHeight: 320,
    loadingWidth: 72,
    loadingHeight: 72,
    loadingFileId: null,
    loadingVideoFileId: null,
    loadingSvg: '',
    avatarFileId: null,
    ownerName: '',
    githubUrl: '',
    email: '',
  } satisfies SiteGeneral,
  'site.theme': {
    colorPrimary: '#722ed1',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    colorSecondary: '#14B8A6',
    colorAccent: '#F97316',
    borderRadius: 8,
    fontFamily: 'system',
    mode: 'dark',
    allowUserSwitch: true,
  } satisfies SiteTheme,
  'site.homepage': {
    hero: {
      title: '把知识沉淀成可复用的资产',
      subtitle: '内容阅读 · 内容生产 · AI 工具，一站完成',
      primaryAction: { label: '浏览内容', target: '/content' },
      secondaryAction: { label: '关于我', target: '/about' },
    },
    modules: [
      { key: 'hero', title: 'Hero 区块', visible: true, sort: 1 },
      { key: 'capabilities', title: '平台能力', visible: true, sort: 2 },
      { key: 'featured', title: '精选内容与分类入口', visible: true, sort: 3 },
      { key: 'aiTools', title: 'AI 工具推荐', visible: true, sort: 4 },
      { key: 'showcase', title: '作品矩阵预告', visible: true, sort: 5 },
      { key: 'techStack', title: '技术栈展示', visible: true, sort: 6 },
      { key: 'performance', title: '性能数据', visible: true, sort: 7 },
    ],
    featuredContent: { contentIds: [] },
    aiTools: [
      { key: 'chat', title: 'AI 对话', description: '多轮对话与知识引用。', enabled: true },
      { key: 'text', title: '文本生成', description: '摘要、改写、翻译与扩写。', enabled: true },
      { key: 'image', title: '图片生成', description: '根据提示词生成图片草稿。', enabled: true },
      { key: 'video', title: '视频生成', description: '阶段 5 后续占位能力。', enabled: false },
    ],
    techStack: [
      { name: 'React', category: 'frontend' },
      { name: 'Umi Max', category: 'frontend' },
      { name: 'Ant Design', category: 'ui' },
      { name: 'Turborepo', category: 'engineering' },
      { name: 'TypeScript', category: 'language' },
      { name: 'NestJS', category: 'backend' },
      { name: 'Prisma', category: 'backend' },
      { name: 'PostgreSQL', category: 'database' },
      { name: 'Redis', category: 'cache' },
      { name: 'Nginx', category: 'deploy' },
    ],
  } satisfies SiteHomepage,
  'site.about': {
    title: '关于我',
    markdown: `# 关于我

一个正在搭建个人知识中台的开发者，把阅读、写作与 AI 工具沉淀到一个站点。

## 联系

- Email：oralemon@163.com
- GitHub：[orangejava/personal-hub](https://github.com/orangejava/personal-hub)`,
  } satisfies SiteAbout,
  'site.navigation': {
    publicPosition: 'top',
    publicSticky: true,
    publicBlur: true,
    publicShowLogo: true,
    publicShowAuthEntry: true,
    workspaceCollapsible: true,
    adminCollapsible: true,
  } satisfies SiteNavigation,
  'site.layout': {
    homeHeroStyle: 'split',
    contentCardStyle: 'cover',
    contentReaderWidth: 'comfortable',
    showBreadcrumb: true,
    projectsTitle: '项目',
    projectsIntro: '',
    projectVisualAssets: PROJECT_SHOWCASE_KEYS.map((key) => ({
      key,
      coverFileId: null,
      screenshotFileIds: [],
    })),
  } satisfies SiteLayout,
  'ai.branding': {
    aiEnabled: true,
    brandName: 'Personal Hub AI',
    logoText: 'PH',
  } satisfies AiBranding,
  'file.policies': {} satisfies FilePolicies,
  'ops.metrics': {
    sampleRate: 0.2,
    hourRetentionDays: 90,
  } satisfies OpsMetrics,
};

export function isSystemConfigGroup(value: string): value is SystemConfigGroup {
  return (SYSTEM_CONFIG_GROUPS as readonly string[]).includes(value);
}

interface StoredHomepageModule {
  key: string;
  title: string;
  visible: boolean;
  sort: number;
}

function readStoredHomepageModules(raw: unknown): StoredHomepageModule[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    if (typeof row.key !== 'string' || row.key.length === 0) return [];
    return [
      {
        key: row.key,
        title: typeof row.title === 'string' ? row.title : row.key,
        visible: typeof row.visible === 'boolean' ? row.visible : true,
        sort: typeof row.sort === 'number' ? row.sort : 0,
      },
    ];
  });
}

/**
 * 线上旧的 site.homepage.modules 只有 4 个 key。对象浅合并会整表覆盖，新区块会丢。
 * 默认列表做底，同 key 只覆盖 visible / sort。缺 key 时插到默认顺序里前一个已出现区块后面，
 * 这样旧数据仍能看到新区块，后台已经保存过的完整排序不会被重排。
 */
export function mergeHomepageModules(
  defaults: SiteHomepage['modules'],
  rawModules: unknown,
): SiteHomepage['modules'] {
  const stored = readStoredHomepageModules(rawModules);
  const defaultsByKey = new Map(defaults.map((item) => [item.key, item]));
  const storedByKey = new Map(stored.map((item) => [item.key, item]));
  const hasEveryDefault = defaults.every((item) => storedByKey.has(item.key));

  if (hasEveryDefault) {
    const known = defaults.map((item) => {
      const saved = storedByKey.get(item.key);
      return {
        key: item.key,
        title: item.title,
        visible: saved?.visible ?? item.visible,
        sort: Math.round(saved?.sort ?? item.sort),
      };
    });
    const extras = stored
      .filter((item) => !defaultsByKey.has(item.key))
      .map((item) => ({
        key: item.key,
        title: item.title,
        visible: item.visible,
        sort: Math.round(item.sort),
      }));
    return [...known, ...extras];
  }

  const ordered = stored
    .filter((item) => defaultsByKey.has(item.key))
    .sort((left, right) => left.sort - right.sort)
    .map((item) => {
      const base = defaultsByKey.get(item.key);
      return {
        key: item.key,
        title: base?.title ?? item.title,
        visible: item.visible,
        sort: item.sort,
      };
    });

  defaults.forEach((item, index) => {
    if (storedByKey.has(item.key)) return;
    const previous = [...defaults.slice(0, index)]
      .reverse()
      .find((candidate) => ordered.some((row) => row.key === candidate.key));
    const insertAt = previous ? ordered.findIndex((row) => row.key === previous.key) + 1 : 0;
    ordered.splice(insertAt, 0, { ...item });
  });

  return ordered.map((item, index) => ({ ...item, sort: index + 1 }));
}

/**
 * 已保存的技术栈整表覆盖默认值。新加的默认项按名字补到末尾，已有顺序不动。
 * 后台明确存了空数组时保持为空，不把默认名单填回去。
 */
export function mergeTechStack(
  defaults: SiteHomepage['techStack'],
  raw: unknown,
): SiteHomepage['techStack'] {
  if (!Array.isArray(raw)) return defaults;
  const stored = raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as { name?: unknown; category?: unknown; icon?: unknown };
    if (typeof row.name !== 'string' || typeof row.category !== 'string') return [];
    return [
      {
        name: row.name,
        category: row.category,
        ...(typeof row.icon === 'string' ? { icon: row.icon } : {}),
      },
    ];
  });
  if (stored.length === 0) return [];
  const names = new Set(stored.map((item) => item.name));
  return [...stored, ...defaults.filter((item) => !names.has(item.name))];
}

/**
 * 用默认值补齐后做 DTO 校验，避免库里缺字段或半套 JSON 让公开接口 500。
 */
export function parseGroupValue(group: SystemConfigGroup, raw: unknown) {
  const defaults = DEFAULT_SYSTEM_CONFIGS[group];
  const rawObject =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : undefined;
  // 始终拷贝，避免首页模块合并写回默认配置对象。
  const merged = { ...(defaults as object), ...(rawObject ?? {}) };
  if (group === 'site.homepage') {
    const homepage = merged as SiteHomepage;
    const rawModules = rawObject ? rawObject.modules : homepage.modules;
    homepage.modules = mergeHomepageModules((defaults as SiteHomepage).modules, rawModules);
    if (rawObject && 'techStack' in rawObject) {
      homepage.techStack = mergeTechStack(
        (defaults as SiteHomepage).techStack,
        rawObject.techStack,
      );
    }
  }
  return GROUP_SCHEMAS[group].parse(merged);
}

function clampLoadingLimit(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) return 320;
  return Math.min(480, Math.max(48, value));
}

function clampLoadingSide(value: number | undefined, limit: number): number {
  const side = typeof value === 'number' && Number.isInteger(value) ? value : 72;
  return Math.min(limit, Math.max(48, side));
}

/** 旧配置只存了一个边长。72 是当时的默认值，不当成用户亲手设的自定义尺寸。 */
function resolveLoadingFrame(general: SiteGeneral): {
  loadingSizeMode: 'default' | 'custom';
  loadingMaxWidth: number;
  loadingMaxHeight: number;
  loadingWidth: number;
  loadingHeight: number;
} {
  const loadingMaxWidth = clampLoadingLimit(general.loadingMaxWidth);
  const loadingMaxHeight = clampLoadingLimit(general.loadingMaxHeight);
  const width = clampLoadingSide(general.loadingWidth ?? general.loadingSize, loadingMaxWidth);
  const height = clampLoadingSide(general.loadingHeight ?? general.loadingSize, loadingMaxHeight);
  if (general.loadingSizeMode === 'custom' || general.loadingSizeMode === 'default') {
    return {
      loadingSizeMode: general.loadingSizeMode,
      loadingMaxWidth,
      loadingMaxHeight,
      loadingWidth: width,
      loadingHeight: height,
    };
  }
  if (typeof general.loadingSize === 'number' && general.loadingSize !== 72) {
    const sideWidth = clampLoadingSide(general.loadingSize, loadingMaxWidth);
    const sideHeight = clampLoadingSide(general.loadingSize, loadingMaxHeight);
    return {
      loadingSizeMode: 'custom',
      loadingMaxWidth,
      loadingMaxHeight,
      loadingWidth: sideWidth,
      loadingHeight: sideHeight,
    };
  }
  return {
    loadingSizeMode: 'default',
    loadingMaxWidth,
    loadingMaxHeight,
    loadingWidth: width,
    loadingHeight: height,
  };
}

/**
 * 只拼装允许公开的字段。调用方必须传入已按组取出的 value，不要把整张 system_configs 表丢进来。
 */
export function assemblePublicSiteConfig(
  rows: ReadonlyMap<SystemConfigGroup, unknown>,
): AssembledPublicSiteConfig {
  const general = parseGroupValue('site.general', rows.get('site.general')) as SiteGeneral;
  const theme = parseGroupValue('site.theme', rows.get('site.theme')) as SiteTheme;
  const homepage = parseGroupValue('site.homepage', rows.get('site.homepage')) as SiteHomepage;
  const about = parseGroupValue('site.about', rows.get('site.about')) as SiteAbout;
  const navigation = parseGroupValue(
    'site.navigation',
    rows.get('site.navigation'),
  ) as SiteNavigation;
  const layout = parseGroupValue('site.layout', rows.get('site.layout')) as SiteLayout;
  const branding = parseGroupValue('ai.branding', rows.get('ai.branding')) as AiBranding;

  const { projectVisualAssets, ...publicLayout } = layout;
  return {
    siteName: general.siteName,
    siteDescription: general.siteDescription,
    keywords: general.keywords,
    logoFileId: general.logoFileId,
    logoUrl: null,
    logoMode: resolveBrandMode(general.logoMode, general.logoFileId),
    logoText: general.logoText ?? '',
    faviconFileId: general.faviconFileId,
    faviconUrl: null,
    faviconMode: resolveBrandMode(general.faviconMode, general.faviconFileId),
    faviconText: general.faviconText ?? '',
    loadingStyle: general.loadingStyle ?? 'spinner',
    loadingTitle: general.loadingTitle ?? '正在打开 Personal Hub',
    loadingSubtitle: general.loadingSubtitle ?? '首次打开会先拉取页面资源，请稍候',
    loadingShowSkeleton: general.loadingShowSkeleton !== false,
    loadingShowElapsed: general.loadingShowElapsed !== false,
    loadingMotion: general.loadingMotion ?? 'none',
    ...resolveLoadingFrame(general),
    loadingFileId: general.loadingFileId,
    loadingVideoFileId: general.loadingVideoFileId,
    loadingVideoUrl: null,
    loadingImageUrl: null,
    loadingSvg: general.loadingStyle === 'svg' ? (general.loadingSvg ?? '') : '',
    avatarFileId: general.avatarFileId,
    ownerName: general.ownerName,
    githubUrl: general.githubUrl,
    email: general.email,
    theme,
    homepage,
    about,
    navigation,
    layout: publicLayout,
    projectVisualAssetFiles: projectVisualAssets,
    aiEnabled: branding.aiEnabled,
  };
}
