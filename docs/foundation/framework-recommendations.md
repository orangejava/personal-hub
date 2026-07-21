# 项目框架推荐与分析

> 状态：✅ 长期推荐已完成；React-first 阶段路线已补充
> 最后更新：2026-06-27
> 适用范围：Web 前台、登录后工作区、后台管理台、后端 API、Flutter App、工程基础设施

---

## 1. 文档目标

这份文档用于回答两个问题：

- 当前项目可以使用哪些框架和工程方案？
- 在已有技术选型已经确认的前提下，为什么推荐这些框架，而不是其他替代方案？

本项目当前已经确认主线技术栈，本文不重新推翻既定选型，而是补充每个框架的使用边界、适用模块、取舍理由和后续扩展策略。

> 阶段性补充：当前实施路线先在 `apps/react-web` 中使用 React + Umi + Ant Design Pro 完成首版 Web 功能，后续再将适合 SEO 的公开页面抽到 Next.js 15。后端、数据库、缓存、Monorepo 和共享类型方案不变。详细见 [../react-first/README.md](../react-first/README.md)。

---

## 2. 当前结论

### 2.1 框架主线无需重新确认

当前项目的长期框架主线已经足够清晰。实施上先走 React-first 路线，再逐步补齐 Next.js 与 NestJS：

| 层级 | 推荐框架 / 方案 | 结论 |
|---|---|---|
| Web 长期应用 | Next.js 15 + React + App Router | ✅ 长期主框架 |
| Web 首版实施 | React + Umi + Ant Design Pro | 🟡 当前阶段先行 |
| Web 样式 | Tailwind CSS v4 | ✅ 主样式方案 |
| 前台 / 工作区 UI | shadcn/ui + Radix UI | ✅ 主 UI 方案 |
| 后台管理 UI | Ant Design v5 + @ant-design/pro-components | ✅ 后台专用 |
| Web 服务端数据 | Next.js Server Component + fetch | ✅ SEO 页面优先 |
| Web 客户端数据 | TanStack Query v5 | ✅ 交互页面优先 |
| Web 客户端状态 | Zustand | ✅ 轻量全局状态 |
| 后端 API | NestJS + Fastify Adapter | ✅ 主后端框架 |
| ORM | Prisma | ✅ 主数据访问层 |
| API 文档 | Swagger / OpenAPI | ✅ 必选 |
| 数据库 | PostgreSQL 16 | ✅ 主数据库 |
| 缓存 | Redis 7 | ✅ 缓存 / 限流 / 会话辅助 |
| 移动端 | Flutter + Riverpod + Dio + go_router | ✅ 后置接入 |
| Monorepo | Turborepo + pnpm workspace | ✅ 工程组织方式 |
| 本地基础设施 | Docker Compose | ✅ 数据库 / Redis / MinIO / Meilisearch |

### 2.2 仍需补充确认，但不阻塞框架选型

检查现有文档后，仍有一些业务级或体验级确认项。它们会影响后续页面细节和配置，不影响当前框架推荐：

| 确认项 | 所在文档 | 是否阻塞框架选型 | 建议处理阶段 |
|---|---|---:|---|
| 前台视觉设计系统：颜色、字体、组件规范 | `docs/overview.md` | 否 | Web 页面开发前 |
| 域名与站点名称最终确认 | `docs/overview.md` | 否 | 部署前 |
| 管理员初始账号密码约定 | `docs/overview.md` | 否 | Seed / 部署前 |
| AI 工具旧版重复内容中的待细化标记 | `docs/product/ai-tools.md` | 否 | 开发 AI 模块前统一清理 |
| 普通会员是否允许上传小册 | `docs/product/workspace.md` | 否 | 内容权限开发前 |
| 注册是否必须邮箱验证、密码策略细则 | `docs/product/auth-rbac.md` | 否 | 认证模块开发前 |
| 第三方登录首版是否启用 | `docs/product/auth-rbac.md` | 否 | OAuth 接入前 |

建议：先按 React-first 文档搭建 `apps/react-web` 与共享类型；进入对应业务模块前，再逐项确认上述细节。

---

## 3. 前端 Web 框架推荐

### 3.1 长期主框架：Next.js 15

**使用范围**：

- 后续公开前台：`/`、`/content`、`/projects`、`/about`
- 后续内容阅读：`/content/:id`
- 可选迁移：部分工作区或 AI 工具页面

React-first 阶段，上述页面先由 `apps/react-web` 实现，用来快速跑通完整业务体验。

**推荐理由**：

- 项目有明显 SEO 需求，公开内容页、关于页、项目页适合使用服务端渲染或静态生成。
- App Router 可以用路由组拆分公开前台、工作区和后台，不需要拆成多个前端工程。
- Server Component 能让 SEO 页面直接在服务端取数，减少首屏客户端请求和 loading 状态。
- 同一个 Next.js 工程可以共享认证、请求封装、类型定义、布局和主题配置。
- 与 Tailwind、shadcn/ui、Ant Design、TanStack Query 的生态兼容度高。

**使用边界**：

- 默认优先使用 Server Component。
- 只有需要浏览器交互、状态、副作用、动画、表单、客户端缓存时，才拆成 Client Component。
- 不建议把所有页面都写成 `'use client'`，否则会浪费 Next.js 的 SEO 和服务端渲染优势。
- 不建议在 Next.js API Routes 中承载核心后端业务，因为本项目已经选择 NestJS 作为统一 API 层，并且 Flutter 也需要复用同一套接口。

**替代方案分析**：

| 替代方案 | 不作为主选的原因 |
|---|---|
| Vite + React | 适合纯 SPA，但公开内容 SEO、服务端渲染、部署一体化能力不如 Next.js |
| Nuxt | 适合 Vue 技术栈，但本项目目标之一是在实战中切换到 React / Next.js 体系 |
| Remix | 数据加载模型优秀，但当前项目文档、学习资料和工程规划已围绕 Next.js 展开 |
| Astro | 适合内容站，但本项目还有工作区、AI 工具、后台管理等复杂交互，不适合作为唯一主框架 |

---

### 3.2 样式框架：Tailwind CSS v4

**使用范围**：

- 公开前台
- 登录后工作区
- shadcn/ui 组件定制
- 轻量共享组件

**推荐理由**：

- 适合快速构建高度定制的个人品牌页面。
- 与 shadcn/ui 深度配合，不会被传统组件库样式锁死。
- 可以通过设计 Token 和 CSS 变量统一主题、圆角、颜色、间距。
- 对响应式布局友好，适合内容卡片、阅读页、工作区布局。

**使用边界**：

- 前台和工作区优先使用 Tailwind。
- 后台 `/admin` 优先使用 Ant Design 组件体系，不强行用 Tailwind 重写后台基础组件。
- 通用颜色、字号、圆角、阴影应沉淀为 CSS 变量或 Tailwind 配置，避免页面级随意散落。

**需要后续确认**：

- 品牌主色和辅助色。
- 字体策略。
- 明暗主题的视觉边界。
- 首页 Hero、内容卡片、阅读页排版规范。

---

### 3.3 前台和工作区 UI：shadcn/ui + Radix UI

**使用范围**：

- 公开前台导航、按钮、卡片、弹窗、Tabs、Dropdown。
- 工作区布局、表单、列表筛选、个人设置。
- AI 工具页中的输入框、消息列表、模型选择、参数面板。

**推荐理由**：

- shadcn/ui 不是传统 npm 黑盒组件库，而是把组件源码复制进项目，方便长期定制。
- Radix UI 负责无障碍交互原语，能减少 Dialog、Dropdown、Tabs 等交互细节踩坑。
- 与 Tailwind CSS 风格一致，适合个人站点的视觉定制。
- 对 Next.js App Router 生态支持成熟。

**使用边界**：

- `components/ui` 目录下的 shadcn/ui 基础组件尽量少做业务改动。
- 业务组件放到 `components/public`、`components/workspace`、`components/shared`。
- 不建议在前台大面积使用 Ant Design，否则容易让个人站点看起来像管理后台。

**替代方案分析**：

| 替代方案 | 不作为主选的原因 |
|---|---|
| Material UI | 组件完整，但视觉风格较重，个人前台定制成本偏高 |
| Chakra UI | 易用，但与 Tailwind / shadcn 组合相比，可复制定制和生态热度略弱 |
| Headless UI | 可用，但 shadcn/ui 已经提供更完整的组件起点 |
| Mantine | 组件丰富，但会引入另一套样式系统，与 Tailwind 主线不够统一 |

---

### 3.4 后台管理 UI：Ant Design + Pro Components

**使用范围**：

- `/admin/users`
- `/admin/roles`
- `/admin/content`
- `/admin/files`
- `/admin/ai/config`
- `/admin/ai/stats`
- `/admin/homepage`
- `/admin/menus`
- `/admin/system`
- `/admin/logs`

**推荐理由**：

- 后台管理的核心是表格、筛选、表单、弹窗、权限操作，Ant Design 和 Pro Components 的效率最高。
- ProTable、ProForm、ProLayout 可以显著减少后台样板代码。
- 管理台视觉不需要像前台一样强品牌化，更重视稳定、信息密度和录入效率。
- React-first 阶段可直接复用 Ant Design Pro 的 Layout、权限、请求和 mock 能力。
- 后续接入 NestJS 后仍共享登录态、请求封装、类型和权限逻辑。

**使用边界**：

- 主要在 `/admin` 路由范围内作为主 UI 框架，工作区也可以适度使用 Pro Components 提高效率。
- 当前阶段确认完整克隆 Ant Design Pro 到 `apps/react-web` 后改造；这属于 Monorepo 内首版 React 应用，不是与主工程割裂的独立后台。
- 不建议把 Ant Design 组件扩散到公开前台，避免视觉割裂。

**替代方案分析**：

| 替代方案 | 不作为主选的原因 |
|---|---|
| 独立部署的 Ant Design Pro 后台 | 管理台能力强，但会增加部署和认证同步成本；当前采用 Monorepo 内 `apps/react-web`，不独立部署 |
| Refine | 后台 CRUD 效率高，但会带来新的抽象体系，当前项目没必要额外引入 |
| React Admin | 更适合标准资源管理后台，本项目需要与 Next.js、RBAC、AI 配置深度整合 |
| shadcn/ui 自建后台 | 视觉统一，但表格、筛选、复杂表单开发成本明显高于 Ant Design |

---

### 3.5 数据获取与状态框架

#### Next.js Server Component + fetch

**适合场景**：

- 首页推荐内容。
- 内容阅读页。
- 关于我。
- 项目 / 作品页。
- SEO 敏感的公开页面。

**理由**：

- 服务端取数更利于 SEO 和首屏渲染。
- 可以减少客户端 loading 闪烁。
- 适合内容展示类页面。

#### TanStack Query v5

**适合场景**：

- 工作区列表。
- 收藏列表。
- AI 历史。
- 用量统计。
- 后台表格数据。
- 需要分页、筛选、缓存、重试、乐观更新的页面。

**理由**：

- 它管理的是“服务端状态”，不是本地 UI 状态。
- 对列表、分页、缓存失效和加载状态处理成熟。
- 能减少重复封装 `isLoading`、`error`、`refetch` 的样板代码。

#### Zustand

**适合场景**：

- 当前登录用户。
- Access Token 的前端辅助状态。
- 当前 AI 会话草稿状态。
- 全局主题或轻量 UI 偏好。

**理由**：

- API 简单，学习成本低。
- 不需要 Redux 那样的样板代码。
- 与 TanStack Query 职责互补：Query 管服务端数据，Zustand 管客户端状态。

**不建议**：

- 不建议用 Zustand 缓存所有接口数据。
- 不建议用 TanStack Query 存放纯前端 UI 状态。
- 不建议引入 Redux Toolkit，除非后续出现非常复杂的跨模块客户端状态编排。

---

### 3.6 表单与校验框架：react-hook-form + zod

**使用范围**：

- 登录 / 注册 / 找回密码。
- 工作区内容编辑。
- 个人资料设置。
- AI 参数表单。
- 后台配置表单。

**推荐理由**：

- react-hook-form 性能好，适合复杂表单。
- zod 可以从 Schema 推导 TypeScript 类型，方便前后端共享。
- 与 shadcn/ui 的 Form 组件配合成熟。
- 后端 NestJS 仍保留 DTO + class-validator，前端 zod 负责用户输入即时反馈。

**使用边界**：

- 前端表单体验校验用 zod。
- 后端请求安全校验仍必须由 NestJS DTO / Pipe 完成。
- 共享枚举、基础类型和部分 Schema 可以放在 `packages/shared-types`，但不要把后端业务逻辑共享给前端。

---

### 3.7 内容渲染与编辑框架

| 场景 | 推荐框架 | 使用理由 |
|---|---|---|
| Markdown 服务端高亮 | Shiki | 代码块 HTML 输出质量高，适合内容页 SSR |
| AI 回复 Markdown | react-markdown + remark-gfm | 适合客户端流式内容逐步渲染 |
| HTML 安全净化 | rehype-sanitize | 渲染用户输入 HTML 前必须净化，降低 XSS 风险 |
| 富文本编辑 | Tiptap | 基于 ProseMirror，扩展性强，适合内容创作 |
| PDF 阅读 | react-pdf / pdfjs-dist | 适合站内 PDF 基础预览、翻页、缩放 |
| Word 预览 | mammoth 或服务端转换方案 | 首版以阅读预览为主，不做复杂在线编辑 |

**注意事项**：

- 公开内容页渲染 HTML 必须有安全净化策略。
- AI 流式回复适合客户端逐步渲染，不适合每个 token 都触发复杂高亮。
- Word 格式在 Web 端只建议做基础预览和下载，复杂编辑成本高，首版不建议投入。

---

### 3.8 数据可视化：Recharts

**使用范围**：

- 工作区用量统计。
- 后台 AI 使用统计。
- Token 消耗趋势。
- 工具消耗占比。

**推荐理由**：

- React 原生组件模型，接入简单。
- 能覆盖折线图、饼图、柱状图等首版统计需求。
- 相比 ECharts 更轻，不需要一开始引入较重配置体系。

**替代方案分析**：

| 替代方案 | 建议 |
|---|---|
| ECharts | 后续如果统计图复杂、交互强，可以再引入 |
| Chart.js | 简单图表可用，但 React 生态体验不如 Recharts 顺滑 |
| D3 | 能力强，但开发成本高，首版不建议直接使用 |

---

## 4. 后端框架推荐

### 4.1 主后端框架：NestJS

**使用范围**：

- 认证与用户体系。
- RBAC 权限。
- 内容管理。
- 文件上传。
- AI 厂商代理。
- Token 配额与使用统计。
- 后台管理接口。
- Flutter 与 Web 共用 API。

**推荐理由**：

- 项目模块多，NestJS 的 Module / Controller / Service 分层能保持结构清晰。
- TypeScript 全栈统一，适合与前端共享类型和枚举。
- Decorator、Guard、Pipe、Interceptor、Filter 对认证、权限、校验、统一响应非常合适。
- Swagger 集成成熟，便于 Web 和 Flutter 共用接口文档。
- 后续接入定时任务、事件总线、缓存、限流都有官方或成熟生态方案。

**使用边界**：

- 核心业务全部放在 NestJS，不放在 Next.js API Routes。
- Controller 只处理协议和参数，业务规则放 Service。
- Guard 做认证和权限，不依赖前端按钮显隐保护数据。
- Module 按业务域拆分，避免一个 `AdminService` 包掉所有后台逻辑。

**替代方案分析**：

| 替代方案 | 不作为主选的原因 |
|---|---|
| Express | 灵活但缺少工程约束，模块变多后容易松散 |
| Fastify 纯框架 | 性能好，但需要自行补齐模块、依赖注入、Swagger、权限结构 |
| Hono | 轻量现代，但对本项目这种完整后台和复杂业务域来说工程约束偏少 |
| Next.js API Routes | 适合轻后端，不适合作为 Web + Flutter 共用的完整 API 中台 |
| tRPC | 类型体验好，但 Flutter 无法直接享受同等收益，跨端 API 文档不如 REST + OpenAPI 通用 |

---

### 4.2 HTTP 适配器：Fastify

**使用范围**：

- NestJS HTTP 层。
- AI SSE 流式输出。
- 普通 REST API。

**推荐理由**：

- 性能优于 Express。
- 对流式响应和高并发接口更友好。
- 与 NestJS 的 `@nestjs/platform-fastify` 可稳定集成。

**使用边界**：

- 文件上传需要注意 Fastify 生态下的 multipart 方案，不直接照搬 Express + multer 示例。
- 中间件和插件接入时优先查 NestJS + Fastify 的组合写法。

---

### 4.3 ORM：Prisma

**使用范围**：

- PostgreSQL 表结构建模。
- Migration。
- Seed 初始化。
- 常规 CRUD。
- 类型安全的数据查询。

**推荐理由**：

- Schema 可读性强，适合从前端转全栈的学习路径。
- 生成的 Client 类型安全，能减少字段名错误。
- Migration 和 Seed 工作流清晰。
- 与 PostgreSQL JSONB、关系建模、索引策略能满足首版需求。

**使用边界**：

- Service 层不要把 Prisma 查询散落到 Controller。
- 复杂统计查询可以使用 Prisma 原生查询能力或 SQL，但要封装在明确的 Repository / Service 方法里。
- 数据库字段和 Prisma 字段命名需要统一约定，避免接口层反复转换。

**替代方案分析**：

| 替代方案 | 不作为主选的原因 |
|---|---|
| TypeORM | NestJS 生态常见，但类型体验和迁移体验不如 Prisma 直观 |
| Drizzle | 类型强、轻量，但当前学习资料和数据库文档已经围绕 Prisma 展开 |
| Sequelize | 生态成熟，但 TypeScript 体验和现代工程体验不如 Prisma |
| 直接 SQL | 控制力最强，但首版开发效率和类型安全不足 |

---

### 4.4 API 文档：Swagger / OpenAPI

**使用范围**：

- REST API 文档。
- DTO 请求参数说明。
- Web 与 Flutter 联调。
- 后台接口调试。

**推荐理由**：

- Flutter 端、Web 端和后端可以围绕同一份接口文档协作。
- 比 tRPC 更适合跨端。
- 对后续自动生成类型或客户端 SDK 也有扩展空间。

**使用边界**：

- 开发环境开放 `/api/docs`。
- 生产环境建议限制访问或加鉴权。
- DTO 字段需要写清楚业务含义，避免文档只有类型没有语义。

---

### 4.5 认证与权限：JWT + Passport + Guard

**使用范围**：

- 邮箱密码登录。
- Access Token / Refresh Token。
- 后续 GitHub / 微信 OAuth。
- RBAC 权限校验。

**推荐理由**：

- JWT 适合 Web 和 Flutter 共用。
- Passport 生态成熟，后续接 OAuth 更顺。
- NestJS Guard 很适合做统一认证、角色、权限点校验。

**使用边界**：

- Access Token 短有效期，Refresh Token 单独存表并支持吊销。
- 权限校验必须在后端完成。
- 前端权限只负责用户体验，不负责安全边界。

**待确认项**：

- 注册是否必须邮箱验证。
- 密码复杂度和重置流程。
- 第三方登录是否进入首版。
- 权限点完整枚举清单。

---

### 4.6 缓存、限流与任务框架

| 能力 | 推荐框架 / 库 | 使用范围 |
|---|---|---|
| Redis 客户端 | ioredis | 会话辅助、缓存、限流计数 |
| Nest 缓存封装 | @nestjs/cache-manager | 统一缓存管理 |
| 限流 | @nestjs/throttler | 登录、注册、AI 试用接口 |
| 定时任务 | @nestjs/schedule | 日志清理、过期 Token 清理、备份辅助 |
| 事件总线 | @nestjs/event-emitter | 内容发布后清缓存、用量记录解耦 |

**推荐理由**：

- 这些能力都属于横切能力，不应散落在业务代码中。
- NestJS 生态可以把它们统一放在 common 或基础模块里。
- 首版可以先做最小接入，避免过早抽象。

---

### 4.7 文件与对象存储框架

| 阶段 | 推荐方案 | 使用理由 |
|---|---|---|
| 首版本地开发 | 本地磁盘存储 | 简单、成本低、便于调试 |
| 生产增强 | MinIO | 兼容 S3 语义，便于后续迁移对象存储 |
| 图片处理 | sharp | 头像压缩、封面裁剪、缩略图生成 |

**使用边界**：

- 业务表中保存文件元数据，不直接把文件二进制放数据库。
- 删除文件前检查是否被内容引用。
- 存储路径、访问 URL、MIME、大小、上传者需要入库。

---

## 5. 移动端框架推荐

### 5.1 主框架：Flutter

**使用范围**：

- 登录 / 注册。
- 内容浏览和阅读。
- 收藏。
- AI Chat / 文本生成。
- 我的用量。
- 个人设置。

**推荐理由**：

- 一套代码覆盖 iOS 和 Android。
- 与 Web 共用 NestJS REST API。
- 适合内容阅读、AI 对话这类跨端一致体验。
- 首版不承接后台管理，能控制移动端复杂度。

**使用边界**：

- Flutter App 是 Web 的移动延伸，不替代 Web 后台。
- 不单独建立移动端专用后端。
- AI 图片生成首版可预留接口，不急着实现。

---

### 5.2 Flutter 配套框架

| 能力 | 推荐框架 | 推荐理由 |
|---|---|---|
| 状态管理 | Riverpod | 声明式、可测试、适合异步状态 |
| 网络请求 | Dio | 拦截器能力强，适合 Token 刷新和统一错误处理 |
| 路由 | go_router | 声明式路由，支持深链接 |
| 本地缓存 | Isar | 性能好，适合最近阅读和历史记录缓存 |
| 安全存储 | flutter_secure_storage | 适合保存 Token |
| PDF 阅读 | flutter_pdfview | 原生性能更稳 |
| Markdown | flutter_markdown | 覆盖移动端基础阅读需求 |
| 图片缓存 | cached_network_image | 降低图片重复加载成本 |

**替代方案分析**：

| 替代方案 | 不作为主选的原因 |
|---|---|
| React Native | 与 Web React 心智接近，但项目已明确选择 Flutter |
| 原生 iOS / Android | 性能和平台能力最强，但个人项目维护成本高 |
| GetX | 上手快，但长期结构约束和可测试性不如 Riverpod |
| Provider | 简单可用，但复杂异步状态下 Riverpod 更稳 |

---

## 6. 工程与基础设施框架推荐

### 6.1 Monorepo：Turborepo + pnpm workspace

**使用范围**：

- `apps/web`
- `apps/api`
- `packages/shared-types`
- 后续 `apps/mobile`

**推荐理由**：

- Web、API、共享类型在同一仓库内协作更方便。
- Turborepo 可以统一执行 build、lint、test。
- pnpm workspace 依赖安装快，磁盘占用低。
- 适合个人项目逐步演进，不需要一开始拆多仓库。

**使用边界**：

- 共享包只放类型、枚举、Schema、工具类型。
- 不把前端组件放进共享包，除非后续明确需要跨多个 Web 应用复用。
- 不把后端业务 Service 共享给前端。

---

### 6.2 本地开发基础设施：Docker Compose

**使用范围**：

- PostgreSQL。
- Redis。
- MinIO。
- Meilisearch。

**推荐理由**：

- 本地环境可复现。
- 数据库和缓存不污染宿主机。
- 与生产服务形态接近。

**使用边界**：

- 开发阶段 Web 和 API 直接在宿主机运行，保留热更新体验。
- MinIO 和 Meilisearch 首版可以可选启动，不作为最小开发依赖。

---

### 6.3 部署框架：Docker Compose + Nginx + GitHub Actions

**使用范围**：

- 个人/初期生产环境。
- 单机部署。
- 自动构建和发布。

**推荐理由**：

- 对个人项目足够稳定，成本低。
- Nginx 负责 HTTPS、反向代理、SSE 关键配置。
- GitHub Actions + SSH 能满足首版 CI/CD。

**后续扩展**：

- 服务压力增加后，再考虑独立数据库、对象存储、搜索服务。
- 多实例部署后，再考虑 Kubernetes，不建议首版直接引入。

---

## 7. 框架使用边界总表

| 模块 | 应使用 | 不建议使用 |
|---|---|---|
| 公开前台 | Next.js RSC + Tailwind + shadcn/ui | 大面积 Ant Design |
| 内容阅读页 | Server Component + Shiki + 安全 HTML 渲染 | 全客户端 SPA 渲染 |
| 工作区 | Client Component + TanStack Query + Zustand + shadcn/ui | 用 Zustand 缓存所有服务端数据 |
| AI 工具页 | Client Component + SSE + TanStack Query | 每个 token 都做复杂 Markdown 高亮 |
| 后台管理台 | Ant Design + Pro Components | 单独起 Ant Design Pro 工程 |
| 后端 API | NestJS + Fastify + Prisma | Next.js API Routes 承载核心业务 |
| 权限控制 | NestJS Guard + RBAC | 只靠前端按钮隐藏 |
| 移动端 | Flutter + Dio + Riverpod | 单独建移动端专用 API |
| 工程组织 | Turborepo + pnpm workspace | 多仓库过早拆分 |
| 首版部署 | Docker Compose + Nginx | 过早引入 Kubernetes |

---

## 8. 候选技术框架全景对比

本节把“能用的框架”先摊开，再说明为什么当前项目最终选择某一套。这样后续如果要替换或扩展，也能知道当初取舍的边界。

### 8.1 Web 主框架

| 框架 | 优点 | 缺点 | 适配度 | 结论 |
|---|---|---|---|---|
| Next.js | SSR / SSG / RSC 能力完整，SEO 友好，App Router 适合按前台、工作区、后台拆路由组，React 生态成熟 | 学习曲线比纯 SPA 高，Server / Client Component 边界需要习惯 | 高 | ✅ 选择 |
| Vite + React | 启动快，心智简单，适合纯前端 SPA 和后台系统 | SEO、服务端渲染、内容站首屏能力需要额外补，公开内容页不占优 | 中 | 不作为主框架 |
| Nuxt | Vue 生态下的 SSR 首选，适合已有 Vue 团队 | 本项目目标之一是切换 React / Next.js 体系，继续 Vue 会削弱学习目标 | 中 | 不选 |
| Remix | 数据加载模型清晰，表单和服务端交互体验好 | 国内资料和团队熟悉度通常不如 Next.js，生态组合与本文档主线不一致 | 中 | 备选 |
| Astro | 内容站性能好，Markdown / 静态内容体验优秀 | 工作区、AI 工具、后台管理等复杂交互较多，单独用 Astro 会割裂工程 | 中 | 可作为纯内容站备选，不作为主框架 |

最终选择 Next.js 的原因：

- 本项目既是内容站，又有工作区、AI 工具和后台管理，不是单纯 SPA。
- Markdown / 掘金小册阅读页需要 SEO、首屏性能和服务端渲染。
- 同一个工程内可以通过 App Router 路由组承载前台、工作区和运营端。

---

### 8.2 前台 / 工作区 UI 框架

| 框架 | 优点 | 缺点 | 适配度 | 结论 |
|---|---|---|---|---|
| shadcn/ui + Radix UI | 可复制源码，可深度定制，适合个人品牌和前台页面，和 Tailwind 配合好 | 不是传统安装即用组件库，部分复杂组件需要自己组合 | 高 | ✅ 选择 |
| Ant Design | 组件完整，表格表单能力强，后台效率高 | 视觉偏后台，前台品牌化成本高 | 中 | 仅用于后台 |
| Material UI | 组件完整，生态成熟 | Material 风格较强，想做个性化前台需要覆盖较多样式 | 中 | 不作为主选 |
| Chakra UI | 易用，API 友好 | 与 Tailwind 主线不完全统一，长期定制和生态热度不如 shadcn/ui | 中 | 备选 |
| Mantine | 组件丰富，功能完整 | 会引入另一套样式系统，与 Tailwind + shadcn/ui 主线重复 | 中 | 备选 |
| Headless UI | 无样式组件，适合完全自定义 | 组件覆盖不如 shadcn/ui 完整，需要更多手写样式和组合 | 中 | 可局部参考 |

最终选择 shadcn/ui + Radix UI 的原因：

- 前台和工作区需要可定制，而不是套一个强风格组件库。
- 后续主题色、圆角、导航位置都需要配置化，shadcn/ui 更容易配合 CSS Variables。
- 复杂后台表格表单交给 Ant Design，不强迫一套 UI 解决所有问题。

---

### 8.3 后台管理 UI 框架

| 框架 | 优点 | 缺点 | 适配度 | 结论 |
|---|---|---|---|---|
| Ant Design + Pro Components | 表格、表单、筛选、布局成熟，后台开发效率高 | 视觉偏运营后台，不适合公开前台 | 高 | ✅ 选择 |
| Ant Design Pro 独立工程 | 后台能力完整，有成熟模板 | 多一个前端工程会增加认证、部署、类型共享和维护成本 | 中 | 不单独起工程 |
| Refine | CRUD 抽象强，适合快速搭管理后台 | 会引入新的资源抽象体系，和当前 Next.js + 自定义 RBAC 结合成本更高 | 中 | 备选 |
| React Admin | 资源管理能力成熟 | 更适合标准数据后台，本项目有较多定制配置和内容工作流 | 中 | 不作为主选 |
| shadcn/ui 自建后台 | 视觉统一，可定制 | ProTable / ProForm 级能力要自己补，后台开发成本高 | 中 | 不作为后台主选 |

最终选择 Ant Design + Pro Components 的原因：

- 运营端核心是效率，不是强视觉表达。
- 用户、角色、内容、文件、AI 配置都高度依赖表格和表单。
- 内嵌在 Next.js 里即可，避免独立后台工程带来的协作成本。

---

### 8.4 CSS 与主题方案

| 方案 | 优点 | 缺点 | 适配度 | 结论 |
|---|---|---|---|---|
| Tailwind CSS | 快速、约束强、响应式方便，适合 shadcn/ui 和主题变量 | 类名较多，需要团队习惯工具类写法 | 高 | ✅ 选择 |
| CSS Modules | Next.js 原生支持，局部样式隔离好 | 组件化效率不如 Tailwind，主题变量和样式组合需要更多手写 | 中 | 可局部使用 |
| Sass / Less | 传统成熟，适合复杂样式组织 | 与 shadcn/ui / Tailwind 主线重复，容易形成两套样式体系 | 中 | 不作为主线 |
| Styled Components | JS 中写样式，动态样式能力强 | SSR 和运行时成本需要关注，与 Tailwind 主线不一致 | 低 | 不选 |
| Vanilla Extract | 类型安全 CSS，适合大型设计系统 | 学习和配置成本更高，首版没必要 | 中 | 后续可评估 |

最终选择 Tailwind CSS 的原因：

- 前台需要快速做响应式、主题化、卡片和阅读布局。
- shadcn/ui 默认围绕 Tailwind 组织。
- 主题色和导航配置可以通过 CSS Variables 与 Tailwind 结合。

---

### 8.5 前端数据与状态管理

| 方案 | 优点 | 缺点 | 适配度 | 结论 |
|---|---|---|---|---|
| Next.js RSC + fetch | SEO 友好，减少客户端请求，适合内容页 | 交互密集页面不适合全靠 RSC | 高 | ✅ SEO 页面选择 |
| TanStack Query | 服务端状态缓存、分页、重试、失效机制成熟 | 需要理解 queryKey 和缓存失效 | 高 | ✅ 客户端数据选择 |
| Zustand | API 简单，适合轻量全局状态 | 不适合承载大量服务端列表数据 | 高 | ✅ 客户端状态选择 |
| Redux Toolkit | 规范强，生态成熟 | 样板和心智成本更高，当前项目状态复杂度暂不需要 | 中 | 暂不选 |
| Jotai | 原子化状态灵活 | 团队约束需要更明确，服务端状态仍需其他方案 | 中 | 备选 |
| SWR | 简洁，适合轻量请求缓存 | 复杂分页、失效和后台列表场景不如 TanStack Query 完整 | 中 | 备选 |

最终组合：

- SEO 页面用 RSC + fetch。
- 工作区、AI 工具、后台列表用 TanStack Query。
- 用户信息、主题偏好、当前 AI 会话草稿等客户端状态用 Zustand。

---

### 8.6 后端框架

| 框架 | 优点 | 缺点 | 适配度 | 结论 |
|---|---|---|---|---|
| NestJS | 模块化、依赖注入、Guard、Pipe、Interceptor、Swagger 集成完善，适合中大型后端 | 学习成本高于 Express / Fastify 纯框架 | 高 | ✅ 选择 |
| Express | 简单自由，资料多 | 缺少结构约束，模块多后容易散，权限和校验需要自行组织 | 中 | 不作为主选 |
| Fastify | 性能好，插件体系成熟 | 单独使用时仍需自己组织模块、DI、Swagger、权限结构 | 中 | 作为 NestJS Adapter |
| Hono | 轻量、现代、适合边缘运行 | 对复杂 RBAC、后台、AI、文件、日志等完整系统约束不足 | 中 | 不作为主选 |
| Next.js API Routes | 前后端一体，轻量接口方便 | Flutter 复用、后台复杂接口、模块化扩展不占优 | 低 | 不承载核心业务 |
| tRPC | 类型体验极佳 | Flutter 不直接受益，OpenAPI 通用性弱于 REST | 中 | 不作为主 API 方案 |

最终选择 NestJS + Fastify Adapter 的原因：

- 后端模块多，用户也希望预留更多扩展性。
- 认证、RBAC、内容、AI、文件、日志都适合 NestJS 模块化。
- Fastify Adapter 兼顾性能和 SSE 流式响应。

---

### 8.7 ORM 与数据库访问

| 方案 | 优点 | 缺点 | 适配度 | 结论 |
|---|---|---|---|---|
| Prisma | Schema 清晰、类型安全、迁移流程直观，适合学习和快速开发 | 极复杂 SQL 和高级查询需要 raw SQL 辅助 | 高 | ✅ 选择 |
| TypeORM | NestJS 生态常见，装饰器风格 | 类型体验、迁移体验和现代开发体验不如 Prisma 直观 | 中 | 不作为主选 |
| Drizzle | 类型强、轻量、接近 SQL | 学习资料和既有文档已围绕 Prisma，首版切换收益不大 | 中 | 备选 |
| Sequelize | 成熟稳定 | TypeScript 体验和现代工程体验相对弱 | 低 | 不选 |
| 直接 SQL | 控制力最强，性能可控 | 首版开发效率低，类型安全和迁移管理成本高 | 中 | 仅复杂查询局部使用 |

最终选择 Prisma 的原因：

- 数据库表结构已经按 Prisma Schema 设计。
- 对前端转全栈更友好，可以边开发边理解数据建模。
- 类型安全能减少接口字段和数据库字段错配。

---

### 8.8 数据库、缓存与搜索

| 能力 | 候选方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| 主数据库 | PostgreSQL | JSONB、全文搜索、关系建模强，适合内容系统 | 运维心智略高于 SQLite | ✅ 选择 |
| 主数据库 | MySQL | 普及度高，资料多 | JSON、全文搜索、半结构化内容灵活性不如 PostgreSQL | 不选 |
| 主数据库 | SQLite | 简单、零运维 | 不适合后续多用户、后台、AI 用量等持续增长场景 | 不选 |
| 缓存 | Redis | 缓存、限流、会话辅助成熟 | 需要额外服务 | ✅ 选择 |
| 搜索 | PostgreSQL FTS | 首版无需额外服务，和主库一致 | 中文分词和搜索体验有限 | ✅ 首版选择 |
| 搜索 | Meilisearch | 搜索体验好，facet、高亮友好 | 多维护一个服务 | 后续增强 |
| 搜索 | Elasticsearch | 能力强 | 运维复杂，个人项目过重 | 暂不选 |

最终选择 PostgreSQL + Redis + PostgreSQL FTS 起步：

- 首版先减少服务数量，保证能跑通内容闭环。
- 后续内容多了，再接 Meilisearch，而不是一开始就把基础设施堆满。

---

### 8.9 Markdown、富文本与文档渲染

| 场景 | 候选方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| Markdown 高亮 | Shiki | 高亮质量高，服务端渲染友好 | 比轻量高亮库重一些 | ✅ 内容页选择 |
| Markdown 客户端渲染 | react-markdown | React 生态成熟，适合 AI 流式回复 | 大型静态内容不如预渲染 HTML 高效 | ✅ AI 回复选择 |
| HTML 安全 | rehype-sanitize | 能做白名单净化，降低 XSS 风险 | 需要维护安全白名单 | ✅ 必选 |
| 富文本 | Tiptap | 生态成熟，上手资料多 | 协作和复杂文档能力需扩展 | 备选 |
| 富文本 | Textbus | 更贴近文档编辑和协作方向 | 生态和资料相对小众 | 内容系统文档中作为富文本方向 |
| PDF | react-pdf / pdfjs-dist | Web 内嵌预览成熟 | 编辑能力弱 | ✅ 阅读选择 |

最终策略：

- Markdown 阅读优先服务端转 HTML + Shiki + sanitize。
- AI 流式 Markdown 用 react-markdown。
- 富文本编辑器在进入对应模块前，再结合协作需求最终确认 Tiptap / Textbus 口径。

---

### 8.10 Flutter 移动端技术栈

| 方案 | 优点 | 缺点 | 适配度 | 结论 |
|---|---|---|---|---|
| Flutter | 跨 iOS / Android，一套 UI，适合内容阅读和 AI 工具 | 需要学习 Dart 和 Flutter 体系 | 高 | ✅ 选择 |
| React Native | 与 React 心智接近 | 移动端原生适配和依赖兼容要投入维护 | 中 | 不作为主选 |
| 原生 iOS / Android | 性能和平台能力最佳 | 个人项目维护两套端成本过高 | 低 | 不选 |
| PWA | 成本低，Web 直接复用 | 原生体验、离线、推送、文件能力有限 | 中 | 可作为过渡 |

Flutter 配套选择：

- Riverpod 管状态。
- Dio 管请求与 Token 刷新。
- go_router 管路由。
- Isar 管有限离线缓存。
- flutter_secure_storage 存 Token。

---

### 8.11 Monorepo 与构建工具

| 方案 | 优点 | 缺点 | 适配度 | 结论 |
|---|---|---|---|---|
| Turborepo + pnpm workspace | 上手成本低，适合 Web + API + shared-types，构建缓存清晰 | 超大型仓库治理能力不如 Nx 全家桶完整 | 高 | ✅ 选择 |
| Nx | 规则强、插件多、适合大型企业 Monorepo | 概念和配置更重，个人项目首版有点厚 | 中 | 备选 |
| npm / yarn workspace | 原生简单 | 构建编排和缓存能力弱于 Turborepo | 中 | 不作为主选 |
| 多仓库 | 边界清晰 | 类型共享、联调、版本同步成本高 | 低 | 首版不选 |

最终选择 Turborepo + pnpm workspace：

- 项目有 `apps/web`、`apps/api`、`packages/shared-types`，天然适合 Monorepo。
- 个人项目需要轻量但规范的构建编排。

---

### 8.12 部署与基础设施

| 方案 | 优点 | 缺点 | 适配度 | 结论 |
|---|---|---|---|---|
| Docker Compose + Nginx | 成本低、结构清晰、适合个人服务器 | 多实例和弹性能力有限 | 高 | ✅ 首版选择 |
| Vercel + 独立 API | Next.js 部署体验好 | 国内访问、后端 API、数据库、文件服务需要拆开处理 | 中 | 备选 |
| Kubernetes | 扩展能力强，生产标准化 | 运维复杂，个人项目首版过重 | 低 | 后续再考虑 |
| Serverless | 弹性好，免服务器运维 | 长连接/SSE、文件处理、数据库连接管理要额外设计 | 中 | 不作为首版 |

最终选择 Docker Compose + Nginx：

- 首版目标是可控、便宜、容易理解。
- Nginx 能处理 HTTPS、反向代理和 SSE 关闭缓冲等关键配置。
- 后续有流量后再拆数据库、对象存储、搜索服务。

---

### 8.13 总体选择矩阵

| 维度 | 最终选择 | 核心原因 |
|---|---|---|
| Web 主框架 | Next.js | 兼顾内容 SEO、工作区交互和后台内嵌 |
| 前台 UI | shadcn/ui + Radix UI | 高度可定制，适合个人品牌和主题配置 |
| 后台 UI | Ant Design + Pro Components | 表格表单效率最高 |
| CSS | Tailwind CSS | 与 shadcn/ui 和主题变量匹配 |
| 服务端状态 | RSC + fetch / TanStack Query | SEO 页面和交互页面分工清晰 |
| 客户端状态 | Zustand | 简单轻量，足够支撑全局状态 |
| 后端 | NestJS + Fastify | 模块化、扩展性、Swagger、SSE 兼顾 |
| ORM | Prisma | 类型安全，适合学习和快速建模 |
| 数据库 | PostgreSQL | 内容系统、JSONB、全文搜索适配度高 |
| 缓存 | Redis | 限流、缓存、阅读数去重、会话辅助 |
| 搜索 | PostgreSQL FTS → Meilisearch | 首版轻量，后续增强 |
| 移动端 | Flutter + Riverpod + Dio | 跨端体验和 API 复用 |
| Monorepo | Turborepo + pnpm | 轻量统一管理 Web / API / shared-types |
| 部署 | Docker Compose + Nginx | 个人项目首版成本和可控性最好 |

---

## 9. 推荐落地顺序

### 阶段 0：工程骨架

优先落地：

- Turborepo + pnpm workspace
- Next.js 15
- NestJS + Fastify
- Prisma
- PostgreSQL + Redis Docker Compose
- shared-types

此阶段目标是跑通 `web`、`api`、数据库、Swagger 和共享类型。

### 阶段 1：基础能力

优先落地：

- Tailwind CSS v4
- shadcn/ui
- axios 请求封装
- react-hook-form + zod
- JWT + Passport
- Swagger DTO
- 全局异常、响应、校验、CORS

此阶段目标是形成后续业务开发的稳定模板。

### 阶段 2：内容和工作区

优先落地：

- TanStack Query
- Zustand
- Shiki
- react-markdown
- Tiptap
- react-pdf
- Recharts

此阶段目标是支撑内容阅读、内容管理、收藏、用量统计。

### 阶段 3：AI 工具和后台

优先落地：

- SSE 流式响应
- AI Provider / Model 配置模块
- Ant Design
- @ant-design/pro-components
- @nestjs/throttler
- @nestjs/event-emitter
- @nestjs/schedule

此阶段目标是完成 AI 对话、文本生成、图片生成和后台运营配置。

### 阶段 4：移动端和增强能力

优先落地：

- Flutter
- Riverpod
- Dio
- go_router
- Isar
- flutter_secure_storage
- MinIO
- Meilisearch

此阶段目标是扩展移动端和搜索、存储等增强能力。

---

## 10. 当前最稳妥的下一步

从框架角度看，当前项目不需要继续横向比较更多框架。最稳妥的下一步是：

1. 按 `docs/engineering/development-plan.md` 的 Phase 0 搭建 Monorepo 工程骨架。
2. 先跑通 Next.js、NestJS、Prisma、PostgreSQL、Redis 和 Swagger。
3. 在进入具体页面开发前，再确认前台视觉设计系统。
4. 在进入认证模块前，再确认邮箱验证、密码策略和管理员初始账号。
5. 在进入 AI 模块前，清理 `docs/product/ai-tools.md` 中重复的旧版段落，统一 AI 工具交互口径。

这样可以避免继续陷入选型循环，同时保留对业务细节的必要确认空间。
