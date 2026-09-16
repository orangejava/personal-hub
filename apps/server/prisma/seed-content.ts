import {
  ContentStatus,
  ContentType,
  ContentVisibility,
  PrismaClient,
  RoleCode,
} from '@prisma/client';
import { deriveMarkdown } from '../src/modules/content/content-markdown';

export const DEFAULT_CATEGORIES = [
  { slug: 'frontend', name: '前端', sortOrder: 10 },
  { slug: 'backend', name: '后端', sortOrder: 20 },
  { slug: 'engineering', name: '工程', sortOrder: 30 },
  { slug: 'ai', name: 'AI', sortOrder: 40 },
] as const;

export async function seedContentTaxonomy(client: PrismaClient): Promise<void> {
  for (const item of DEFAULT_CATEGORIES) {
    await client.category.upsert({
      where: { slug: item.slug },
      create: { name: item.name, slug: item.slug, sortOrder: item.sortOrder },
      update: { name: item.name, sortOrder: item.sortOrder, enabled: true },
    });
  }
}

/**
 * 给首页/内容中心准备几篇可公开阅读的样例。依赖已有 editor 或 super_admin 账号。
 */
export async function seedSampleContents(client: PrismaClient): Promise<void> {
  const publicAppOrigin = (process.env.PUBLIC_APP_ORIGIN ?? 'http://localhost:8000').replace(/\/$/, '');
  const author =
    (await client.user.findFirst({
      where: { role: { code: RoleCode.EDITOR }, status: 'ACTIVE' },
      select: { id: true },
    })) ??
    (await client.user.findFirst({
      where: { role: { code: RoleCode.SUPER_ADMIN }, status: 'ACTIVE' },
      select: { id: true },
    }));
  if (author === null) {
    return;
  }

  const frontend = await client.category.findUnique({ where: { slug: 'frontend' } });
  const engineering = await client.category.findUnique({ where: { slug: 'engineering' } });
  if (frontend === null || engineering === null) {
    return;
  }

  const samples: Array<{
    title: string;
    summary: string;
    markdown: string;
    visibility: ContentVisibility;
    featured: boolean;
    categoryId: string;
    type: ContentType;
    extra?: object;
    externalUrl?: string;
  }> = [
    {
      title: '从 React 到 Nest 的内容中心',
      summary: '公开 Markdown 样例，用于无 mock 时验证内容列表和详情。',
      markdown:
        '# 从 React 到 Nest 的内容中心\n\n这是本地 seed 的公开文章。\n\n## 为什么先做公开读\n\n可见性必须在 SQL 层过滤。\n\n## 下一步\n\n工作区写作与文件模块。\n',
      visibility: ContentVisibility.PUBLIC,
      featured: true,
      categoryId: frontend.id,
      type: ContentType.MARKDOWN,
    },
    {
      title: '工程约定备忘',
      summary: '第二篇公开 Markdown，用于列表分页与分类筛选。',
      markdown: '# 工程约定备忘\n\n幂等键、信封和解包不要各写一套。\n',
      visibility: ContentVisibility.PUBLIC,
      featured: false,
      categoryId: engineering.id,
      type: ContentType.MARKDOWN,
    },
    {
      title: 'Personal Hub',
      summary: '本项目公开项目卡片。',
      markdown: '',
      visibility: ContentVisibility.PUBLIC,
      featured: false,
      categoryId: engineering.id,
      type: ContentType.PROJECT,
      externalUrl: 'https://github.com/example/personal-hub',
      extra: {
        githubUrl: 'https://github.com/example/personal-hub',
        previewUrl: publicAppOrigin,
        techStack: ['React', 'NestJS', 'PostgreSQL'],
      },
    },
    {
      title: '登录后可读的笔记',
      summary: '访客在列表看到锁定卡片，详情需要登录。',
      markdown: '# 登录后可读的笔记\n\n只有登录用户能看到这段正文。\n',
      visibility: ContentVisibility.LOGIN,
      featured: false,
      categoryId: frontend.id,
      type: ContentType.MARKDOWN,
    },
  ];

  for (const sample of samples) {
    const existing = await client.content.findFirst({
      where: { authorId: author.id, title: sample.title },
      select: { id: true },
    });
    if (existing !== null) {
      continue;
    }
    const derived = sample.markdown ? deriveMarkdown(sample.markdown) : null;
    const created = await client.content.create({
      data: {
        type: sample.type,
        title: sample.title,
        summary: sample.summary,
        authorId: author.id,
        categoryId: sample.categoryId,
        status: ContentStatus.PUBLISHED,
        visibility: sample.visibility,
        isFeatured: sample.featured,
        publishedAt: new Date(),
        externalUrl: sample.externalUrl,
        extra: sample.extra,
        wordCount: derived?.wordCount ?? 0,
        body: {
          create: {
            markdownSource: sample.markdown || null,
            renderedHtml: derived?.html,
            toc: derived?.toc as object[] | undefined,
          },
        },
      },
    });
    const text = `${sample.title} ${sample.summary} ${sample.markdown.slice(0, 5000)}`;
    await client.$executeRaw`
      UPDATE contents
      SET search_document = to_tsvector('simple', ${text})
      WHERE id = ${created.id}::uuid
    `;
  }
}
