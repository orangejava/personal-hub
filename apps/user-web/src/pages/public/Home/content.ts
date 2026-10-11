import type {
  PublicHomepageConfig,
  PublicHomepageModule,
} from '@/services/system';

export const DEFAULT_AI_TOOLS: PublicHomepageConfig['aiTools'] = [
  {
    key: 'chat',
    title: 'AI 对话',
    description: '多轮对话与知识引用。',
    enabled: true,
  },
  {
    key: 'text',
    title: '文本生成',
    description: '摘要、改写、翻译与扩写。',
    enabled: true,
  },
  {
    key: 'image',
    title: '图片生成',
    description: '根据提示词生成图片草稿。',
    enabled: true,
  },
  {
    key: 'video',
    title: '视频生成',
    description: '阶段 5 后续占位能力。',
    enabled: false,
  },
];

export const DEFAULT_TECH_STACK: PublicHomepageConfig['techStack'] = [
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
];

export const DEFAULT_HOME_MODULES: PublicHomepageModule[] = [
  { key: 'hero', title: 'Hero 区块', visible: true, sort: 1 },
  { key: 'capabilities', title: '平台能力', visible: true, sort: 2 },
  { key: 'featured', title: '精选内容与分类入口', visible: true, sort: 3 },
  { key: 'aiTools', title: 'AI 工具推荐', visible: true, sort: 4 },
  { key: 'showcase', title: '作品矩阵预告', visible: true, sort: 5 },
  { key: 'techStack', title: '技术栈展示', visible: true, sort: 6 },
  { key: 'performance', title: '性能数据', visible: true, sort: 7 },
];

/** 内容中心没有精选时，用来占住这块版面。接口失败时不显示示例。不是另一套内容接口。 */
export const FEATURED_SAMPLES = [
  {
    key: 'reading',
    category: '笔记',
    title: '把阅读收成可以再找到的文章',
    description: '章节、摘录和自己的批注放在同一篇里，之后按分类接着写。',
    cover: '/images/home/featured-reading.svg',
  },
  {
    key: 'ai',
    category: 'AI',
    title: '对话时引用站里已经写过的内容',
    description: '不用把文章再贴一遍，对话直接指向内容中心里的那一篇。',
    cover: '/images/home/featured-ai.svg',
  },
  {
    key: 'structure',
    category: '项目',
    title: '这个站点的前台、后台和服务怎么接',
    description: '公开页、管理台和 Nest 共用一套账号、内容和文件。',
    cover: '/images/home/featured-structure.svg',
  },
] as const;

export const CAPABILITIES = [
  {
    key: 'content',
    title: '内容',
    description: '阅读、写作和分类放在一起，把知识沉淀成可以复用的资产。',
  },
  {
    key: 'ai',
    title: 'AI',
    description: '对话、文本和图片生成接在同一套账号上，用来整理和接着写。',
  },
  {
    key: 'projects',
    title: '项目',
    description: '看这个平台由哪些端组成，以及哪些已经上线、哪些还在规划。',
  },
] as const;

const TECH_CATEGORY_LABELS: Record<string, string> = {
  frontend: '前端',
  ui: '界面',
  engineering: '工程',
  language: '语言',
  backend: '服务端',
  database: '数据库',
  cache: '缓存',
  deploy: '部署',
};

export function techCategoryLabel(category: string) {
  return TECH_CATEGORY_LABELS[category] ?? category;
}

/** 后台 visible / sort 决定首页顺序。没拉到配置时用代码里的默认列表。 */
export function visibleHomeModules(
  modules: PublicHomepageModule[] | undefined,
) {
  const source = modules?.length ? modules : DEFAULT_HOME_MODULES;
  return [...source]
    .filter((item) => item.visible)
    .sort((left, right) => left.sort - right.sort);
}

export function readHeroActions(homepage: PublicHomepageConfig | undefined) {
  return {
    title: homepage?.hero.title?.trim() || '把知识沉淀成可复用的资产',
    subtitle:
      homepage?.hero.subtitle?.trim() ||
      '内容阅读 · 内容生产 · AI 工具，一站完成',
    primary: homepage?.hero.primaryAction ?? {
      label: '浏览内容',
      target: '/content',
    },
    secondary: homepage?.hero.secondaryAction ?? {
      label: '关于我',
      target: '/about',
    },
  };
}

export function groupTechStack(items: PublicHomepageConfig['techStack']) {
  const groups = new Map<string, PublicHomepageConfig['techStack']>();
  for (const item of items) {
    const list = groups.get(item.category) ?? [];
    list.push(item);
    groups.set(item.category, list);
  }
  return [...groups.entries()];
}

/** AI 工具 key 对应已经存在的工具页。未知 key 不生成链接。 */
export function aiToolPath(key: string) {
  const paths: Record<string, string> = {
    chat: '/ai/chat',
    text: '/ai/text',
    image: '/ai/image',
    video: '/ai/video',
  };
  return paths[key];
}
