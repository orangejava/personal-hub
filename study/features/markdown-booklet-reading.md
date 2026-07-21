# Markdown 渲染与小册阅读

> 阶段 2 公开前台的学习沉淀。适用于「在 React 里做 Markdown 渲染 + 目录 + 多类型内容分发 + 本地小册同步」。

## 场景背景
个人知识平台要展示 Markdown 文章、多章节小册、外链、PDF 等多类型内容。前台需要：统一渲染、自动目录、小册章节导航，以及把本地 Markdown 文件同步成可读数据。

## 核心概念
- **`ContentType` 分发**：详情页按类型选渲染器，避免一个组件塞满 `if/else`。
- **`react-markdown` + `remark-gfm`**：渲染 GFM（表格、任务列表、删除线）。编辑用 `@uiw/react-md-editor`。
- **目录提取**：从正文 `##`/`###` 正则取标题，构造 `{level, text, anchor}`。
- **本地小册同步**：Node 脚本扫 `content-local/booklets/**`，读 `meta.json` + 章节 md，生成 `*.generated.ts`（gitignore），通过 `prepare` 脚本保证全新克隆可跑。

## 实现步骤
1. `shared-types` 定义 `ContentType / ContentItem / ContentDetail / Booklet / Chapter`。
2. `MarkdownViewer`：`ReactMarkdown` + `remarkGfm`，外层 `data-color-mode` 控制明暗。
3. `extractToc(md)`：正则提取标题（注意 `while` 赋值要拆开写，避免 lint `noAssignInExpressions`）。
4. `ContentDetail`：按 `ContentType` 分发——Markdown 渲染、Booklet 跳第一章、Link 卡片、其余占位。
5. `BookletChapter`：拉章节列表 + 当前章节，上下章按钮。
6. `sync-local-booklets.ts`：`fast-glob` 找 `meta.json`，`gray-matter` 解析 frontmatter，写 `local-booklets.generated.ts`。

## 关键代码
目录提取（避免在 `while` 条件里赋值）：
```ts
const re = /^(#{2,3})\s+(.+)$/gm;
let m = re.exec(md);
while (m) {
  items.push({ level: m[1].length, text: m[2].trim(), anchor: m[2].trim() });
  m = re.exec(md);
}
```
本地小册扫描根路径（脚本在 `src/scripts/`，往上两级到 `apps/react-web`，再往上两级到 monorepo 根）：
```ts
const ROOT = resolve(__filename, '../../..');        // apps/react-web
const REPO_ROOT = resolve(ROOT, '../..');            // monorepo 根
```

## 常见错误
- **`while ((m = re.exec(md)))` 被 biome 报错**：拆成 `let m = re.exec(md); while(m){...; m = re.exec(md)}`。
- **脚本输出路径错**：`__filename` 往上层数算错，会写到 `apps/mock/...`。先 `console.log(ROOT, REPO_ROOT)` 确认。
- **mock 不热更新**：Umi mock 只在启动时加载，生成新数据后要重启 dev server。
- **`generated.ts` 缺失导致全新克隆跑不起来**：把 `tsx src/scripts/sync-local-booklets.ts` 加进 `prepare`。

## 手动验证
- 访问 `/content/c-md-01` 看到 Markdown 正文 + 右侧目录。
- 访问 `/content/c-book-01` 自动跳到第一章。
- `pnpm sync:booklets` 后 `/workspace/booklets` 出现本地小册卡片。
- `curl /api/contents/c-book-01/chapters` 返回章节数组。
