import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import JSZip from 'jszip';
import { RoleCode, UserStatus } from '@prisma/client';
import { AppModule } from '../app.module';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { BookletImportService } from '../modules/booklet/booklet-import.service';
import { parseBookletZip } from '../modules/booklet/parse-booklet-zip';

const SKIP_DIRS = new Set(['node_modules', '.git', 'booklets']);
const SKIP_MD = new Set(['README.md']);

interface PlannedBooklet {
  folder: string;
  zipName: string;
  digest: string;
  title?: string;
  chapters: number;
  warnings: string[];
  zip: Buffer;
}

function parseArgs(argv: string[]) {
  const sourceIndex = argv.indexOf('--source');
  const ownerIndex = argv.indexOf('--owner-email');
  const source = sourceIndex >= 0 ? argv[sourceIndex + 1] : '';
  const ownerEmail = ownerIndex >= 0 ? argv[ownerIndex + 1] : 'owner@example.com';
  return {
    source,
    ownerEmail,
    dryRun: argv.includes('--dry-run') || !argv.includes('--execute'),
    execute: argv.includes('--execute'),
  };
}

function listBookletDirs(root: string): string[] {
  const bookletsRoot = existsSync(join(root, 'booklets')) ? join(root, 'booklets') : root;
  return readdirSync(bookletsRoot)
    .map((name) => join(bookletsRoot, name))
    .filter((path) => {
      if (!statSync(path).isDirectory()) {
        return false;
      }
      const name = basename(path);
      if (SKIP_DIRS.has(name) || name.startsWith('.')) {
        return false;
      }
      return collectMarkdown(path).length > 0;
    });
}

function collectMarkdown(dir: string, prefix = ''): Array<{ relative: string; absolute: string }> {
  const entries = readdirSync(dir);
  const files: Array<{ relative: string; absolute: string }> = [];
  for (const entry of entries) {
    if (entry.startsWith('.') || SKIP_DIRS.has(entry)) {
      continue;
    }
    const absolute = join(dir, entry);
    const relative = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(absolute).isDirectory()) {
      files.push(...collectMarkdown(absolute, relative));
      continue;
    }
    if (entry.toLowerCase().endsWith('.md') && !SKIP_MD.has(entry)) {
      files.push({ relative, absolute });
    }
    if (entry === 'meta.json') {
      files.push({ relative, absolute });
    }
  }
  return files;
}

async function zipDirectory(dir: string): Promise<Buffer> {
  const zip = new JSZip();
  const rootName = basename(dir);
  for (const file of collectMarkdown(dir)) {
    zip.file(`${rootName}/${file.relative}`, readFileSync(file.absolute));
  }
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function plan(source: string): Promise<PlannedBooklet[]> {
  const planned: PlannedBooklet[] = [];
  for (const folder of listBookletDirs(source)) {
    const zip = await zipDirectory(folder);
    const parsed = await parseBookletZip(zip, basename(folder));
    const digest = createHash('sha256').update(zip).digest('hex');
    planned.push({
      folder,
      zipName: `${basename(folder)}.zip`,
      digest,
      title: parsed.title,
      chapters: parsed.chapters.length,
      warnings: parsed.warnings,
      zip,
    });
  }
  return planned;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.source) {
    throw new Error('用法: pnpm booklet:import-local --source /absolute/content-local [--dry-run|--execute]');
  }
  const source = resolve(args.source);
  if (!existsSync(source)) {
    throw new Error(`目录不存在: ${source}`);
  }

  const planned = await plan(source);
  for (const item of planned) {
    console.info(
      `${args.execute ? '导入' : '计划'} ${item.folder} → ${item.title ?? basename(item.folder)} (${item.chapters} 章)`,
    );
    for (const warning of item.warnings) {
      console.warn(`  告警: ${warning}`);
    }
  }

  if (!args.execute) {
    console.info(`dry-run 完成，共 ${planned.length} 本；加 --execute 才会写库。`);
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  try {
    const prisma = app.get(PrismaService);
    const imports = app.get(BookletImportService);
    const owner = await prisma.user.findFirst({
      where: { email: args.ownerEmail.toLowerCase(), status: UserStatus.ACTIVE, role: { code: RoleCode.SUPER_ADMIN } },
    });
    if (!owner) {
      throw new Error(`未找到可归属的 SUPER_ADMIN：${args.ownerEmail}`);
    }
    const results = [];
    for (const item of planned) {
      const job = await imports.importOwnedZip(
        owner.id,
        item.zip,
        item.zipName,
        `cli:${item.digest}`,
      );
      results.push({
        folder: item.folder,
        digest: item.digest,
        status: job.status,
        contentId: job.contentId,
        errorMessage: job.errorMessage,
      });
    }
    await prisma.migrationRun.create({
      data: {
        operatorId: owner.id,
        sourcePath: source,
        sourceDigest: createHash('sha256').update(planned.map((item) => item.digest).join('|')).digest('hex'),
        dryRun: false,
        summary: results,
      },
    });
    console.info(`execute 完成，共 ${results.length} 本。`);
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
