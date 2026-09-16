# 已完成功能台账

> 记录 personal-hub 各阶段/模块的完成状态、验收结果与交付文档入口。
> 与 `docs/implementation/`（实现说明）、`study/features/`（学习笔记）分工：本文件只做进度索引。
>
> **下一步不在本表**：当前主线是首版上线部署，见 [../deploy/go-live-mainline.md](../deploy/go-live-mainline.md)。M7 后台治理本轮不做。

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
| M3 系统配置与菜单 | ✅ 3.1–3.3 已落地 | 2026-08-31 | [切片划分](../../apps/server/docs/implementation/system/README.md) | [类型化配置与幂等](../../study/features/nest-system-config-menu.md) |
| M4 内容域 | ✅ 4.1–4.5 已落地 | 2026-09-07 | [切片划分](../../apps/server/docs/implementation/content/README.md) | [可见性与枚举映射](../../study/features/nest-content-domain.md) |
| M5 文件/小册 | ✅ 5.1–5.7 已落地 | 2026-09-08 | [切片划分](../../apps/server/docs/implementation/file/README.md) | [预签名与 Outbox](../../study/features/nest-file-booklet.md) |
| M6 AI 域 | ✅ Fake + 导航/媒体收口 + OpenAI 适配层 | 2026-09-11 | [ai/README.md](../../apps/server/docs/implementation/ai/README.md) | [nest-ai-domain.md](../../study/features/nest-ai-domain.md) |
| 审查修复收口 | ✅ 并发/上传/任务分页 | 2026-09-09 | [review-remediation.md](../implementation/review-remediation.md) · [审核与上传 UI](../implementation/content/content-review-and-uploads.md) | — |

### Nest M3 系统配置与菜单

- 匿名首页读取 `GET /api/v1/public/site-config`、`GET /api/v1/public/navigation`；公开顶栏展示菜单 `name`（中文），失败才 fallback `publicMenu.ts`。
- 后台可按组 `PUT /api/v1/admin/system-configs/:group`（`Idempotency-Key` + `version`）；菜单 UUID CRUD / 排序 / `route-options`；改菜单后权限快照按世代失效。
- Logo 真文件、About Markdown 接线、左/右导航 UI、配置草稿/回滚不在本阶段。

### Nest M4 内容域

- 匿名首页/内容中心读 `GET /api/v1/public/contents*`；LOGIN 锁定卡片，详情未登录 `401 AUTH_REQUIRED`。
- 工作区 Markdown / 外链 / 项目可创建、发布、归档、软删；收藏与阅读进度只要求登录。
- 后台可跨作者列表、精选、分类/标签 CRUD。ZIP、封面真文件、章节正文见 M5。

### Nest M5 文件/小册

- 浏览器预签名上传 MinIO；complete 只读魔数前缀并流式计算 SHA-256；>20MiB 走 multipart parts/ETag。
- ZIP 导入走独立 `server-worker`（Outbox dispatcher + BullMQ，不是 stub）；数据库提交成功后再归档源 ZIP，失败可 retry。
- 工作区任务列表走 `GET /app/upload-tasks` 真分页，默认 `pageSize=10`。
- 章节列表不含正文；阅读页按章拉取 `markdownSource`。
- 封面/Logo/PDF 预览返回短时签名 URL。存量目录用 CLI，不把服务器目录暴露成 HTTP。

### Nest M6 AI 域

- MEMBER 具备 `ai:use`。Chat/Text 为 HTTP SSE；停止只走显式 `stop`/`cancel`。
- 额度预占 5 分钟 TTL；不足 `409 AI_QUOTA_INSUFFICIENT`。匿名 Cookie `ph_ai_anon`，登录认领失败不阻断登录。
- 图片/视频 Outbox + worker；任务结果走鉴权媒体接口。品牌/导航写库；文本默认可切 OpenAI-compatible 适配层。

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
