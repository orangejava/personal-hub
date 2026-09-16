# 阶段 2：公开前台与内容阅读

## 1. 目标与范围
- 公开访客可见的页面：首页、内容列表、内容详情、小册章节、项目、关于。
- Markdown / 小册 / 链接 / PDF 等多类型内容的统一阅读体验。
- 非目标：登录后编辑（阶段 3）、SEO/SSR（后续 Next.js 迁移）。

## 2. 页面与入口
| 路由 | 文件 | 说明 |
|---|---|---|
| `/` | `src/pages/public/Home` | Hero + 精选 + 分类导航 |
| `/content` | `src/pages/public/Content` | 关键字/类型/分类/标签/排序筛选 + 分页 |
| `/content/:id` | `src/pages/public/ContentDetail` | 按 `ContentType` 分发渲染 |
| `/content/booklets/:id/chapters/:chapterId` | `src/pages/public/BookletChapter` | 小册章节 + 上下章导航 |
| `/projects` | `src/pages/public/Projects` | `ContentType.Project` 列表 |
| `/about` | `src/pages/public/About` | 静态 Markdown |

公开页统一用 `src/layouts/PublicLayout.tsx`，不挂 ProLayout，便于后续整页迁移 Next.js。

## 3. 接口与数据流
- `services/content.ts`：`fetchContentList / fetchContentDetail / fetchBookletChapters`。
- `services/system.ts`：`fetchSystemPublicConfig`（站点标题、导航、主题等）。
- 列表筛选参数：`keyword / type / categorySlug / tag / sort / page / pageSize`，全部映射到 `PaginationQuery`。

## 4. 关键实现
- `ContentDetail` 按 `ContentType` 分发：
  - `Markdown` → `MarkdownViewer` + 右侧 `TocPanel`。
  - `Booklet` → 跳转第一章 `chapters/:firstChapterId`。
  - `Link` → 卡片 + 外链按钮。
  - `PDF / Word / Project` → 占位卡片（阶段 4+ 补真实预览）。
- `MarkdownViewer`：`react-markdown` + `remark-gfm`，统一 `data-color-mode`，目录从正文 `##/###` 正则提取。
- `ContentCard` / `ContentDetail`：补收藏入口；未登录时提示并跳登录，登录后调用 mock 收藏接口。
- `ContentDetail`：补复制链接、阅读进度 mock 保存、回到顶部，满足首版阅读辅助操作。
- `BookletChapter`：补左侧小册列表、章节目录、阅读进度、右侧章内目录与返回内容中心。
- `Content` 列表用 `ProTable`，`valueEnum` 来自 `ContentTypeLabel`，保持类型与文案单一来源。
- 本地小册：`src/scripts/sync-local-booklets.ts` 同时扫描 `content-local/booklets/<小册名>/` 与 `content-local/<小册名>/`，解析 `meta.json` + 章节 md，生成 `mock/data/local-booklets.generated.ts`（gitignore），并接入 `package.json` 的 `prepare` 脚本保证全新克隆可跑。
- 本地小册已合并进 `/api/contents` 列表和 `/api/contents/:id` 详情，内容中心筛选小册后可直接看到同步结果。

## 5. 权限与异常
- 公开页无需登录；接口 404 / 详情缺失 → `ErrorState`；空列表 → `EmptyState`。
- 本地小册未同步时显示引导（执行 `pnpm sync:booklets`）。

## 6. 验证方式
- `curl /api/contents?page=1&pageSize=5` 返回列表；`curl /api/contents/c-book-01/chapters` 返回章节。
- `curl /api/contents?type=booklet&page=1&pageSize=5` 返回本地同步小册；本次验证为 71 本小册。
- 浏览器访问 `/`、`/content`、`/content/c-book-01` 可正常渲染。
- `tsc` / `biome` / `pnpm build:react` 通过。

## 7. 已知限制与后续扩展
- 目录锚点尚未做滚动位置高亮联动，待阶段 4 补 `IntersectionObserver`。
- 公开页为 CSR，SEO 由后续 Next.js 迁移解决；`PublicLayout` 已按「可整体迁移」设计。
