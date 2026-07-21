# React-first 实施路线总入口

> 状态：🟢 阶段 0-5 mock 闭环已完成，下一步待确认 API Bridge 或 NestJS 接入
> 最后更新：2026-07-10
> 定位：在不推翻现有 Next.js + NestJS 长期架构的前提下，新增一条 React / Umi / Ant Design Pro 先行的前端落地路线。

---

## 1. 为什么新增这组文档

现有 `docs/` 主体文档仍然描述项目的完整长期目标：

- 前端长期形态：Next.js 15 承担公开前台、工作区、后台管理台中的部分或全部 Web 能力。
- 后端长期形态：NestJS + PostgreSQL + Redis 提供统一 API。
- 工程长期形态：pnpm + Turborepo 管理 Monorepo，共享类型沉淀到 `packages/`。

当前阶段通过 React-first 路线，已利用 React 生态和 Ant Design Pro 模板完成阶段 0-5 mock 体验闭环，覆盖页面、状态、权限、内容阅读、内容生产、后台运营与 AI 工具。后续再逐步接入 NestJS API，并将适合 SSR / SEO 的页面抽到 Next.js 15 中重写。

这组文档只补充“先用 React 做”的实施路线，不删除、不覆盖原有 Next.js 规划。

---

## 2. 当前确认结论

| 项目 | 结论 |
|---|---|
| 首版 Web 实现 | `apps/react-web` |
| 前端模板 | 完整克隆 `ant-design/ant-design-pro` 后改造 |
| 前端框架 | React + Umi Max + Ant Design + Pro Components |
| 工程管理 | pnpm + Turborepo |
| 数据策略 | 首版使用 React 工程内 mock 数据 |
| 后端目标 | 仍是 NestJS + PostgreSQL + Redis，不因 React-first 路线改变 |
| 共享类型 | 提前放到 `packages/shared-types`，供 React、Next、NestJS 后续复用 |
| Next.js 策略 | 后续将公开前台、内容阅读等适合 SEO 的页面逐步抽到 `apps/next-web` |

---

## 3. 文档索引

| 文档 | 作用 |
|---|---|
| [strategy.md](./strategy.md) | React-first 的决策背景、边界和 Next.js 抽离策略 |
| [architecture.md](./architecture.md) | Monorepo 结构、应用边界、共享包、未来后端关系 |
| [frontend-app.md](./frontend-app.md) | `apps/react-web` 的目录、路由、模块拆分和 Ant Design Pro 改造规则 |
| [foundation.md](./foundation.md) | 主题、全局样式、动画、布局、权限、请求、状态、组件、类型等基础设施 |
| [mock-data.md](./mock-data.md) | mock 数据、接口契约、数据目录、未来切换 NestJS API 的方式 |
| [roadmap.md](./roadmap.md) | React-first 阶段开发顺序与验收标准 |
| [../prd/react-first/bootstrap-prd.md](../prd/react-first/bootstrap-prd.md) | React-first 工程初始化 PRD |
| [../prd/react-first/phase-0-3-foundation-prd.md](../prd/react-first/phase-0-3-foundation-prd.md) | 阶段 0-3 一次性实施 PRD |
| [../prd/README.md](../prd/README.md) | PRD 总索引（React-first / 长期） |
| [../prd/react-first/phase-4-admin-preview-prd.md](../prd/react-first/phase-4-admin-preview-prd.md) | 阶段 4/4.5 已实施 PRD |
| [../prd/react-first/phase-5-ai-platform-prd.md](../prd/react-first/phase-5-ai-platform-prd.md) | 阶段 5 AI 平台 mock PRD（已实施） |
| [../prd/react-first/phase-5-5-next-api-bridge-prd.md](../prd/react-first/phase-5-5-next-api-bridge-prd.md) | API Bridge 过渡方案（待确认） |

---

## 4. 与原有文档的关系

原有产品文档继续作为功能范围来源：

- 公开前台：见 [../product/frontend-public.md](../product/frontend-public.md)
- 登录后工作区：见 [../product/workspace.md](../product/workspace.md)
- 后台管理台：见 [../product/admin.md](../product/admin.md)
- 认证与权限：见 [../product/auth-rbac.md](../product/auth-rbac.md)
- 内容系统：见 [../product/content-system.md](../product/content-system.md)
- AI 工具平台：见 [../product/ai-tools.md](../product/ai-tools.md)

React-first 文档只回答“这些功能先如何用 React/Umi/mock 快速落地”，不重新定义产品功能。

---

## 5. 后续开发阅读顺序

进入 React-first 工程开发前，建议按下面顺序阅读：

1. [../overview.md](../overview.md)
2. [./strategy.md](./strategy.md)
3. [./architecture.md](./architecture.md)
4. [./foundation.md](./foundation.md)
5. [./frontend-app.md](./frontend-app.md)
6. [./mock-data.md](./mock-data.md)
7. [./roadmap.md](./roadmap.md)
8. [../prd/react-first/bootstrap-prd.md](../prd/react-first/bootstrap-prd.md)
9. [../prd/react-first/phase-0-3-foundation-prd.md](../prd/react-first/phase-0-3-foundation-prd.md)
10. [../prd/react-first/phase-4-admin-preview-prd.md](../prd/react-first/phase-4-admin-preview-prd.md)
11. [../prd/react-first/phase-5-ai-platform-prd.md](../prd/react-first/phase-5-ai-platform-prd.md)
