# 技术栈选型

> 状态：✅ 长期选型已确定；React-first 阶段实施路线已补充
> 最后更新：2026-06-27
>
> ⚠️ **当前阶段以 React-first 为准**：本文件下方"前端完整依赖选型"描述的是 Next.js 长期目标栈。
> 当前 `apps/react-web` 实际使用 React 19 + Umi Max + Ant Design Pro v6 + antd v6 + pro-components v3 + Biome，
> 状态管理用 Umi `@@initialState`/`src/models`/`useModel`（不引入 Zustand/TanStack Query 作为主状态方案），
> 样式以 Less + CSS Modules + Ant Design token 为主（不以 Tailwind 为主样式体系）。
> 详见 [react-first/README.md](./react-first/README.md) 与 [prd/react-first/phase-0-3-foundation-prd.md](./prd/react-first/phase-0-3-foundation-prd.md)。
> 后续抽离到 `apps/next-web` 时再回归下方 Next.js 长期栈。

---

## 最终选型

> 说明：本节描述长期技术架构。当前阶段会先用 `apps/react-web`（React + Umi + Ant Design Pro）快速完成首版前端，后续再将部分公开页面抽到 Next.js 15。后端、数据库、缓存、Monorepo 和共享类型选型不变。

### 基础架构

| 层                | 技术                                        | 说明                              |
| ----------------- | ------------------------------------------- | --------------------------------- |
| Web 前台 + 工作区 | **Next.js 15 + Tailwind CSS v4**            | App Router，兼顾 SSR 与内容展示   |
| 后台管理          | **Ant Design + @ant-design/pro-components** | 在 Next.js 内嵌使用，不单独起工程 |
| 后端 API          | **NestJS + Prisma + Swagger**               | TypeScript 全栈统一               |
| 数据库            | **PostgreSQL 16**                           | JSON 字段能力强，支持全文搜索     |
| 缓存              | **Redis 7**                                 | Session、对话历史、热数据缓存     |
| 文件存储          | 本地磁盘 → **MinIO**                        | 先本地，后续迁移 MinIO            |
| 搜索              | PostgreSQL 全文搜索 → **Meilisearch**       | 先内置，后续独立搜索引擎          |
| Flutter App       | **Dio + Riverpod + go_router**              | 复用后端 API                      |
| Monorepo          | **Turborepo**                               | 统一构建，共享类型定义            |

### 当前阶段补充：React-first 前端

| 层 | 技术 | 说明 |
| --- | --- | --- |
| 首版 Web | **React + Umi Max + Ant Design Pro** | 位于 `apps/react-web`，用于快速完成完整 Web 功能 |
| UI | **Ant Design + @ant-design/pro-components** | 公开前台做轻量品牌化封装，工作区和后台优先使用 Pro 体系 |
| 数据 | **Umi mock + service 层** | 后端未完成前模拟 NestJS API 契约 |
| 后续迁移 | **Next.js 15** | 首页、内容中心、阅读页、项目页、关于我优先迁移 |

React-first 详细路线见 [../react-first/README.md](../react-first/README.md)。

---

## 前端完整依赖选型（Web）

> 关键原则：公开前台用 shadcn/ui（Tailwind 定制），后台用 Ant Design（表格/表单效率优先），两套组件库共存于同一工程，按路由前缀区分使用范围。

### UI 组件层

| 库                             | 版本 | 用途              | 说明                                                                   |
| ------------------------------ | ---- | ----------------- | ---------------------------------------------------------------------- |
| **shadcn/ui**                  | 最新 | 公开前台 + 工作区 | 基于 Radix UI + Tailwind，无样式锁定，可完全定制；Next.js 生态事实标准 |
| **Radix UI**                   | —    | shadcn/ui 底层    | Dialog、Dropdown、Tabs 等无障碍交互原语，shadcn/ui 内置依赖            |
| **antd**                       | v5   | 后台 `/admin`     | —                                                                      |
| **@ant-design/pro-components** | v2   | 后台 `/admin`     | ProTable、ProForm、ProLayout                                           |
| **lucide-react**               | 最新 | 图标库            | 与 shadcn/ui 默认搭配，风格统一                                        |
| **tailwind-merge + clsx**      | —    | Tailwind 类名工具 | shadcn/ui 内置使用，`cn()` 工具函数                                    |

### 状态管理

| 库                      | 用途                 | 适用场景                                                   |
| ----------------------- | -------------------- | ---------------------------------------------------------- |
| **Zustand**             | 客户端全局状态       | 用户信息、认证态、AI 会话当前状态；轻量无 boilerplate      |
| **TanStack Query v5**   | 服务端数据获取与缓存 | 工作区 client-side 页面（列表/详情）；自动缓存、重试、分页 |
| **Next.js RSC + fetch** | 服务端渲染数据获取   | 公开前台 SEO 页面优先使用 Server Component                 |

> 原则：SEO 敏感页面（首页、内容阅读页、关于我）用 RSC；工作区、AI 工具页用 TanStack Query；全局状态（登录用户信息）用 Zustand。

### 表单与校验

| 库                      | 用途                       | 说明                                                  |
| ----------------------- | -------------------------- | ----------------------------------------------------- |
| **react-hook-form**     | 表单状态管理               | 性能最优，与 shadcn/ui `Form` 组件深度集成            |
| **zod**                 | Schema 校验 + 类型推导     | 前后端共用校验 Schema，定义在 `packages/shared-types` |
| **@hookform/resolvers** | 桥接 react-hook-form + zod | —                                                     |

### 内容渲染

| 库                              | 用途                | 说明                                                      |
| ------------------------------- | ------------------- | --------------------------------------------------------- |
| **shiki**                       | 代码块语法高亮      | 服务端渲染输出精准 HTML，支持 100+ 语言；Next.js RSC 友好 |
| **react-markdown + remark-gfm** | Markdown 客户端渲染 | AI 回复流式渲染时使用                                     |
| **rehype-sanitize**             | HTML 净化           | **安全必须**：渲染用户输入 HTML 前净化，防止 XSS          |
| **Tiptap**                      | 富文本编辑器        | 内容创建页，基于 ProseMirror                              |
| **react-pdf (pdfjs-dist)**      | PDF 渲染            | 内容阅读页 PDF 格式，客户端渲染                           |

### 数据可视化

| 库           | 用途 | 说明                                                              |
| ------------ | ---- | ----------------------------------------------------------------- |
| **Recharts** | 图表 | 工作区用量页（折线图/饼图）+ 后台 AI 统计；React 原生，无 D3 依赖 |

### 工具类

| 库              | 用途             | 说明                                                        |
| --------------- | ---------------- | ----------------------------------------------------------- |
| **axios**       | HTTP 请求封装    | 统一 baseURL、拦截器、Token 刷新；Zustand 之外的 API 调用层 |
| **dayjs**       | 日期处理         | 轻量，替代 moment.js                                        |
| **nuqs**        | URL 搜索参数状态 | 内容列表筛选条件与 URL 同步，支持 Next.js App Router        |
| **next-themes** | 深色/浅色主题    | 跟随系统 + 手动切换，与 shadcn/ui 深度集成                  |
| **sonner**      | Toast 通知       | shadcn/ui 推荐搭配，API 简洁                                |

---

## 后端完整依赖选型（NestJS）

### 核心框架

| 库                           | 用途            | 说明                                                 |
| ---------------------------- | --------------- | ---------------------------------------------------- |
| **@nestjs/core + common**    | NestJS 框架核心 | —                                                    |
| **@nestjs/platform-fastify** | HTTP 适配器     | Fastify 替代 Express，性能更好；SSE 流式输出支持更好 |
| **@nestjs/jwt + passport**   | JWT 认证        | AccessToken 签发与校验                               |
| **@nestjs/throttler**        | 限流            | 防止接口滥用（登录/注册/AI 试用）                    |
| **@nestjs/swagger**          | API 文档        | 自动生成 Swagger UI，开发环境可访问 `/api/docs`      |
| **@nestjs/schedule**         | 定时任务        | 操作日志清理、Token 过期清理等                       |
| **@nestjs/event-emitter**    | 事件总线        | 解耦模块间通信（如内容发布后触发缓存清除）           |

### 数据层

| 库                                                    | 用途         | 说明                    |
| ----------------------------------------------------- | ------------ | ----------------------- |
| **prisma + @prisma/client**                           | ORM          | 类型安全的数据库访问    |
| **ioredis**                                           | Redis 客户端 | Session、缓存、限流计数 |
| **@nestjs/cache-manager + cache-manager-redis-store** | 缓存封装     | 统一缓存注解            |

### 安全

| 库                                      | 用途        | 说明                                  |
| --------------------------------------- | ----------- | ------------------------------------- |
| **bcrypt**                              | 密码哈希    | cost factor = 12                      |
| **helmet**                              | HTTP 安全头 | 防止常见 Web 攻击                     |
| **class-validator + class-transformer** | DTO 校验    | 请求参数校验，与 `@Body()` 装饰器配合 |

### 文件与存储

| 库         | 用途         | 说明                                                  |
| ---------- | ------------ | ----------------------------------------------------- |
| **multer** | 文件上传     | `@nestjs/platform-fastify` 下使用 `fastify-multipart` |
| **minio**  | MinIO 客户端 | 后续迁移到对象存储时使用                              |
| **sharp**  | 图片处理     | 头像上传后压缩、裁剪                                  |

### 邮件与通知

| 库                         | 用途                | 说明                                            |
| -------------------------- | ------------------- | ----------------------------------------------- |
| **nodemailer**             | 发送邮件            | 邮箱验证码、密码重置；SMTP 配置在系统配置中管理 |
| **@nestjs-modules/mailer** | NestJS 邮件模块封装 | 支持模板引擎                                    |

### 工具类

| 库         | 用途         | 说明                                  |
| ---------- | ------------ | ------------------------------------- |
| **nanoid** | 随机 ID 生成 | Refresh Token、邮件验证码等随机字符串 |
| **dayjs**  | 日期处理     | 后端日期计算                          |

---

## 工程结构

```
monorepo（Turborepo 管理）
├── apps/
│   ├── react-web/    ← React-first 首版 Web（React + Umi + Ant Design Pro）
│   ├── next-web/     ← 后续 Next.js（公开前台 + 内容阅读等 SEO 页面）
│   └── api/          ← NestJS（统一后端 API，后续接入）
└── packages/
    └── shared-types/ ← 前后端共享 TypeScript 类型与 zod Schema
```

> 当前阶段先创建 `apps/react-web` 与 `packages/shared-types`。`apps/next-web` 和 `apps/api` 按后续阶段创建，但后端目标和共享类型边界保持不变。

---

## 选型背景与依据

- 开发者当前为 Vue 技术栈，本项目借机切换到 React 体系，在实战中掌握两套框架
- **shadcn/ui 选型理由**：不是封装好的组件库，而是"复制到项目里的可定制组件"，不会被第三方样式锁定，最适合需要高度定制的前台页面
- **两套 UI 库共存**：公开前台 + 工作区用 shadcn/ui（Tailwind 定制），后台用 Ant Design（表格/表单效率优先），按路由前缀区分，无冲突
- **TanStack Query + Zustand 搭配**：Query 管服务端数据，Zustand 管客户端状态，职责清晰不混用
- Next.js RSC 策略：SEO 重要页面（首页、内容阅读、关于我）用 Server Component；交互密集页面（AI 工具、工作区）用 Client Component + TanStack Query
- NestJS 优先 Fastify 适配器：SSE 流式输出（AI 对话）对 HTTP 层性能敏感
- PostgreSQL 优先于 MySQL：JSON 字段支持更好、全文搜索更强、适合内容管理系统半结构化数据

---

## AI 接入架构

```
前端（Web/Flutter）
    ↓ HTTP 请求（含 SSE stream 支持）
后端 NestJS（AI 代理层，隐藏 API Key）
    ↓ 调用对应厂商 API
AI 厂商（OpenAI / Anthropic / 阿里云百炼 / Gemini 等）
```

- 后端保存：AI 使用统计、对话历史、Token 消耗记录
- 支持可配置多家 API，优先选 Token 价格最优的厂商
- 为后续 Token 计费体系预留数据层

---

## 后端核心模块划分

```
apps/api/src/
  modules/
    auth/         ← 登录、Token 签发、密码重置、邮箱验证
    user/         ← 用户信息 CRUD、头像上传
    role/         ← 角色 CRUD
    permission/   ← 权限点枚举管理
    menu/         ← 菜单配置管理
    content/      ← 内容增删改查、发布、可见性
    chapter/      ← 章节管理（掘金小册）
    category/     ← 分类树形 CRUD
    tag/          ← 标签 CRUD
    file/         ← 上传、代理下载、元数据
    favorite/     ← 收藏 CRUD
    reading/      ← 阅读进度 upsert、阅读历史
    ai/           ← AI 代理层、SSE 流式输出
    ai-session/   ← 对话会话 CRUD
    ai-usage/     ← Token 消耗记录、用量统计
    ai-provider/  ← 厂商配置管理
    ai-model/     ← 模型配置管理
    system/       ← 系统配置 Key-Value 管理
    homepage/     ← 首页区块配置
    workspace/    ← 工作台聚合接口（stats 等）
    admin/        ← 管理员操作汇聚（用户管理、内容管理）
    search/       ← 全文检索（首版 PostgreSQL FTS）
    log/          ← 操作日志记录与查询
  common/
    guards/       ← JwtAuthGuard、RolesGuard、PermissionsGuard
    decorators/   ← @CurrentUser、@Roles、@Permissions
    filters/      ← GlobalExceptionFilter
    interceptors/ ← ResponseTransformInterceptor
    pipes/        ← ValidationPipe（全局）
  prisma/
    schema.prisma
    migrations/
    seed.ts
```
