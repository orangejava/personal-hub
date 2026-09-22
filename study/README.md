# 学习与系统设计目录

> 这个目录不写“需求文档”，而是写开发过程中需要反复参考的学习材料、设计方法、复盘笔记。
>
> **分区提示**：当前 Web 拆为用户端 `apps/user-web` 与管理端 `apps/admin-web`；Nest 阶段 0 已启动，Next.js 手册仍对应后续阶段 6–7。

---

## 当前文档

- [features/README.md](./features/README.md)：功能级学习文档归档规范与入口。
- [interview/README.md](./interview/README.md)：项目面试题索引与模块化问答。
- [features/nest-server-bootstrap.md](./features/nest-server-bootstrap.md)：Nest + Express 阶段 0 底座与验证。
- [features/nest-http-adapter-comparison.md](./features/nest-http-adapter-comparison.md)：Express / Fastify 的取舍与迁移复盘。
- [features/nest-stage0-retrospective.md](./features/nest-stage0-retrospective.md)：阶段 0 的环境变量、端口与本地依赖排障复盘。
- [features/umi-mock-and-dataflow.md](./features/umi-mock-and-dataflow.md)：Umi Max mock 分层、`useRequest` 自动解包 `ApiResponse.data` 的机制与踩坑。
- [features/markdown-booklet-reading.md](./features/markdown-booklet-reading.md)：Markdown 渲染 + 目录提取 + 多类型内容分发 + 本地小册同步脚本。
- [features/react-first-phase-0-3.md](./features/react-first-phase-0-3.md)：React-first 阶段 0–3 合并复盘（权限、主题分离、菜单 i18n、文档预览选型）。
- [features/react-experience-system.md](./features/react-experience-system.md)：阶段 4.5 体验系统（动效、骨架屏、结果态、操作反馈）。
- [features/ai-composer-layout.md](./features/ai-composer-layout.md)：AI 三页统一布局、可配置输入框、配置弹窗和多类型消息渲染。
- [features/nest-auth-login-slice.md](./features/nest-auth-login-slice.md)：Nest 登录切片、内存 Access Token 与 Refresh Cookie。
- [features/nest-auth-permissions.md](./features/nest-auth-permissions.md)：权限快照、菜单过滤与前端 routeKey 注册表。
- [features/nest-auth-register.md](./features/nest-auth-register.md)：公开注册、Mailpit 邮件链接验证与验证赠额。
- [features/nest-auth-captcha-sessions-password.md](./features/nest-auth-captcha-sessions-password.md)：登录验证码、设备会话、强制改密、忘记密码与后台踢人。
- [features/nest-system-config-menu.md](./features/nest-system-config-menu.md)：类型化 system_configs、公开导航与 HTTP 幂等。
- [features/admin-system-config-hub.md](./features/admin-system-config-hub.md)：后台系统配置中心、菜单隐藏与公开 mapper。
- [features/nest-content-domain.md](./features/nest-content-domain.md)：内容域可见性、UPPER_SNAKE 映射与公开读。
- [features/nest-file-booklet.md](./features/nest-file-booklet.md)：预签名上传、purpose 与 Outbox 导入。
- [features/nest-ai-domain.md](./features/nest-ai-domain.md)：AI 额度预占、SSE 停止、导航配置、鉴权媒体与 OpenAI 适配层。
- [features/ai-chat-sse-boundaries.md](./features/ai-chat-sse-boundaries.md)：AI 对话 SSE 接收、前端分帧渲染与故障定位。
- [features/nest-review-remediation-concurrency.md](./features/nest-review-remediation-concurrency.md)：正式 Review 中的并发、任务租约、幂等和内容权限修复。
- [frontend-to-fullstack-learning-path.md](./frontend-to-fullstack-learning-path.md)：面向 Vue 3 / React 前端开发者的全栈转型路径。
- [local-environment-setup-handbook.md](./local-environment-setup-handbook.md)：本地开发环境准备手册，包含 Docker、PostgreSQL、Redis、GUI/CLI 工具建议。
- [nextjs-learning-handbook.md](./nextjs-learning-handbook.md)：Next.js 学习手册，重点是 App Router、RSC、SSR、ISR、路由组织。
- [nestjs-learning-handbook.md](./nestjs-learning-handbook.md)：NestJS 学习手册，重点是模块、Controller、Service、Guard、Swagger。
- [prisma-postgres-learning-handbook.md](./prisma-postgres-learning-handbook.md)：Prisma 与 PostgreSQL 学习手册，重点是建模、迁移、关系、索引、分页。
- [monorepo-docker-learning-handbook.md](./monorepo-docker-learning-handbook.md)：pnpm workspace、Turborepo、Docker Compose 学习手册。
- [technology-learning-map.md](./technology-learning-map.md)：技术学习地图，适合先扫全局。
- [system-design-thinking.md](./system-design-thinking.md)：如果重新设计一个系统，应该从哪些维度思考。

---

## 这个目录后续适合增加什么

- 某次关键技术选型的复盘
- 某个难点功能的拆解笔记
- 一次部署/排障后的经验总结
- 某个模块的阅读源码笔记

---

## 建议阅读顺序

### 当前：React-first 开发

1. [features/react-first-phase-0-3.md](./features/react-first-phase-0-3.md) — 阶段 0–3 复盘。
2. [features/markdown-booklet-reading.md](./features/markdown-booklet-reading.md) — Markdown、小册、目录、同步脚本。
3. [features/umi-mock-and-dataflow.md](./features/umi-mock-and-dataflow.md) — mock 与 `useRequest` 数据流。

PRD 与路线图见 [../docs/prd/README.md](../docs/prd/README.md)、[../docs/react-first/README.md](../docs/react-first/README.md)。

### 当前：Nest 阶段 0 与后续领域模块

1. 先读 [features/nest-server-bootstrap.md](./features/nest-server-bootstrap.md)，了解已落地的 Express、Compose、health 与 requestId 链路。
2. 启动或排障时，读 [local-environment-setup-handbook.md](./local-environment-setup-handbook.md) 和 [monorepo-docker-learning-handbook.md](./monorepo-docker-learning-handbook.md)。
3. 开始 `apps/server` 领域模块时，读 [nestjs-learning-handbook.md](./nestjs-learning-handbook.md)。
4. 开始数据库建模时，读 [prisma-postgres-learning-handbook.md](./prisma-postgres-learning-handbook.md)。

### 后续：长期全栈与 Next.js

1. 先读 [frontend-to-fullstack-learning-path.md](./frontend-to-fullstack-learning-path.md)，建立整体心智模型。
2. 开始 `apps/next-web` 时，读 [nextjs-learning-handbook.md](./nextjs-learning-handbook.md)。
3. 需要拔高系统视角时，再读 [system-design-thinking.md](./system-design-thinking.md)。

## 使用建议

1. `docs/` 放“项目要做什么、按什么顺序做、工程上怎么落”。
2. `study/` 根目录放“为什么这样做、每个技术怎么学、常见坑怎么避开”的通用手册。
3. 新增单个功能的学习沉淀时，优先放到 `study/features/`，不要和通用手册混放。
4. 新增学习笔记时，尽量一篇只解决一个主题，例如“JWT 登录链路”或“Prisma 多对多关系”。
5. 面试问答统一放到 `study/interview/`，不与功能复盘混在同一篇文档中。
