import type { ProjectShowcaseKey } from '@personal-hub/shared-types';

export interface ProjectShowcaseItem {
  key: ProjectShowcaseKey;
  name: string;
  status: '已上线' | '规划中';
  /** 首页预告行需要年份。作品表没有单独年份，与当前公网上线年份对齐。 */
  year: string;
  summary: string;
  stack: string[];
  highlights: string[];
  /** 没有外链的端保持 undefined。规划中的端也不能补一个空链接。 */
  href?: string;
  /**
   * 性能面板在另一条分支，合并后打开 /status。
   * 按钮先留着，合并前点开会进到还没有的页面。
   */
  performanceHref?: string;
}

/**
 * 一条项目进度。现在是静态文案。
 * 以后接 GitHub Releases：用发布名填 title，正文拆成 changes，发布日填 publishedAt（YYYY-MM-DD）。
 * 页面不要直接请求 GitHub。由构建步骤或服务端同步成这一份列表后再替换 PROJECT_PROGRESS。
 */
export interface ProjectProgressEntry {
  key: string;
  title: string;
  status: '已发布' | '进行中';
  /** 发布日，YYYY-MM-DD。还没有日志日期时不填，页面就不显示。 */
  publishedAt?: string;
  changes: string[];
}

/**
 * 作品矩阵的文字。内容模型没有这些结构化字段，先写在代码里。
 * 文案对齐首页滚动改版 PRD §5.2，不要在页面里另写一套。
 */
export const PROJECT_SHOWCASE: ProjectShowcaseItem[] = [
  {
    key: 'user-web',
    name: '用户端 Web',
    status: '已上线',
    year: '2026',
    summary: '公开前台、工作区和 AI 工具',
    stack: ['React', 'Umi', 'Ant Design'],
    highlights: ['内容阅读', 'AI 对话', '登录后工作区'],
    href: '/',
    performanceHref: '/status',
  },
  {
    key: 'admin-web',
    name: '管理端 Web',
    status: '已上线',
    year: '2026',
    summary: '菜单、角色、权限、内容和配置',
    stack: ['React', 'Umi', 'Ant Design Pro'],
    highlights: ['内容审核', '系统配置', 'AI 目录'],
  },
  {
    key: 'server',
    name: 'Nest 服务端',
    status: '已上线',
    year: '2026',
    summary: 'Canonical API、鉴权、内容、文件和 AI',
    stack: ['NestJS', 'Prisma', 'PostgreSQL', 'Redis'],
    highlights: ['会话与权限', '内容与文件', '额度账本'],
  },
  {
    key: 'flutter',
    name: 'Flutter App',
    status: '规划中',
    year: '2026',
    summary: '移动端阅读和 AI 对话，不含后台',
    stack: ['Flutter', 'Riverpod', 'Dio'],
    highlights: ['与 Web 共用账号', '章节与 Markdown', '对话与文本'],
  },
  {
    key: 'desktop',
    name: '桌面端',
    status: '规划中',
    year: '2026',
    summary: '复用用户端界面，技术方向为 Tauri 2',
    stack: ['Tauri 2', 'React'],
    highlights: ['先做 Windows 和 macOS', '托盘与更新后置', 'Linux 最后'],
  },
];

/** 新的在前，和 GitHub Releases 的阅读顺序一致。接入前不要改成在线拉取。 */
export const PROJECT_PROGRESS: ProjectProgressEntry[] = [
  {
    key: 'post-launch',
    title: '上线后优化',
    status: '进行中',
    changes: ['首页和项目页改成作品展示', '性能面板、主题配置还在各自的分支上'],
  },
  {
    key: 'launch',
    title: '首版公网上线',
    status: '已发布',
    changes: [
      '公开前台、管理端和服务端接到同一套接口',
      '已上线的端共用账号、内容和文件',
    ],
  },
  {
    key: 'nest',
    title: 'Nest M0–M6',
    status: '已发布',
    changes: [
      '鉴权、内容、文件和 AI 改由 Nest 提供',
      '数据落到 PostgreSQL，缓存用 Redis',
    ],
  },
  {
    key: 'react-first',
    title: 'React-first 阶段 0–5',
    status: '已发布',
    changes: [
      '前台、后台和内容阅读先用 React 跑通',
      'AI 工具页面在这个阶段接上',
    ],
  },
];

/** 没上传或加载失败时都回到随代码提交的占位图，不弹错误。 */
export function showcasePlaceholder(key: ProjectShowcaseKey) {
  return `/images/showcase/${key}.svg`;
}
