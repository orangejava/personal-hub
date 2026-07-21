# 项目总纲索引

> 个人知识平台 + AI 工具中台
> 状态：阶段 5 AI 平台 mock 闭环已完成本轮收尾
> 最后更新：2026-07-06

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

- 先在 `apps/react-web` 中完整克隆并改造 Ant Design Pro，使用 React / Umi / Ant Design / Pro Components 快速完成首版 Web 功能。
- 后端未完成前，React 端通过 mock 数据已跑通公开前台、工作区、内容阅读、内容生产、后台运营与 AI 工具体验。
- 后续接入同一套 NestJS API。
- 再将首页、内容中心、内容阅读、项目页、关于我等适合 SEO 的页面逐步抽到 Next.js 15 中重写。

React-first 相关文档见 [react-first/README.md](./react-first/README.md)。这组文档是实施路线补充，不替代下方产品与长期架构文档。

> 进度：阶段 0-5 已完成；**阶段 5 AI 平台 mock 闭环已完成本轮收尾**。进度台账见 [../completed/README.md](../completed/README.md)。

---

## 子文档目录

### 基础架构与选型

| 文档 | 内容 | 状态 |
| --- | --- | --- |
| [foundation/tech-stack.md](./foundation/tech-stack.md) | 技术栈选型与架构决策 | ✅ 已确定 |
| [foundation/architecture.md](./foundation/architecture.md) | 项目架构图与请求链路说明 | ✅ 已完成 |
| [foundation/framework-recommendations.md](./foundation/framework-recommendations.md) | 项目框架推荐与取舍分析 | ✅ 已完成 |

### React-first 阶段实施路线

| 文档 | 内容 | 状态 |
| --- | --- | --- |
| [react-first/README.md](./react-first/README.md) | React-first 路线总入口 | ✅ 已确定 |
| [react-first/strategy.md](./react-first/strategy.md) | 决策背景、边界与 Next.js 抽离策略 | ✅ 已确定 |
| [react-first/architecture.md](./react-first/architecture.md) | React-first Monorepo 与应用边界 | ✅ 已确定 |
| [react-first/frontend-app.md](./react-first/frontend-app.md) | `apps/react-web` 应用结构与改造规则 | ✅ 已确定 |
| [react-first/foundation.md](./react-first/foundation.md) | 主题、布局、权限、请求、mock、组件等基础设施 | ✅ 已确定 |
| [react-first/mock-data.md](./react-first/mock-data.md) | mock 数据与接口契约 | ✅ 已确定 |
| [react-first/roadmap.md](./react-first/roadmap.md) | React-first 阶段开发路线图 | ✅ 阶段 0-5 mock 闭环完成 |

### 产品与业务模块

| 文档 | 内容 | 状态 |
| --- | --- | --- |
| [product/frontend-public.md](./product/frontend-public.md) | 公开前台页面结构与功能 | ✅ 已完成 |
| [product/workspace.md](./product/workspace.md) | 登录后工作区功能 | ✅ 已完成 |
| [product/admin.md](./product/admin.md) | 后台管理台模块与详细设计 | ✅ 已完成 |
| [product/auth-rbac.md](./product/auth-rbac.md) | 用户、登录、角色与权限体系 | ✅ 已完成 |
| [product/content-system.md](./product/content-system.md) | 知识内容模型、格式与导入 | ✅ 已完成 |
| [product/ai-tools.md](./product/ai-tools.md) | AI 工具平台功能与接入策略 | ✅ 已完成 |
| [product/flutter.md](./product/flutter.md) | Flutter App 范围与接入 | ✅ 已完成 |

### 后端接口与数据

| 文档 | 内容 | 状态 |
| --- | --- | --- |
| [backend/database.md](./backend/database.md) | 数据库表结构与 Prisma Schema | ✅ 已完成 |
| [backend/api.md](./backend/api.md) | 完整 API 接口清单 | ✅ 已完成 |

### 工程与实施

| 文档 | 内容 | 状态 |
| --- | --- | --- |
| [engineering/engineering-guide.md](./engineering/engineering-guide.md) | 工程开发指南（环境/目录/规范） | ✅ 已完成 |
| [engineering/git-commit-convention.md](./engineering/git-commit-convention.md) | Git 提交规范与授权原则 | ✅ 已完成 |
| [engineering/dev-credentials.md](./engineering/dev-credentials.md) | 本地 mock 账号与密码 | ✅ 已确定 |
| [engineering/development-plan.md](./engineering/development-plan.md) | 总执行手册（边开发边学习） | ✅ 已完成 |
| [engineering/mvp-roadmap.md](./engineering/mvp-roadmap.md) | MVP 开发排期与各阶段目标 | ✅ 已完成 |
| [engineering/project-bootstrap-prd.md](./engineering/project-bootstrap-prd.md) | 工程骨架搭建 PRD | ✅ 已完成 |
| [engineering/agent-file-templates.md](./engineering/agent-file-templates.md) | 目录级 AGENT.md 模板 | ✅ 已完成 |

### 开发沉淀

| 文档 | 内容 | 状态 |
| --- | --- | --- |
| [implementation/README.md](./implementation/README.md) | 功能开发文档固定归档规则 | ✅ 已完成 |
| [implementation/react-first/phase-0-3.md](./implementation/react-first/phase-0-3.md) | 阶段 0–3 合并实现说明 | ✅ 已完成 |
| [implementation/react-first/phase-0-structure.md](./implementation/react-first/phase-0-structure.md) | 阶段 0 工程骨架实现说明 | ✅ 已完成 |
| [implementation/react-first/phase-1-foundation.md](./implementation/react-first/phase-1-foundation.md) | 阶段 1 基础底座实现说明 | ✅ 已完成 |
| [implementation/react-first/phase-2-public-reading.md](./implementation/react-first/phase-2-public-reading.md) | 阶段 2 公开前台与内容阅读实现说明 | ✅ 已完成 |
| [implementation/react-first/phase-3-workspace.md](./implementation/react-first/phase-3-workspace.md) | 阶段 3 工作区与内容生产实现说明 | ✅ 已完成 |

### PRD 细化

> **索引入口**：[prd/README.md](./prd/README.md)（区分 React-first 与长期全栈）

| 文档 | 内容 | 状态 |
| --- | --- | --- |
| [prd/README.md](./prd/README.md) | PRD 总索引（React-first / 长期全栈） | ✅ 已完成 |
| [prd/module-prd-index.md](./prd/module-prd-index.md) | 大模块 PRD 细化索引 | ✅ 已完成 |
| [prd/react-first/README.md](./prd/react-first/README.md) | React-first 阶段 PRD 子索引 | ✅ 已完成 |
| [prd/long-term/README.md](./prd/long-term/README.md) | 长期全栈 PRD 子索引 | ✅ 已完成 |
| [prd/react-first/bootstrap-prd.md](./prd/react-first/bootstrap-prd.md) | 工程初始化 PRD | ✅ 已实施 |
| [prd/react-first/phase-0-3-foundation-prd.md](./prd/react-first/phase-0-3-foundation-prd.md) | 阶段 0-3 基础与首版页面 PRD | ✅ 已实施 |
| [prd/react-first/phase-4-admin-preview-prd.md](./prd/react-first/phase-4-admin-preview-prd.md) | 阶段 4：后台运营 + PDF/Word 预览；阶段 4.5 体验底座 | ✅ 阶段 4/4.5 本轮完成 |
| [prd/react-first/phase-5-ai-platform-prd.md](./prd/react-first/phase-5-ai-platform-prd.md) | 阶段 5：AI 独立工作台 + mock | ✅ 已完成本轮收尾 |
| [prd/react-first/phase-5-5-next-api-bridge-prd.md](./prd/react-first/phase-5-5-next-api-bridge-prd.md) | Next API Bridge 过渡后端方案 | 🟡 待确认 |
| [prd/react-first/theme-navigation-config-prd.md](./prd/react-first/theme-navigation-config-prd.md) | 主题与导航配置 PRD | 🟡 部分实现（见 frontend-visual-spec） |
| [prd/react-first/frontend-visual-spec.md](./prd/react-first/frontend-visual-spec.md) | 前台视觉规范（首版决策） | ✅ 已确定 |
| [prd/react-first/content-reading-prd.md](./prd/react-first/content-reading-prd.md) | Markdown 与掘金小册阅读 PRD | ✅ 已完成 |
| [prd/react-first/content-workspace-prd.md](./prd/react-first/content-workspace-prd.md) | 内容工作区 PRD | ✅ 已完成 |
| [prd/long-term/admin-content-config-prd.md](./prd/long-term/admin-content-config-prd.md) | 后台内容与配置 PRD（长期字段契约） | ✅ 已完成 |
| [prd/long-term/ai-tools-prd.md](./prd/long-term/ai-tools-prd.md) | AI 工具平台 PRD（长期） | ✅ 已完成 |

### 部署与运维

| 文档 | 内容 | 状态 |
| --- | --- | --- |
| [operations/deployment.md](./operations/deployment.md) | 部署方案（开发/生产/CI/CD） | ✅ 已完成 |
| [operations/server-deployment-guide.md](./operations/server-deployment-guide.md) | 服务器首次上线实操（Git/小册/COS/PM2） | ✅ 已完成 |

---

## 学习资料目录

| 文档 | 内容 | 状态 |
|---|---|---|
| [../study/README.md](../study/README.md) | 学习资料总入口 | ✅ 已完成 |
| [../study/features/README.md](../study/features/README.md) | 功能学习文档固定归档规则 | ✅ 已完成 |
| [../study/frontend-to-fullstack-learning-path.md](../study/frontend-to-fullstack-learning-path.md) | 前端转全栈学习路径 | ✅ 已完成 |
| [../study/local-environment-setup-handbook.md](../study/local-environment-setup-handbook.md) | 本地环境准备手册 | ✅ 已完成 |
| [../study/nextjs-learning-handbook.md](../study/nextjs-learning-handbook.md) | Next.js 学习手册 | ✅ 已完成 |
| [../study/nestjs-learning-handbook.md](../study/nestjs-learning-handbook.md) | NestJS 学习手册 | ✅ 已完成 |
| [../study/prisma-postgres-learning-handbook.md](../study/prisma-postgres-learning-handbook.md) | Prisma + PostgreSQL 学习手册 | ✅ 已完成 |
| [../study/monorepo-docker-learning-handbook.md](../study/monorepo-docker-learning-handbook.md) | Monorepo + Docker 学习手册 | ✅ 已完成 |
| [../study/system-design-thinking.md](../study/system-design-thinking.md) | 系统设计思考清单 | ✅ 已完成 |
| [../study/technology-learning-map.md](../study/technology-learning-map.md) | 项目技术学习地图 | ✅ 已完成 |

---

## 待讨论 / 待确认清单

- [x] 登录后工作区完整功能拆解（见 `product/workspace.md`）
- [x] 后台管理台框架选型确认（见 `product/admin.md` → 确认在 Next.js 内嵌 Ant Design Pro 组件）
- [x] AI 各工具页具体交互与参数设计（见 `product/ai-tools.md`）
- [x] Token 计费体系设计（见 `product/ai-tools.md` + `backend/database.md` → `token_transactions` 表）
- [x] 第三方登录扩展方案（见 `product/auth-rbac.md` → GitHub OAuth 预留）
- [x] 数据库 ER 图与完整表结构（见 `backend/database.md`）
- [x] 完整 API 接口清单（见 `backend/api.md`）
- [x] 开发排期（见 `engineering/mvp-roadmap.md` → 阶段 0-8）
- [x] 项目/作品页内容优先级（见 `product/frontend-public.md`）
- [x] 工程环境搭建与开发规范（见 `engineering/engineering-guide.md`）
- [x] 主题与导航配置 PRD（见 `prd/react-first/theme-navigation-config-prd.md` → 主题色、导航位置、预留配置）
- [x] 前台视觉设计细节（见 `prd/react-first/frontend-visual-spec.md` → 首版沿用 Ant Design + tokens）
- [x] 管理员初始账号密码约定（见 `engineering/dev-credentials.md` → mock 环境；生产 seed 另行设置）
- [ ] 域名与站点名称最终确认（开发期使用 `http://localhost:8000`，站点名暂用 mock 默认）
