import { createWriteStream } from 'node:fs';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { HttpStatus } from '@nestjs/common';
import yauzl, { type Entry, type ZipFile } from 'yauzl';
import { DomainHttpException } from '../../common/errors/domain-http.exception';

export const DEFAULT_MAX_UNCOMPRESSED_BYTES = 500 * 1024 * 1024;
const MAX_CHAPTERS = 1000;
/** 除章节外也限制目录/资源条目数，避免先缓存海量 ZIP 中央目录。 */
export const MAX_ZIP_ENTRIES = 10_000;
/** Entry 会保留文件名、扩展字段和注释的原始缓冲区；总量单独设限，避免大 ZIP 撑满堆。 */
export const MAX_ZIP_METADATA_BYTES = 8 * 1024 * 1024;
const MAX_WARNINGS = 100;
const MAX_CHAPTER_BYTES = 2 * 1024 * 1024;
/** 所有章节正文在解析结果中会同时驻留内存，因此设独立于上传策略的总量硬上限。 */
export const MAX_TOTAL_MARKDOWN_BYTES = 64 * 1024 * 1024;
export const MAX_BOOKLET_COMPRESSION_RATIO = 100;

export interface ParsedChapter {
  title: string;
  fileName: string;
  markdown: string;
  order: number;
}

export interface ParsedBookletZip {
  title?: string;
  summary?: string;
  categorySlug?: string;
  tags?: string[];
  warnings: string[];
  chapters: ParsedChapter[];
}

/**
 * 把对象流落到临时文件，避免把整包 ZIP 留在 Node 堆里。
 */
export async function writeAsyncIterableToFile(
  stream: AsyncIterable<Uint8Array>,
  filePath: string,
): Promise<number> {
  const nodeStream = Readable.from(stream);
  await pipeline(nodeStream, createWriteStream(filePath));
  return (await stat(filePath)).size;
}

/**
 * 测试与小缓冲入口：先落到磁盘再按文件解析，与 worker 路径一致。
 */
export async function parseBookletZip(
  buffer: Buffer,
  fallbackTitle: string,
  maxUncompressedBytes = DEFAULT_MAX_UNCOMPRESSED_BYTES,
  maxMarkdownBytes = MAX_TOTAL_MARKDOWN_BYTES,
): Promise<ParsedBookletZip> {
  const dir = await mkdtemp(join(tmpdir(), 'booklet-zip-'));
  const filePath = join(dir, 'source.zip');
  try {
    await writeFile(filePath, buffer);
    return await parseBookletZipFile(
      filePath,
      fallbackTitle,
      buffer.length,
      maxUncompressedBytes,
      maxMarkdownBytes,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * 从磁盘 ZIP 按条目流式读取章节。压缩包本身不进堆，章节逐个解压。
 */
export async function parseBookletZipFile(
  filePath: string,
  fallbackTitle: string,
  compressedSize?: number,
  maxUncompressedBytes = DEFAULT_MAX_UNCOMPRESSED_BYTES,
  maxMarkdownBytes = MAX_TOTAL_MARKDOWN_BYTES,
): Promise<ParsedBookletZip> {
  const zipSize = compressedSize ?? (await stat(filePath)).size;
  const zip = await openZipFile(filePath);
  try {
    const entries = await readAllEntries(zip);
    // yauzl 对未标记 UTF-8 的 ZIP 默认按 CP437 解码；中文 Windows/macOS 压缩包常用 GBK。
    const entryNames = new Map(entries.map((entry) => [entry, decodeZipEntryName(entry)]));
    const names = entries.map((entry) => normalizeZipPath(entryNames.get(entry)!));
    if (names.some((name) => name.includes('..') || name.startsWith('/') || name.includes('\\'))) {
      throw new DomainHttpException(HttpStatus.UNPROCESSABLE_ENTITY, 'BOOKLET_IMPORT_FAILED', 'ZIP 含非法路径');
    }

    const logicalRoot = detectRoot(names);
    const warnings: string[] = [];
    let uncompressed = 0;
    let markdownBytes = 0;
    const chapters: ParsedChapter[] = [];
    let meta: Record<string, unknown> = {};

    for (const entry of entries) {
      const entryName = entryNames.get(entry)!;
      if (isDirectory(entryName)) {
        continue;
      }
      const relative = stripRoot(normalizeZipPath(entryName), logicalRoot);
      if (relative.startsWith('__MACOSX/')) {
        continue;
      }
      const size = entry.uncompressedSize;
      uncompressed += size;
      if (uncompressed > maxUncompressedBytes) {
        throw new DomainHttpException(HttpStatus.UNPROCESSABLE_ENTITY, 'BOOKLET_IMPORT_FAILED', '解压后体积超过限制');
      }
      if (zipSize > 0 && uncompressed / zipSize > MAX_BOOKLET_COMPRESSION_RATIO) {
        throw new DomainHttpException(HttpStatus.UNPROCESSABLE_ENTITY, 'BOOKLET_IMPORT_FAILED', '压缩比异常，已拒绝');
      }
      if (relative === 'meta.json' || relative.endsWith('/meta.json')) {
        const raw = await readEntryString(zip, entry, MAX_CHAPTER_BYTES);
        try {
          meta = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          pushWarning(warnings, 'meta.json 无法解析，已忽略');
        }
        continue;
      }
      if (!relative.toLowerCase().endsWith('.md')) {
        pushWarning(warnings, `已忽略非章节文件：${relative}`);
        continue;
      }
      // 数量检查必须发生在正文解压前，避免超限章节先被读入堆后才拒绝。
      if (chapters.length >= MAX_CHAPTERS) {
        throw new DomainHttpException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'BOOKLET_IMPORT_FAILED',
          '章节数量超过限制',
        );
      }
      if (size > MAX_CHAPTER_BYTES) {
        throw new DomainHttpException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'BOOKLET_IMPORT_FAILED',
          `章节过大：${relative}`,
        );
      }
      if (markdownBytes + size > maxMarkdownBytes) {
        throw new DomainHttpException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'BOOKLET_IMPORT_FAILED',
          'Markdown 正文总量超过限制',
        );
      }
      const markdown = await readEntryString(zip, entry, MAX_CHAPTER_BYTES, (chunkBytes) => {
        if (markdownBytes + chunkBytes > maxMarkdownBytes) {
          throw new DomainHttpException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'BOOKLET_IMPORT_FAILED',
            'Markdown 正文总量超过限制',
          );
        }
        markdownBytes += chunkBytes;
      });
      chapters.push({
        fileName: relative,
        title: headingOrFileName(markdown, relative),
        markdown,
        order: 0,
      });
    }

    if (chapters.length === 0) {
        throw new DomainHttpException(HttpStatus.UNPROCESSABLE_ENTITY, 'BOOKLET_IMPORT_FAILED', 'ZIP 中没有 Markdown 章节');
    }
    chapters.sort((a, b) => naturalName(a.fileName).localeCompare(naturalName(b.fileName), undefined, { numeric: true }));
    chapters.forEach((chapter, index) => {
      chapter.order = index + 1;
    });

    return {
      title: stringField(meta.title) ?? fallbackTitle,
      summary: stringField(meta.summary),
      categorySlug: stringField(meta.categorySlug),
      tags: Array.isArray(meta.tags) ? meta.tags.filter((item): item is string => typeof item === 'string') : undefined,
      warnings,
      chapters,
    };
  } catch (error) {
    throw toZipException(error);
  } finally {
    zip.close();
  }
}

function toZipException(error: unknown): DomainHttpException {
  if (error instanceof DomainHttpException) {
    return error;
  }
  const message = error instanceof Error ? error.message : '';
  if (message.includes('relative path') || message.includes('..')) {
    return new DomainHttpException(HttpStatus.UNPROCESSABLE_ENTITY, 'BOOKLET_IMPORT_FAILED', 'ZIP 含非法路径');
  }
  return new DomainHttpException(HttpStatus.UNPROCESSABLE_ENTITY, 'BOOKLET_IMPORT_FAILED', 'ZIP 无法解析');
}

function openZipFile(filePath: string): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true, autoClose: false }, (error, zip) => {
      if (error || !zip) {
        reject(toZipException(error));
        return;
      }
      resolve(zip);
    });
  });
}

function readAllEntries(zip: ZipFile): Promise<Entry[]> {
  return new Promise((resolve, reject) => {
    const entries: Entry[] = [];
    let metadataBytes = 0;
    zip.on('error', (error) => reject(toZipException(error)));
    zip.on('end', () => resolve(entries));
    zip.on('entry', (entry: Entry) => {
      metadataBytes +=
        entry.fileNameRaw.length + entry.extraFieldRaw.length + entry.fileCommentRaw.length;
      if (metadataBytes > MAX_ZIP_METADATA_BYTES) {
        reject(
          new DomainHttpException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'BOOKLET_IMPORT_FAILED',
            'ZIP 文件名及元数据总量超过限制',
          ),
        );
        zip.close();
        return;
      }
      if (entries.length >= MAX_ZIP_ENTRIES) {
        reject(
          new DomainHttpException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'BOOKLET_IMPORT_FAILED',
            'ZIP 条目数量超过限制',
          ),
        );
        zip.close();
        return;
      }
      entries.push(entry);
      zip.readEntry();
    });
    zip.readEntry();
  });
}

/** 只保留有限数量的逐文件告警，避免恶意 ZIP 放大解析结果和日志。 */
function pushWarning(warnings: string[], warning: string): void {
  if (warnings.length < MAX_WARNINGS) {
    warnings.push(warning);
  } else if (warnings.length === MAX_WARNINGS) {
    warnings.push('其余告警已省略');
  }
}

function readEntryString(
  zip: ZipFile,
  entry: Entry,
  maxBytes: number,
  onBytesRead?: (chunkBytes: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error || !stream) {
        reject(error ?? new Error('无法读取 ZIP 条目'));
        return;
      }
      const chunks: Buffer[] = [];
      let total = 0;
      stream.on('data', (chunk: Buffer) => {
        total += chunk.length;
        if (total > maxBytes) {
          stream.destroy();
          reject(
            new DomainHttpException(HttpStatus.UNPROCESSABLE_ENTITY, 'BOOKLET_IMPORT_FAILED', '章节过大'),
          );
          return;
        }
        try {
          onBytesRead?.(chunk.length);
        } catch (readError) {
          stream.destroy();
          reject(readError);
          return;
        }
        chunks.push(chunk);
      });
      stream.on('error', reject);
      stream.on('end', () => resolve(decodeZipText(Buffer.concat(chunks))));
    });
  });
}

function isDirectory(name: string): boolean {
  return /\/$/.test(name);
}

export function decodeZipEntryName(entry: Entry): string {
  // yauzl 已处理 UTF-8 标志和 Info-ZIP Unicode Path extra field。
  if (
    (entry.generalPurposeBitFlag & 0x800) !== 0 ||
    entry.extraFields.some((field) => field.id === 0x7075)
  ) {
    return entry.fileName;
  }
  // 部分压缩工具写入 UTF-8 文件名却漏掉标志，先严格识别 UTF-8，再兼容旧式中文 ZIP。
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(entry.fileNameRaw);
  } catch {
    try {
      return new TextDecoder('gb18030', { fatal: true }).decode(entry.fileNameRaw);
    } catch {
      return entry.fileName;
    }
  }
}

export function decodeZipText(buffer: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    try {
      return new TextDecoder('gb18030').decode(buffer);
    } catch {
      return buffer.toString('utf8');
    }
  }
}

function normalizeZipPath(name: string): string {
  return name.replace(/\\/g, '/');
}

function detectRoot(names: string[]): string {
  const trimmed = names.filter((name) => !name.startsWith('__MACOSX'));
  const first = trimmed[0]?.split('/')[0];
  if (!first) {
    return '';
  }
  const allPrefixed = trimmed.every((name) => name === first || name.startsWith(`${first}/`));
  const hasFileAtRoot = trimmed.some((name) => !name.includes('/'));
  return allPrefixed && !hasFileAtRoot ? first : '';
}

function stripRoot(name: string, root: string): string {
  if (!root) {
    return name;
  }
  if (name === root) {
    return '';
  }
  return name.startsWith(`${root}/`) ? name.slice(root.length + 1) : name;
}

function headingOrFileName(markdown: string, fileName: string): string {
  const match = markdown.match(/^#\s+(.+)$/m);
  if (match?.[1]) {
    return match[1].trim().slice(0, 200);
  }
  return fileName.replace(/\.md$/i, '').replace(/^\d+[-_]?/, '').slice(0, 200) || '未命名章节';
}

function naturalName(fileName: string): string {
  return fileName.replace(/\\/g, '/').split('/').pop() ?? fileName;
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
