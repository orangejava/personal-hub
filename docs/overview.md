# 项目总纲索引

> 个人知识平台 + AI 工具中台
> 状态：React-first 阶段 0–5 mock 闭环已完成；Nest 阶段 0 + M1 + M2 Auth + M3 系统配置与菜单 + **M4 内容域 4.1–4.5** 已落地；下一步为文件/小册 ZIP
> 最后更新：2026-09-08

---

## 产品定位

**不是单纯个人网站，而是"个人知识中台 + 内容管理平台 + AI 工具箱"**

- **核心主线**：AI 工具平台（对话、文本生成、图片生成、视频生成）
- **知识内容中心**：独立知识阅读区，同时作为 AI 工具的输入源与素材库
- **后台管理**：菜单、角色、权限、内容、系统配置的统一管理
- **多端扩展**：Web + Flutter App，共用同一套后端 API

---

## 整体站点结构

```
整个系统
├── 公开前台          ← 对外展示，部分内容需登录才可查看
├── 登录后工作区      ← 登录用户专属功能区（按角色呈现不同能力）
└── 后台管理台        ← 菜单/角色/权限/内容/系统配置管理
```

---

## 当前实施路线补充：React-first

长期产品范围和后端架构保持不变：后端仍按 **NestJS + PostgreSQL + Redis** 推进，工程仍使用 **pnpm + Turborepo**，共享类型仍沉淀到 `packages/`。

当前阶段新增一条前端实施路线：

- 先在 `apps/user-web`（用户端）与 `apps/admin-web`（管理端）中完整克隆并改造 Ant Design Pro，使用 React / Umi / Ant Design / Pro Components 快速完成首版 Web 功能。
- 后端未完成前，React 端通过 mock 数据已跑通公开前台、工作区、内容阅读、内容生产、后台运营与 AI 工具体验。
- 后续接入同一套 NestJS API。
- 再将首页、内容中心、内容阅读、项目页、关于我等适合 SEO 的页面逐步抽到 Next.js 15 中重写。

React-first 相关文档见 [react-first/README.md](./react-first/README.md)。这组文档是实施路线补充，不替代下方产品与长期架构文档。

> 进度：阶段 0-5 已完成；**阶段 5.5 Next API Bridge 已确认跳过**。Nest **M4 内容域已落地**；下一阶段为文件/小册（ZIP、对象存储）。进度台账见 [completed/README.md](./completed/README.md)。

---

## 子文档目录

> 各目录「放什么 / 不放什么」见 [README.md](./README.md)。

### 基础架构与选型

| 文档                                                                                 | 内容                                          | 状态        |
| ------------------------------------------------------------------------------------ | --------------------------------------------- | ----------- |
| [foundation/tech-stack.md](./foundation/tech-stack.md)                               | 技术栈选型与架构决策                          | ✅ 已确定   |
| [foundation/architecture.md](./foundation/architecture.md)                           | 项目架构图与请求链路说明                      | ✅ 已完成   |
| [history/nest-backend-architecture.md](./history/nest-backend-architecture.md)       | Nest 早期架构决策（仅供追溯，不作为实现依据） | 📚 历史资料 |
| [history/nest-fastify-stage0-retrospective.md](./history/nest-fastify-stage0-retrospective.md) | Fastify 阶段 0 排障与 Express 迁移背景（仅供追溯） | 📚 历史资料 |
| [foundation/framework-recommendations.md](./foundation/framework-recommendations.md) | 项目框架推荐与取舍分析                        | ✅ 已完成   |

### React-first 阶段实施路线

| 文档                                                         | 内容                                         | 状态                      |
| ------------------------------------------------------------ | -------------------------------------------- | ------------------------- |
| [react-first/README.md](./react-first/README.md)             | 用户端 / 管理端拆分后的索引入口              | ✅ 已确定                 |
| [../apps/user-web/docs/README.md](../apps/user-web/docs/README.md) | 用户端应用文档                               | ✅ 已迁入 app             |
| [../apps/admin-web/docs/README.md](../apps/admin-web/docs/README.md) | 管理端应用文档                               | ✅ 已迁入 app             |
| [history/react-first-strategy.md](./history/react-first-strategy.md) | 决策背景（历史）                             | 📚 历史资料               |
| [history/react-first-architecture.md](./history/react-first-architecture.md) | 当时单应用边界（历史）                       | 📚 历史资料               |
| [history/react-first-roadmap.md](./history/react-first-roadmap.md) | 阶段 0-5 路线图（历史）                      | 📚 历史资料               |

### 产品与业务模块

| 文档                                                       | 内容                                                      | 状态      |
| ---------------------------------------------------------- | --------------------------------------------------------- | --------- |
| [product/frontend-public.md](./product/frontend-public.md) | 公开前台页面结构与功能                                    | ✅ 已完成 |
| [product/workspace.md](./product/workspace.md)             | 登录后工作区功能                                          | ✅ 已完成 |
| [product/admin.md](./product/admin.md)                     | 后台管理台模块与详细设计                                  | ✅ 已完成 |
| [product/auth-rbac.md](./product/auth-rbac.md)             | 用户、登录、角色与权限体系（已与 Canonical 后端契约同步） | ✅ 已完成 |
| [product/content-system.md](./product/content-system.md)   | 知识内容模型、格式与导入（已与 Canonical 后端契约同步）   | ✅ 已完成 |
| [product/ai-tools.md](./product/ai-tools.md)               | AI 工具平台功能与接入策略（已与 Canonical 后端契约同步）  | ✅ 已完成 |
| [product/flutter.md](./product/flutter.md)                 | Flutter App 范围与接入                                    | 📋 范围已定，实施后置 |

### 后端接口与数据

| 文档                                                                 | 内容                                         | 状态        |
| -------------------------------------------------------------------- | -------------------------------------------- | ----------- |
| [backend/conventions.md](./backend/conventions.md)                   | Nest 工程约定（stub → `apps/server/docs`） | ✅ 当前权威 |
| [../apps/server/docs/conventions.md](../apps/server/docs/conventions.md) | Nest 工程、事务、Redis、队列、安全、测试约定 | ✅ 当前权威 |
| [backend/canonical-api.md](./backend/canonical-api.md)               | Canonical Nest API 契约                      | ✅ 当前权威 |
| [backend/canonical-data-model.md](./backend/canonical-data-model.md) | Canonical PostgreSQL / Prisma 数据模型       | ✅ 当前权威 |
| [backend/react-mock-migration.md](./backend/react-mock-migration.md) | React Mock 到真实 Nest API 对照              | ✅ 当前权威 |

> Nest 实施顺序：先读 [apps/server/docs/conventions.md](../apps/server/docs/conventions.md)、Canonical API/数据模型、对应 `prd/long-term/` 领域 PRD 与 [Nest 依赖目录](../apps/server/docs/nest-dependency-catalog.md)；产品文档说明功能与 UI，不单独定义后端 DTO、密码算法、会话、权限或部署实现。

### 工程与实施

| 文档                                                                               | 内容                                               | 状态        |
| ---------------------------------------------------------------------------------- | -------------------------------------------------- | ----------- |
| [engineering/engineering-guide.md](./engineering/engineering-guide.md)             | 工程开发指南（环境/目录/规范）                     | ✅ 已完成   |
| [engineering/git-commit-convention.md](./engineering/git-commit-convention.md)     | Git 提交入口（stub → `.agents/skills/git-commit`） | ✅ 已迁移   |
| [../.agents/skills/git-commit/SKILL.md](../.agents/skills/git-commit/SKILL.md)     | Git 提交权威规范（跨工具 skill）                   | ✅ 已完成   |
| [../.agents/skills/tsx-structure/SKILL.md](../.agents/skills/tsx-structure/SKILL.md) | TSX 方法放置（纯函数上提 / 长回调具名）            | ✅ 已完成   |
| [engineering/dev-credentials.md](./engineering/dev-credentials.md)                 | 本地常用信息：账号、端口、Compose、Mailpit         | ✅ 已确定   |
| [history/development-plan.md](./history/development-plan.md)                       | React-first 历史执行手册                           | 📚 历史资料 |
| [history/mvp-roadmap.md](./history/mvp-roadmap.md)                                 | MVP 历史排期与阶段目标                             | 📚 历史资料 |
| [../apps/server/docs/nest-dependency-catalog.md](../apps/server/docs/nest-dependency-catalog.md) | Nest 依赖目录、组合边界与版本锁定                  | ✅ 已确定   |
| [engineering/agent-file-templates.md](./engineering/agent-file-templates.md)       | 目录级 AGENT.md 模板                               | ✅ 已完成   |

### 开发沉淀

| 文档                                                                                                           | 内容                                     | 状态      |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | --------- |
| [completed/README.md](./completed/README.md)                                                                   | 已完成功能进度台账（阶段状态与验收入口） | ✅ 已完成 |
| [implementation/README.md](./implementation/README.md)                                                         | 功能开发文档固定归档规则                 | ✅ 已完成 |
| [implementation/admin-web-split.md](./implementation/admin-web-split.md)                                       | 用户端 / 管理端拆分与跨 Origin 会话      | ✅ 已完成 |
| [../apps/server/docs/README.md](../apps/server/docs/README.md)                                                 | Nest 实现：阶段 0 / Auth / M3 系统配置 / M4 内容域   | ✅ 已完成 |
| [../apps/user-web/docs/README.md](../apps/user-web/docs/README.md)                                           | 用户端实现说明                           | ✅ 已完成 |
| [../apps/admin-web/docs/README.md](../apps/admin-web/docs/README.md)                                           | 管理端实现说明                           | ✅ 已完成 |

### PRD 细化

> **索引入口**：[prd/README.md](./prd/README.md)（区分 React-first 与长期全栈）

| 文档                                                                                                   | 内容                                                       | 状态                                   |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | -------------------------------------- |
| [prd/README.md](./prd/README.md)                                                                       | PRD 总索引（React-first / 长期全栈）                       | ✅ 已完成                              |
| [prd/module-prd-index.md](./prd/module-prd-index.md)                                                   | 大模块 PRD 细化索引                                        | ✅ 已完成                              |
| [prd/react-first/README.md](./prd/react-first/README.md)                                               | React-first 阶段 PRD 子索引                                | ✅ 已完成                              |
| [prd/long-term/nest-server-bootstrap-prd.md](./prd/long-term/nest-server-bootstrap-prd.md)             | stub → `apps/server/docs/prd` | ✅ 已完成 |
| [../apps/server/docs/prd/nest-server-bootstrap-prd.md](../apps/server/docs/prd/nest-server-bootstrap-prd.md) | `apps/server` 脚手架 PRD | ✅ 已完成 |
| [prd/long-term/README.md](./prd/long-term/README.md)                                                   | Auth、内容、文件、AI、治理等长期后端 PRD 完整索引           | ✅ 当前权威入口                         |
| [prd/long-term/nest-backend-requirements.md](./prd/long-term/nest-backend-requirements.md)             | React 功能到 Canonical Nest 后端需求总览                   | ✅ 已确定                              |
| [prd/react-first/bootstrap-prd.md](./prd/react-first/bootstrap-prd.md)                                 | stub → 用户端工程初始化 PRD | ✅ 已实施                              |
| [../apps/user-web/docs/prd/bootstrap-prd.md](../apps/user-web/docs/prd/bootstrap-prd.md)             | 工程初始化 PRD                                             | ✅ 已实施                              |
| [prd/react-first/phase-0-3-foundation-prd.md](./prd/react-first/phase-0-3-foundation-prd.md)           | stub → 阶段 0-3                                            | ✅ 已实施                              |
| [../apps/user-web/docs/prd/phase-0-3-foundation-prd.md](../apps/user-web/docs/prd/phase-0-3-foundation-prd.md) | 阶段 0-3 基础与首版页面 PRD                                | ✅ 已实施                              |
| [prd/react-first/phase-4-admin-preview-prd.md](./prd/react-first/phase-4-admin-preview-prd.md)         | stub → 管理端阶段 4                                        | ✅ 阶段 4/4.5 本轮完成                 |
| [../apps/admin-web/docs/prd/phase-4-admin-preview-prd.md](../apps/admin-web/docs/prd/phase-4-admin-preview-prd.md) | 阶段 4：后台运营 + PDF/Word 预览                           | ✅ 阶段 4/4.5 本轮完成                 |
| [prd/react-first/phase-5-ai-platform-prd.md](./prd/react-first/phase-5-ai-platform-prd.md)             | stub → 用户端阶段 5                                        | ✅ 已完成本轮收尾                      |
| [../apps/user-web/docs/prd/phase-5-ai-platform-prd.md](../apps/user-web/docs/prd/phase-5-ai-platform-prd.md) | 阶段 5：AI 独立工作台 + mock                               | ✅ 已完成本轮收尾                      |
| [prd/react-first/phase-5-5-next-api-bridge-prd.md](./prd/react-first/phase-5-5-next-api-bridge-prd.md) | Next API Bridge 过渡后端方案                               | ⏭️ 已跳过（直接走 Nest）               |
| [prd/react-first/theme-navigation-config-prd.md](./prd/react-first/theme-navigation-config-prd.md)     | stub → 主题与导航                                          | 🟡 首版已够用；剩余项后置               |
| [../apps/user-web/docs/prd/theme-navigation-config-prd.md](../apps/user-web/docs/prd/theme-navigation-config-prd.md) | 主题与导航配置 PRD                                         | 🟡 首版已够用；剩余项后置               |
| [prd/react-first/frontend-visual-spec.md](./prd/react-first/frontend-visual-spec.md)                   | stub → 前台视觉规范                                        | ✅ 已确定                              |
| [../apps/user-web/docs/prd/frontend-visual-spec.md](../apps/user-web/docs/prd/frontend-visual-spec.md) | 前台视觉规范（首版决策）                                   | ✅ 已确定                              |
| [prd/react-first/content-reading-prd.md](./prd/react-first/content-reading-prd.md)                     | stub → 内容阅读                                            | ✅ 已完成                              |
| [../apps/user-web/docs/prd/content-reading-prd.md](../apps/user-web/docs/prd/content-reading-prd.md) | Markdown 与掘金小册阅读 PRD                                | ✅ 已完成                              |
| [prd/react-first/content-workspace-prd.md](./prd/react-first/content-workspace-prd.md)                 | stub → 内容工作区                                          | ✅ 已完成                              |
| [../apps/user-web/docs/prd/content-workspace-prd.md](../apps/user-web/docs/prd/content-workspace-prd.md) | 内容工作区 PRD                                             | ✅ 已完成                              |
| [history/admin-content-config-prd.md](./history/admin-content-config-prd.md)                           | 后台内容与配置字段决策（仅供追溯）                         | 📚 历史资料                            |
| [prd/long-term/ai-tools-prd.md](./prd/long-term/ai-tools-prd.md)                                       | AI 工具平台 PRD（长期）                                    | ✅ 已完成                              |

### 部署与运维

| 文档                                                                     | 内容                                                           | 状态        |
| ------------------------------------------------------------------------ | -------------------------------------------------------------- | ----------- |
| [deploy/README.md](./deploy/README.md)                                   | 部署文档总入口                                                 | ✅ 已完成   |
| [deploy/deployment-plan.md](./deploy/deployment-plan.md)                 | 阶段 A 部署计划；Nest B/C 已迁移到 Compose 策略                | 🟡 部分历史 |
| [deploy/pm2-deployment.md](./deploy/pm2-deployment.md)                   | PM2 部署权威（阶段 A：dev + mock）                             | ✅ 已完成   |
| [deploy/server-deployment-guide.md](./deploy/server-deployment-guide.md) | React mock + PM2 一页速查（不适用于 Nest）                     | ✅ 已完成   |
| [deploy/personal-remote-reading.md](./deploy/personal-remote-reading.md) | 个人远程阅读细节（阶段 A/B、COS、缓存）                        | ✅ 已完成   |
| [deploy/deployment.md](./deploy/deployment.md)                           | 长期生产（Docker / CI/CD）                                     | ✅ 已完成   |
| [deploy/nest-compose-strategy.md](./deploy/nest-compose-strategy.md)     | Nest Compose、COS 对象存储、数据库备份、健康检查与手工发布策略 | ✅ 已确定   |

> 原 `docs/operations/` 已更名为 `docs/deploy/`。

---

## 学习资料目录

| 文档                                                                                               | 内容                         | 状态      |
| -------------------------------------------------------------------------------------------------- | ---------------------------- | --------- |
| [../study/README.md](../study/README.md)                                                           | 学习资料总入口               | ✅ 已完成 |
| [../study/features/README.md](../study/features/README.md)                                         | 功能学习文档固定归档规则     | ✅ 已完成 |
| [../study/interview/README.md](../study/interview/README.md)                                       | 项目面试题与模块化问答       | ✅ 已完成 |
| [../study/features/nest-auth-login-slice.md](../study/features/nest-auth-login-slice.md)           | Nest 登录切片与 Refresh Cookie | ✅ 已完成 |
| [../study/features/nest-auth-permissions.md](../study/features/nest-auth-permissions.md)           | Nest 权限快照、菜单过滤与 routeKey | ✅ 已完成 |
| [../study/features/nest-auth-register.md](../study/features/nest-auth-register.md)                 | Nest 注册、邮件链接验证与验证赠额 | ✅ 已完成 |
| [../study/features/nest-auth-captcha-sessions-password.md](../study/features/nest-auth-captcha-sessions-password.md) | Nest 验证码、设备会话与强制改密 | ✅ 已完成 |
| [../study/features/nest-system-config-menu.md](../study/features/nest-system-config-menu.md) | Nest 类型化配置、公开导航与 HTTP 幂等 | ✅ 已完成 |
| [../study/features/nest-http-adapter-comparison.md](../study/features/nest-http-adapter-comparison.md) | Express / Fastify 选型比较 | ✅ 已完成 |
| [../study/features/nest-stage0-retrospective.md](../study/features/nest-stage0-retrospective.md)   | Nest 阶段 0 问题与排障复盘   | ✅ 已完成 |
| [../study/interview/nest-phase-0-bootstrap.md](../study/interview/nest-phase-0-bootstrap.md)       | Nest 阶段 0 面试题          | ✅ 已完成 |
| [../study/frontend-to-fullstack-learning-path.md](../study/frontend-to-fullstack-learning-path.md) | 前端转全栈学习路径           | ✅ 已完成 |
| [../study/local-environment-setup-handbook.md](../study/local-environment-setup-handbook.md)       | 本地环境准备手册             | ✅ 已完成 |
| [../study/nextjs-learning-handbook.md](../study/nextjs-learning-handbook.md)                       | Next.js 学习手册             | ✅ 已完成 |
| [../study/nestjs-learning-handbook.md](../study/nestjs-learning-handbook.md)                       | NestJS 学习手册              | ✅ 已完成 |
| [../study/prisma-postgres-learning-handbook.md](../study/prisma-postgres-learning-handbook.md)     | Prisma + PostgreSQL 学习手册 | ✅ 已完成 |
| [../study/monorepo-docker-learning-handbook.md](../study/monorepo-docker-learning-handbook.md)     | Monorepo + Docker 学习手册   | ✅ 已完成 |
| [../study/system-design-thinking.md](../study/system-design-thinking.md)                           | 系统设计思考清单             | ✅ 已完成 |
| [../study/technology-learning-map.md](../study/technology-learning-map.md)                         | 项目技术学习地图             | ✅ 已完成 |

---

## 当前开发主线（2026-09-07）

1. **已落地**：Nest **M2 Auth HTTP** 第 1–8 刀；**M3 系统配置与菜单** 3.1–3.3；**M4 内容域** 4.1–4.5（公开阅读、工作区 Markdown/外链/项目、收藏与进度、后台分类/精选）。Web 已拆为用户端 `:8000` 与管理端 `:8001`。本地前端默认 `MOCK=none`。失败 toast 已读 Nest `error.message`。
2. **接下来**：Nest **文件/小册**（MinIO/`file_assets`、ZIP 导入、章节正文、封面真文件）。本地 71 本小册继续只走 `dev:user:mock`。
3. **明确跳过**：阶段 5.5 Next API Bridge。
4. **明确后置**：改邮箱、TOTP、真实 SMTP、后台禁用/改角色/额度、主题与导航剩余 UI、域名与站点名、Flutter。

---

## 待讨论 / 待确认清单

- [x] 登录后工作区完整功能拆解（见 `product/workspace.md`）
- [x] 后台管理台框架选型确认（见 `product/admin.md` → 当前 `apps/admin-web`，长期仍用 Ant Design Pro）
- [x] AI 各工具页具体交互与参数设计（见 `product/ai-tools.md`）
- [x] Token 计费体系设计（见 `prd/long-term/ai-tools-prd.md` + `backend/canonical-data-model.md` → AI 额度账本）
- [x] 第三方登录扩展方案（见 `product/auth-rbac.md` → GitHub OAuth 预留）
- [x] 数据库逻辑模型与完整表结构（见 `backend/canonical-data-model.md`）
- [x] 完整 API 接口清单（见 `backend/canonical-api.md`）
- [x] 开发排期（见 `history/mvp-roadmap.md` → 历史阶段 0-8）
- [x] 项目/作品页内容优先级（见 `product/frontend-public.md`）
- [x] 工程环境搭建与开发规范（见 `engineering/engineering-guide.md`）
- [x] 主题与导航配置 PRD（见 `prd/react-first/theme-navigation-config-prd.md` → 主题色、导航位置、预留配置）
- [x] 前台视觉设计细节（见 `prd/react-first/frontend-visual-spec.md` → 首版沿用 Ant Design + tokens）
- [x] 管理员初始账号密码约定（见 `engineering/dev-credentials.md` → Nest 用 `seed:local-users`；mock 另表；生产 bootstrap 另行设置）
- [x] Nest 阶段 0 自动化质量收口：Testcontainers、readiness 故障自动化与 server CI（见 `prd/long-term/nest-server-bootstrap-prd.md` §5.1）
- [x] 阶段 5.5 Next API Bridge：已确认跳过，直接走 Nest
- [x] Nest M2 Auth 第 1–8 刀：登录、权限菜单、注册验证、验证码、设备会话、强制改密、忘记密码、后台踢全部设备（见 [implementation/auth/README.md](./implementation/auth/README.md)）。改邮箱 / TOTP / 真实 SMTP / 禁用改角色仍后置。
- [x] Nest M3 系统配置与菜单 3.1–3.3（见 [apps/server/docs/implementation/system/README.md](../apps/server/docs/implementation/system/README.md)）。Logo 真文件、左/右导航 UI 仍后置。About Markdown 已由系统配置中心 `site.about` 接线。
- [x] Nest M4 内容域 4.1–4.5（见 [apps/server/docs/implementation/content/README.md](../apps/server/docs/implementation/content/README.md)）。ZIP、封面真文件、章节正文仍后置。

### 后置待办（不阻塞文件/小册域）

- [ ] 域名与站点名称最终确认（开发期使用 `http://localhost:8000`；站点名已可由 Nest `system_configs` 改）
- [ ] 主题与导航剩余 UI：公开区左/右导航布局、后台主题表单补齐（Logo 文件 / SEO / 功能开关 / 预览）（见 `prd/react-first/theme-navigation-config-prd.md`）
- [ ] Flutter App（Web 主链路稳定后再补 `prd/long-term/flutter-app-prd.md`）
