/**
 * 核对并可选拷贝「随前端发布」的占位图。
 * 生产不跑数据库迁移：重建 Nginx 镜像时，user-web 构建会把 public 带进 dist。
 *
 * 只核对：node apps/user-web/scripts/stage-public-images.mjs
 * 拷到目录：node apps/user-web/scripts/stage-public-images.mjs --out /tmp/ph-public-images
 */
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');
const catalogPath = path.resolve(
  scriptDir,
  '../src/config/publicImageCatalog.json',
);

const outFlag = process.argv.indexOf('--out');
const outDir = outFlag >= 0 ? process.argv[outFlag + 1] : '';

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
const missing = [];

for (const item of catalog.items) {
  const source = path.join(repoRoot, item.file);
  try {
    await readFile(source);
  } catch {
    missing.push(item.file);
    continue;
  }
  if (!outDir) continue;
  const target = path.join(outDir, item.path.replace(/^\//, ''));
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(source, target);
  console.log(item.path);
}

if (missing.length > 0) {
  console.error(`缺少占位图：\n${missing.join('\n')}`);
  process.exit(1);
}

console.log(
  `占位图 ${catalog.items.length} 张都在。生产发布用户端静态文件后即可访问，不用单独迁数据库。`,
);
