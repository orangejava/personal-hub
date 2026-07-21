/**
 * 本地小册同步脚本
 *
 * 扫描 content-local/ 下的小册文件夹，生成
 * apps/react-web/mock/data/local-booklets.generated.ts
 *
 * 规则见 .agent/local-booklets.md
 * 白名单见同目录 sync-allowlist.json（避免一次载入全部 70+ 本）
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import fg from 'fast-glob';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(__filename, '../../..'); // apps/react-web
const REPO_ROOT = resolve(ROOT, '../..'); // 仓库根 personal-hub
const INPUT_DIRS = [
  join(REPO_ROOT, 'content-local/booklets'),
  join(REPO_ROOT, 'content-local'),
];
const OUTPUT = join(ROOT, 'mock/data/local-booklets.generated.ts');
/** 白名单配置：与脚本同目录，可进 Git */
const ALLOWLIST_PATH = join(dirname(__filename), 'sync-allowlist.json');

/** 非小册目录，扫描时跳过 */
const SKIP_DIR_NAMES = new Set([
  'booklets',
  'node_modules',
  '.git',
]);

interface AllowlistConfig {
  folders?: string[];
  description?: string;
}

/**
 * 读取同步白名单。
 * - folders 非空：只同步列出的文件夹名
 * - folders 为空或缺省：同步全部（不推荐，体积大）
 */
function loadAllowlist(): Set<string> | null {
  if (!existsSync(ALLOWLIST_PATH)) {
    console.warn(`[sync-booklets] 未找到白名单 ${ALLOWLIST_PATH}，将同步全部小册`);
    return null;
  }
  try {
    const raw = readFileSync(ALLOWLIST_PATH, 'utf-8');
    const cfg = JSON.parse(raw) as AllowlistConfig;
    const folders = (cfg.folders ?? []).map((f) => f.trim()).filter(Boolean);
    if (folders.length === 0) {
      console.warn('[sync-booklets] 白名单 folders 为空，将同步全部小册');
      return null;
    }
    console.log(`[sync-booklets] 白名单启用：${folders.length} 本`);
    return new Set(folders);
  } catch (e) {
    console.warn(
      `[sync-booklets] 白名单解析失败，将同步全部：${(e as Error).message}`,
    );
    return null;
  }
}

interface Meta {
  title?: string;
  author?: string;
  summary?: string;
  cover?: string;
  categorySlug?: string;
  tags?: string[];
}

interface ChapterOut {
  id: string;
  bookletId: string;
  order: number;
  title: string;
  body: string;
  toc: { level: number; text: string; anchor: string }[];
  empty?: boolean;
}

interface BookletOut {
  id: string;
  title: string;
  author: string;
  summary: string;
  cover?: string;
  categorySlug?: string;
  tags?: string[];
  chapterCount: number;
  source: 'local';
  syncedAt: string;
  warnings?: string[];
}

/** 稳定 ID：用路径 hash 避免文件名重复冲突 */
function stableId(p: string): string {
  return `loc-${createHash('md5').update(p).digest('hex').slice(0, 10)}`;
}

/** 从 Markdown 提取第一个 # 标题 */
function firstHeading(md: string): string | undefined {
  const m = md.match(/^#\s+(.+)$/m);
  return m?.[1].trim();
}

/** 去掉标题中的 Markdown 行内标记 */
function stripMarkdownInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

function slugifyHeading(text: string): string {
  return stripMarkdownInline(text)
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fff-]+/g, '')
    .toLowerCase();
}

/** 提取二级以上标题作为目录（与 MarkdownViewer heading id 一致） */
function extractToc(
  md: string,
): { level: number; text: string; anchor: string }[] {
  const toc: { level: number; text: string; anchor: string }[] = [];
  const re = /^(#{2,3})\s+(.+)$/gm;
  let m = re.exec(md);
  while (m) {
    const raw = m[2].trim();
    toc.push({
      level: m[1].length,
      text: stripMarkdownInline(raw),
      anchor: slugifyHeading(raw),
    });
    m = re.exec(md);
  }
  return toc;
}

function safeRead(p: string): string | null {
  try {
    return readFileSync(p, 'utf-8');
  } catch {
    return null;
  }
}

function main() {
  const syncedAt = new Date().toISOString();

  const existedInputDirs = INPUT_DIRS.filter((dir) => existsSync(dir));
  if (existedInputDirs.length === 0) {
    console.warn(
      `[sync-booklets] 输入目录不存在：${INPUT_DIRS.join('、')}，生成空数组。`,
    );
    mkdirSync(dirname(OUTPUT), { recursive: true });
    writeFileSync(
      OUTPUT,
      `// 由 sync:booklets 生成，请勿手动编辑\nimport type { Booklet, BookletChapter } from '@personal-hub/shared-types';\nexport const localBooklets: Booklet[] = [];\nexport const localBookletChapters: BookletChapter[] = [];\n`,
    );
    return;
  }

  const allowlist = loadAllowlist();

  // 每个小册 = content-local/booklets 或 content-local 下的一个子目录
  let subDirs = Array.from(
    new Set(
      existedInputDirs
        .flatMap((dir) => fg.sync([`${dir}/*/`], { onlyDirectories: true }))
        .map((d) => resolve(d))
        .filter((d) => !SKIP_DIR_NAMES.has(basename(d))),
    ),
  );

  if (allowlist) {
    const before = subDirs.length;
    subDirs = subDirs.filter((d) => allowlist.has(basename(d)));
    const missing = [...allowlist].filter(
      (name) => !subDirs.some((d) => basename(d) === name),
    );
    console.log(
      `[sync-booklets] 白名单过滤：${before} → ${subDirs.length} 本` +
        (missing.length ? `；未找到目录：${missing.join('、')}` : ''),
    );
  }

  const booklets: BookletOut[] = [];
  const chapters: ChapterOut[] = [];

  for (const dir of subDirs) {
    const warnings: string[] = [];
    const bookletId = stableId(dir);

    // meta.json
    let meta: Meta = {};
    const metaPath = join(dir, 'meta.json');
    if (existsSync(metaPath)) {
      const raw = safeRead(metaPath);
      if (raw) {
        try {
          meta = JSON.parse(raw);
        } catch (e) {
          warnings.push(`meta.json JSON 解析失败：${(e as Error).message}`);
        }
      }
    }

    // md 文件，按数字前缀排序
    const mdFiles = fg
      .sync([`${dir}/*.md`])
      .sort((a, b) =>
        basename(a).localeCompare(basename(b), 'en', { numeric: true }),
      );
    if (mdFiles.length === 0) {
      warnings.push('未找到任何 .md 文件，跳过该小册');
      console.warn(`[sync-booklets] ${dir} 无 .md，跳过`);
      continue;
    }

    const bookletChapters: ChapterOut[] = mdFiles.map((file, idx) => {
      const body = safeRead(file) ?? '';
      const title =
        firstHeading(body) ?? basename(file, '.md').replace(/^\d+[-_]?/, '');
      const chapterId = stableId(file);
      return {
        id: chapterId,
        bookletId,
        order: idx + 1,
        title,
        body,
        toc: extractToc(body),
        empty: body.trim().length === 0,
      };
    });

    booklets.push({
      id: bookletId,
      title: meta.title ?? basename(dir),
      author: meta.author ?? '本地文档',
      summary: meta.summary ?? '',
      cover: meta.cover,
      categorySlug: meta.categorySlug,
      tags: meta.tags,
      chapterCount: bookletChapters.length,
      source: 'local',
      syncedAt,
      warnings: warnings.length ? warnings : undefined,
    });
    chapters.push(...bookletChapters);
  }

  mkdirSync(dirname(OUTPUT), { recursive: true });
  const payload = `// 由 sync:booklets 生成，请勿手动编辑
import type { Booklet, BookletChapter } from '@personal-hub/shared-types';

export const localBooklets: Booklet[] = ${JSON.stringify(booklets, null, 2)};

export const localBookletChapters: BookletChapter[] = ${JSON.stringify(chapters, null, 2)};
`;
  writeFileSync(OUTPUT, payload);
  console.log(
    `[sync-booklets] 同步完成：${booklets.length} 本小册，${chapters.length} 个章节 → ${OUTPUT}`,
  );
}

main();
