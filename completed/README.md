# 已完成功能台账

> 记录 personal-hub 各阶段/模块的完成状态、验收结果与交付文档入口。
> 与 `docs/implementation/`（实现说明）、`study/features/`（学习笔记）分工：本文件只做进度索引。

## React-first 阶段

| 阶段 | 状态 | 完成时间 | 实现文档 | 学习文档 |
|---|---|---|---|---|
| 阶段 0 工程骨架 | ✅ 已完成 | 2026-06-27 | [phase-0-structure.md](../docs/implementation/react-first/phase-0-structure.md) | — |
| 阶段 1 基础底座 | ✅ 已完成 | 2026-06-27 | [phase-1-foundation.md](../docs/implementation/react-first/phase-1-foundation.md) | [umi-mock-and-dataflow.md](../study/features/umi-mock-and-dataflow.md) |
| 阶段 2 公开前台与内容阅读 | ✅ 已完成 | 2026-06-27 | [phase-2-public-reading.md](../docs/implementation/react-first/phase-2-public-reading.md) | [markdown-booklet-reading.md](../study/features/markdown-booklet-reading.md) |
| 阶段 3 工作区与内容生产 | ✅ 已完成 | 2026-06-27 | [phase-3-workspace.md](../docs/implementation/react-first/phase-3-workspace.md) | — |
| 阶段 0–3 合并与补强 | ✅ 已完成 | 2026-06-28 | [phase-0-3.md](../docs/implementation/react-first/phase-0-3.md) | [react-first-phase-0-3.md](../study/features/react-first-phase-0-3.md) |
| 阶段 4 后台运营台 | ✅ 已完成本轮收尾 | 2026-07-05 | [phase-4-closeout.md](../docs/implementation/react-first/phase-4-closeout.md) | — |
| 阶段 4.5 全站体验底座 | ✅ 已完成本轮收尾 | 2026-07-05 | [phase-4-5-experience-deepening.md](../docs/implementation/react-first/phase-4-5-experience-deepening.md) | [react-experience-system.md](../study/features/react-experience-system.md) |
| 阶段 5 AI 平台 mock 闭环 | ✅ 已完成本轮收尾 | 2026-07-06 | [phase-5-ai-shell.md](../docs/implementation/react-first/phase-5-ai-shell.md) | [ai-platform-mock-workbench.md](../study/features/ai-platform-mock-workbench.md) |

## 验收速览

### 阶段 0 工程骨架
- `pnpm install` 成功（Node 22，`.nvmrc` 锁定）。
- `pnpm dev:react` 启动，`http://localhost:8000` HTTP 200。
- `apps/react-web` 可 import `@personal-hub/shared-types`。
- `packages/shared-types` typecheck 通过。

### 阶段 1 基础底座
- `src/app.tsx` 的 `getInitialState` 拉取用户/权限/菜单/系统配置，`access.ts` 基于 `PermissionCode` 生效。
- 统一 `ApiResponse<T>` 请求封装，401 自动跳登录；`useRequest` 自动解包 `data`。
- 分层 mock（`mock/*.ts` 路由 + `mock/data/*` 数据 + `mock/utils.ts` 工具）跑通。
- `tsc --noEmit` 0 错误，`biome check` 通过。

### 阶段 2 公开前台与内容阅读
- 公开页面：首页、内容列表（筛选/分页）、内容详情、小册章节、项目、关于。
- `PublicLayout` 独立布局，便于后续迁移 Next.js。
- `MarkdownViewer` 渲染 + `remark-gfm`；`ContentDetail` 按 `ContentType` 分发。
- 内容卡片/详情支持收藏；详情支持复制链接、阅读进度 mock 保存、回到顶部。
- 本地小册 `sync-local-booklets.ts` 生成 mock 数据，并合并进内容中心列表/详情；本次同步验证 71 本小册、1973 个章节。

### 阶段 3 工作区与内容生产
- 工作区：Dashboard、文档管理（ProTable）、新建向导、Markdown 编辑器、小册管理、收藏、用量、个人设置。
- Markdown 编辑：`@uiw/react-md-editor` 分栏 + 标题 + 基础信息抽屉 + 草稿/发布（mock）。
- workspace mock 接口：stats / continue-reading / contents(CRUD + 状态/可见性筛选) / booklets/local / favorites / usage。
- `tsc` 0 错误，`biome check` 通过，`pnpm build:react` 通过。
