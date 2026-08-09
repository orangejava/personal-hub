# React-first 路线决策说明

> 状态：✅ 已确认并作为当前 React-first 实施边界执行
> 最后更新：2026-06-27
> 目标：说明为什么先用 React/Umi/Ant Design Pro 做完整 Web 版，以及后续如何平滑迁移部分功能到 Next.js 15。

---

## 1. 一句话结论

当前阶段先在 `apps/react-web` 中用 React + Umi + Ant Design Pro 快速完成完整 Web 功能；后端长期仍使用 NestJS + PostgreSQL + Redis；后续将公开前台、内容阅读等需要 SEO 和服务端渲染的页面抽到 Next.js 15 中重写。

---

## 2. 决策背景

现有长期规划选择 Next.js 15，是因为项目包含内容展示、公开前台、阅读页、项目页和关于页，这些页面天然适合 SSR / SSG / ISR。

但当前阶段开发者更熟悉 React 单页应用开发。相比一开始同时学习 Next.js App Router、NestJS、Prisma、Redis 和部署体系，先用 React 工程快速完成业务全貌，可以更快建立产品闭环：

- 页面结构先跑通。
- 业务状态先跑通。
- 权限和菜单先跑通。
- 内容、工作区和基础权限交互先跑通，后台完整 CRUD 与 AI 工具后续阶段再做。
- API 契约先通过 mock 固化。
- 后续接 NestJS 时有清楚的前端调用方和数据形状。

---

## 3. 不变的长期架构

React-first 不改变这些长期结论：

| 维度 | 长期结论 |
|---|---|
| 后端 API | NestJS + Express + Swagger |
| 数据库 | PostgreSQL 16 |
| 缓存 | Redis 7 |
| ORM | Prisma |
| 工程组织 | pnpm + Turborepo |
| 共享类型 | `packages/shared-types` |
| 移动端 | Flutter 后置接入，复用同一套 NestJS API |
| AI 接入 | 前端不直连厂商 API，最终都走 NestJS 代理层 |

---

## 4. React-first 的边界

React-first 阶段重点是“把业务体验完整做出来”，不是替代最终架构。

### 4.1 首版要做

- 完成公开前台、工作区、后台管理台的主要页面。
- 使用 Ant Design Pro 提供的 Layout、权限、菜单、请求和 mock 能力快速起步。
- 在 `packages/shared-types` 中沉淀业务类型、枚举、分页结构和接口响应结构。
- 通过 mock 数据模拟内容、用户、权限、系统配置等核心数据；AI 会话等数据后续阶段再补。
- 提前统一主题、全局样式、基础动画、布局密度和组件边界。

### 4.2 首版暂不做

- 不在 React 工程中实现真实后端业务逻辑。
- 不在前端保存真实 AI API Key。
- 不把 mock 写成无法替换的页面内临时数据。
- 不为每个页面单独发明接口结构。
- 不为了快速开发破坏共享 types 和模块边界。

---

## 5. 为什么选择完整克隆 Ant Design Pro

确认采用完整克隆 `ant-design/ant-design-pro` 后改造，而不是从零手写 Umi 工程。

主要原因：

- Ant Design Pro 已经提供管理系统常见的 Layout、菜单、权限、请求、登录和 mock 示例。
- 项目后台管理台本身大量依赖表格、表单、筛选、弹窗和配置页，ProTable / ProForm 适配度高。
- Umi 的路由、mock、运行时配置和权限模型可以减少首版搭建成本。
- 完整克隆后再删改，比从零拼装更容易看到官方推荐的组织方式。

注意：克隆模板只是起点。后续需要清理示例页面，替换成 personal-hub 的业务模块，不能长期保留模板示例代码污染项目。

---

## 6. 后续 Next.js 抽离策略

Next.js 不在首版消失，而是后续按价值逐步抽离。

### 6.1 优先抽到 Next.js 的页面

| 页面 | 原因 |
|---|---|
| 首页 `/` | 品牌展示、首屏体验、SEO |
| 内容中心 `/content` | 公开内容列表需要搜索收录 |
| 内容阅读 `/content/:id` | Markdown、小册、项目文章适合 SSR / SSG |
| 项目 / 作品 `/projects` | 对外展示，适合 SEO |
| 关于我 `/about` | 对外展示，适合静态生成 |

### 6.2 可以长期留在 React/Umi 的页面

| 页面 | 原因 |
|---|---|
| 后台管理台 `/admin/*` | 强交互、弱 SEO、Ant Design Pro 适合 |
| 工作区 `/workspace/*` | 登录后功能，SEO 不重要 |
| AI 工具页 `/ai/chat`、`/ai/text`、`/ai/image` | 强交互、流式状态复杂 |

### 6.3 迁移时要共享的内容

- `packages/shared-types`：类型、枚举、Zod Schema。
- `packages/api-client`：未来可选，请求方法和接口契约。
- `packages/config`：主题 token、菜单常量、权限点。
- `packages/mock-data`：开发期 mock 数据，可供 React 和 Next 同时使用。

---

## 7. 关键风险与规避

| 风险 | 规避方式 |
|---|---|
| React 版写成一次性代码，后续无法迁移 | 业务类型、接口契约、权限点、菜单配置前置到 packages |
| mock 数据散落在页面中 | 统一放到 mock/service/data 层，页面只调用服务函数 |
| Ant Design 样式侵入公开前台 | 前台页面做轻量品牌化封装，后台和工作区可以更 Pro 化 |
| 后续 Next.js 重写成本过高 | 公开前台组件尽量拆出纯展示组件，避免绑定 Umi 运行时 |
| 后端接入时接口不一致 | mock 从第一天按 NestJS 未来 API 形状设计 |
