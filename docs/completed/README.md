# 已完成功能台账

> 记录 personal-hub 各阶段/模块的完成状态、验收结果与交付文档入口。
> 与 `docs/implementation/`（实现说明）、`study/features/`（学习笔记）分工：本文件只做进度索引。

## React-first 阶段

| 阶段 | 状态 | 完成时间 | 实现文档 | 学习文档 |
|---|---|---|---|---|
| 阶段 0 工程骨架 | ✅ 已完成 | 2026-06-27 | [phase-0-structure.md](../../apps/user-web/docs/implementation/phase-0-structure.md) | — |
| 阶段 1 基础底座 | ✅ 已完成 | 2026-06-27 | [phase-1-foundation.md](../../apps/user-web/docs/implementation/phase-1-foundation.md) | [umi-mock-and-dataflow.md](../../study/features/umi-mock-and-dataflow.md) |
| 阶段 2 公开前台与内容阅读 | ✅ 已完成 | 2026-06-27 | [phase-2-public-reading.md](../../apps/user-web/docs/implementation/phase-2-public-reading.md) | [markdown-booklet-reading.md](../../study/features/markdown-booklet-reading.md) |
| 阶段 3 工作区与内容生产 | ✅ 已完成 | 2026-06-27 | [phase-3-workspace.md](../../apps/user-web/docs/implementation/phase-3-workspace.md) | — |
| 阶段 0–3 合并与补强 | ✅ 已完成 | 2026-06-28 | [phase-0-3.md](../../apps/user-web/docs/implementation/phase-0-3.md) | [react-first-phase-0-3.md](../../study/features/react-first-phase-0-3.md) |
| 阶段 4 后台运营台 | ✅ 已完成本轮收尾 | 2026-07-05 | [phase-4-closeout.md](../../apps/admin-web/docs/implementation/phase-4-closeout.md) | — |
| 阶段 4.5 全站体验底座 | ✅ 已完成本轮收尾 | 2026-07-05 | [phase-4-5-experience-deepening.md](../../apps/admin-web/docs/implementation/phase-4-5-experience-deepening.md) | [react-experience-system.md](../../study/features/react-experience-system.md) |
| 阶段 5 AI 平台 mock 闭环 | ✅ 已完成本轮收尾 | 2026-07-06 | [phase-5-ai-shell.md](../../apps/user-web/docs/implementation/phase-5-ai-shell.md) | [ai-platform-mock-workbench.md](../../study/features/ai-platform-mock-workbench.md) |
| 用户端 / 管理端拆分 | ✅ 已完成 | 2026-08-28 | [admin-web-split.md](../implementation/admin-web-split.md) | — |

## Nest 后端阶段

| 阶段 | 状态 | 完成时间 | 实现文档 | 学习文档 |
|---|---|---|---|---|
| 阶段 0 Express 运行底座 | ✅ 已完成 | 2026-08-09 | [nest-server-bootstrap.md](../../apps/server/docs/implementation/foundation/nest-server-bootstrap.md) | [阶段 0 学习](../../study/features/nest-server-bootstrap.md) · [问题复盘](../../study/features/nest-stage0-retrospective.md) · [面试题](../../study/interview/nest-phase-0-bootstrap.md) |
| M1 身份/RBAC/菜单数据基线 | ✅ 已完成 | 2026-08-09 | [auth-rbac-menu-baseline.md](../../apps/server/docs/implementation/auth/auth-rbac-menu-baseline.md) | — |
| M2 Auth HTTP + React 登录切片 | ✅ 第 1–8 刀已落地 | 2026-08-22 | [切片划分](../../apps/server/docs/implementation/auth/README.md) · [登录](../../apps/server/docs/implementation/auth/auth-login-slice.md) · [权限](../../apps/server/docs/implementation/auth/auth-permissions-slice.md) · [注册](../../apps/server/docs/implementation/auth/auth-register-slice.md) · [验证码](../../apps/server/docs/implementation/auth/auth-captcha-slice.md) · [会话](../../apps/server/docs/implementation/auth/auth-sessions-slice.md) · [改密](../../apps/server/docs/implementation/auth/auth-change-password-slice.md) · [忘记密码](../../apps/server/docs/implementation/auth/auth-forgot-password-slice.md) · [后台踢人](../../apps/server/docs/implementation/auth/auth-admin-sessions-slice.md) | [登录](../../study/features/nest-auth-login-slice.md) · [权限菜单](../../study/features/nest-auth-permissions.md) · [注册验证](../../study/features/nest-auth-register.md) · [验证码/会话/改密](../../study/features/nest-auth-captcha-sessions-password.md) |

### Nest 阶段 0 Express 运行底座

- 已可通过 `compose.dev.yml` 启动 PostgreSQL、Redis、MinIO 与 Mailpit，并用 `pnpm dev:server` 启动服务。
- 已可人工验证 `/api/v1/health/live`、`/api/v1/health/ready`、`/api/docs`、`requestId` 与 Redis 断连时的 readiness `503`。
- Testcontainers 已使用临时 PostgreSQL/Redis 执行 migration 与 readiness；Redis 故障时的 readiness `503` 和 server CI 已自动化验证。

## 验收速览

### 阶段 0 工程骨架
- `pnpm install` 成功（Node 22，`.nvmrc` 锁定）。
- `pnpm dev:react` 启动，`http://localhost:8000` HTTP 200。
- `apps/user-web` 可 import `@personal-hub/shared-types`。
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
