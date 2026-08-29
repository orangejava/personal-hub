# 前端开发者转全栈学习路径

> 适用对象：已经写过 Vue 3 / React，现在准备用这个项目学习 Next.js、NestJS、Prisma、PostgreSQL、Docker，并搭一套完整前后端工程。
> 目标：不是把所有东西学完再开始，而是把“边学边做、边做边学”的路线拆成一套可以直接执行的学习手册。
> 最后更新：2026-06-02

---

## 1. 这份文档怎么用

这份文档不是为了让你一次性从头读到尾，而是为了让你在每个开发阶段知道：

1. 现在最该学什么
2. 哪些要深入，哪些只要会用
3. 先看哪些官方文档
4. 马上能做什么练习
5. 要执行哪些命令
6. 什么程度算“这一阶段够用了”

推荐使用方式：

1. 先读第 1～6 章，建立整体认知。
2. 开始开发时，只看当前阶段对应章节。
3. 每学一个概念，立刻在项目里落一次。
4. 每完成一个阶段，再回来看下一个阶段。

> 你现在最不需要做的，是把所有技术都提前学完。  
> 你最需要做的，是只学当前阶段马上会用到的 20%，然后立刻在项目里做出来。

---

## 2. 你当前的基础和真正要补的东西

你不是从零开始。

你已经具备这些可迁移能力：

- 组件拆分
- 状态管理
- 表单与请求联动
- 页面路由与用户流程设计
- 基础 TypeScript
- 前端调试能力

你真正要补的是三类新能力：

1. 服务端渲染与全栈工程思维
2. 数据建模与接口设计能力
3. 环境、权限、缓存、部署这些系统能力

---

## 3. 先接受四个关键思维变化

### 变化 1：代码不再只运行在浏览器

你以后要反复区分：

- 浏览器里的 React 代码
- Next.js 服务端执行的代码
- NestJS API 服务端代码

所以你要经常问自己：

- 这段代码运行在哪里？
- 这段代码能不能访问 `window`？
- 这段数据应该服务端拿，还是客户端拿？

### 变化 2：你不再只是“调接口”，而要开始“设计接口”

以后你不只是：

```ts
axios.get('/api/xxx')
```

你还要开始决定：

- 路径怎么命名
- 参数怎么传
- 返回结构怎么统一
- 错误怎么表达
- 权限在哪里拦

### 变化 3：你不再只是“做页面”，而是在搭一个系统

你以后会关心：

- 数据库表怎么建
- Token 怎么刷新
- Redis 什么时候用
- 文件怎么存
- 部署怎么做
- 出问题怎么排查

### 变化 4：不是所有技术都要同样深入

你不需要把每个技术都学成专家。

更合理的方式是：

- 主链路技术深入学
- 支撑型技术学会用、会排查
- 工具类技术先会接入，不急着深挖原理

---

## 4. 学习深度分层：哪些要深学，哪些先会用

### 第一层：必须重点学

这几类决定你能不能独立完成主链路：

- TypeScript
- Next.js
- NestJS
- Prisma
- PostgreSQL 建模
- JWT / RBAC

学习目标：

- 不只是会抄代码
- 而是能解释为什么这样做
- 能独立排查常见问题

### 第二层：需要中等深度

这些要会用、会排查，但不需要一开始钻很深：

- Docker / Docker Compose
- pnpm workspace
- Turborepo
- Redis
- Swagger
- React Query

学习目标：

- 知道作用
- 能完成项目里的接入
- 出问题时知道先查哪里

### 第三层：当前阶段只需要“会接入和会用”

先能完成项目，不用一开始钻内部机制：

- Ant Design / Pro Components
- shadcn/ui
- PDF.js
- TablePlus / pgAdmin / RedisInsight
- Textbus

学习目标：

- 能完成最小接入
- 知道官方文档入口
- 知道大概有哪些能力

> 一个很实用的判断标准：  
> 会不会直接影响“页面、接口、数据库主链路”？  
> 会，就优先深学。不会，就先会用。

---

## 5. 当前项目的官方资料导航

下面这些是你现在最值得收藏的官方入口。优先看官方文档，不要一开始被大量二手文章带偏。

| 技术 | 官方入口 | 当前阶段重点 |
|---|---|---|
| TypeScript | [Handbook](https://www.typescriptlang.org/docs/handbook/intro) | Everyday Types / 函数 / 联合类型 / 泛型基础 |
| TypeScript（JS 开发者向） | [TypeScript for JavaScript Programmers](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes.html) | 快速建立“TS 是 JS 的增强”这个认知 |
| Next.js | [Next.js Docs](https://nextjs.org/docs) | App Router / 安装 / 路由 / 数据获取 |
| Next.js App Router | [App Router Docs](https://nextjs.org/docs/app) | `app/` 结构 / Server & Client Components |
| Next.js 安装 | [Installation](https://nextjs.org/docs/app/getting-started/installation) | 建项目命令、默认能力 |
| NestJS | [First Steps](https://docs.nestjs.com/first-steps) | module / controller / service |
| NestJS Swagger | [OpenAPI (Swagger)](https://docs.nestjs.com/openapi/introduction) | 如何生成接口文档 |
| Prisma | [Getting Started](https://docs.prisma.io/docs/getting-started) | schema / migrate / client |
| PostgreSQL | [Official Docs](https://www.postgresql.org/docs/) | SQL 与数据库基础 |
| PostgreSQL 教程 | [Tutorial](https://www.postgresql.org/docs/current/tutorial.html) | 从零理解表、查询、SQL |
| pnpm | [pnpm Docs](https://pnpm.io/) | install / workspace / filtering |
| Turborepo | [Getting Started](https://turborepo.com/docs/getting-started) | monorepo 任务调度 |
| Docker | [Get Started](https://docs.docker.com/get-started/) | container / image / compose |
| Docker Compose | [Compose Quickstart](https://docs.docker.com/compose/gettingstarted/) | `up` / `down` / `logs` / `ps` |
| Redis | [Get Started](https://redis.io/docs/latest/get-started//) | key/value / TTL / 限流 |
| Redis 快速开始 | [Quick starts](https://redis.io/docs/latest/develop/get-started/) | 实际使用场景 |
| TanStack Query | [Overview](https://tanstack.com/query/docs/docs) | 查询缓存与异步状态 |
| shadcn/ui | [CLI Docs](https://ui.shadcn.com/docs/cli) | 初始化与拉取组件 |
| Ant Design | [Introduce](https://ant.design/docs/react/introduce/?locale=en) | 组件库能力与安装 |
| Ant Design Pro Components | [ProComponents](https://procomponents.ant.design/en-US/) | 后台表格、表单能力 |
| Textbus | [官方文档](https://textbus.io/) | 富文本与协作能力概览 |
| Textbus 协作 | [Collaboration](https://textbus.io/en/guide/collaborate.html) | 多人协作的增强方向 |

---

## 6. 学习顺序总览

```text
第一层：环境与工程基础
Homebrew / Node.js / pnpm / Docker / Git

第二层：Monorepo 与项目骨架
pnpm workspace / Turborepo / Next.js / NestJS

第三层：数据库与认证
Prisma / PostgreSQL / JWT / RBAC / Swagger

第四层：内容与文档系统
Markdown / Word / 富文本 / 小册管理 / 文件系统

第五层：缓存与 AI
Redis / SSE / AI 代理层 / 用量记录

第六层：后台、测试、部署
Ant Design Pro / Dockerfile / CI/CD / Nginx
```

原因：

- 如果工程骨架没起来，后面的学习都会碎
- 如果 Next.js 和 NestJS 结构不清楚，数据库和认证会接得很痛苦
- 如果数据库和认证没跑通，内容系统和 AI 系统就只是空壳

---

## 7. 每个阶段要学什么、做什么、做到什么程度

## Phase 0：环境准备 + 工程骨架

### 目标

- 本机环境可用
- `apps/user-web`、`apps/server`、`packages/shared-types` 结构清楚
- 可以同时跑起 Web / API / PostgreSQL / Redis

### 重点学习

- Homebrew、Node.js、pnpm
- Docker Desktop 与 Docker Compose
- `pnpm workspace`
- Turborepo 基础
- Next.js / NestJS 初始化方式

### 官方资料先看这些

- [pnpm Docs](https://pnpm.io/)
- [Turborepo Getting Started](https://turborepo.com/docs/getting-started)
- [Next.js Installation](https://nextjs.org/docs/app/getting-started/installation)
- [NestJS First Steps](https://docs.nestjs.com/first-steps)
- [Docker Get Started](https://docs.docker.com/get-started/)
- [Docker Compose Quickstart](https://docs.docker.com/compose/gettingstarted/)

### 当前只需要搞懂的概念

- Monorepo 是什么
- workspace 是什么
- Turborepo 为什么不是框架
- Docker 容器和本机安装有什么区别
- Next.js 和 NestJS 在项目里的边界是什么

### 边学边做任务

1. 跑通本地环境校验
2. 初始化根目录工程
3. 熟悉已存在的 `apps/user-web`
4. 熟悉已存在的 `apps/server`
5. 初始化 `packages/shared-types`
6. 跑起 PostgreSQL 和 Redis
7. 跑起 `pnpm dev`

### 这一阶段常用命令

```bash
pnpm init
pnpm install
pnpm dev
pnpm --filter web dev
pnpm --filter server dev
docker compose -f compose.dev.yml up -d
docker compose -f compose.dev.yml ps
docker compose -f compose.dev.yml logs
```

### 这一阶段做到什么程度就够

- 能解释 Monorepo 基本结构
- 能看懂 `apps/user-web` 和 `apps/server` 的分工
- 能自己启动和关闭本地依赖服务
- 不需要现在就深入研究 Turborepo 缓存细节

---

## Phase 1：Next.js 与 NestJS 最小闭环

### 目标

- 先把前后端骨架理解清楚
- 跑通首页空页面和 `GET /health`

### 重点学习

- Next.js App Router
- `layout.tsx` / `page.tsx`
- Server Component / Client Component
- NestJS 的 module / controller / service

### 官方资料先看这些

- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [Linking and Navigating](https://nextjs.org/docs/app/getting-started/linking-and-navigating)
- [Fetching Data](https://nextjs.org/docs/app/getting-started/fetching-data)
- [NestJS Controllers](https://docs.nestjs.com/controllers)
- [NestJS Providers](https://docs.nestjs.com/providers)
- [NestJS Modules](https://docs.nestjs.com/modules)

### 当前只需要搞懂的概念

- 为什么 Next.js 页面不全是客户端渲染
- 什么情况下要加 `'use client'`
- Controller 和 Service 为什么要分开

### 边学边做任务

1. 新建首页
2. 新建公开前台 Layout
3. 写 `GET /health`
4. 跑通 Swagger

### 常用命令

```bash
pnpm dev:react
pnpm --filter server dev
```

### 这一阶段做到什么程度就够

- 能自己新增一个页面
- 能自己新增一个简单接口
- 能看懂请求从 Controller 到 Service
- 还不需要现在就学完所有 Next.js API

---

## Phase 2：数据库、Prisma、认证

### 目标

- 跑通用户注册、登录、获取当前用户
- 初次真正建立“前端 + 数据库 + 认证链路”的认知

### 重点学习

- Prisma Schema
- Migration 流程
- PostgreSQL 表关系
- Access Token / Refresh Token
- NestJS Guard

### 官方资料先看这些

- [Prisma Getting Started](https://docs.prisma.io/docs/getting-started)
- [Prisma Studio](https://docs.prisma.io/docs/studio/getting-started)
- [PostgreSQL Tutorial](https://www.postgresql.org/docs/current/tutorial.html)
- [NestJS Guards](https://docs.nestjs.com/guards)
- [NestJS OpenAPI](https://docs.nestjs.com/openapi/introduction)

### 当前只需要搞懂的概念

- 为什么要有 `schema -> migrate -> generate`
- 为什么 Access Token 和 Refresh Token 要分开
- 为什么真正的权限是在后端接口里做

### 边学边做任务

1. 建用户表、角色表、权限表
2. 完成第一次 migration
3. 写注册接口
4. 写登录接口
5. 写获取当前用户接口
6. 用 Swagger 测通

### 常用命令

```bash
pnpm --filter server prisma:migrate -- --name init_auth
pnpm --filter server prisma:generate
pnpm --filter server prisma:studio
pnpm --filter server dev
```

### 这一阶段做到什么程度就够

- 能自己加字段并迁移
- 能看懂登录链路
- 能自己做一个需要登录的接口
- 还不需要现在去钻 JWT 的所有安全理论

---

## Phase 3：文档 / 内容系统

### 目标

- 跑通文档的上传、查看、编辑、发布、阅读
- 建立“文档资源域”和“创作工具域”的理解

### 重点学习

- Markdown 阅读和编辑
- Word 文档的打开、编辑、下载流程
- 富文本编辑与协作方向
- 小册管理与章节结构
- 文件上传与存储关系

### 官方资料先看这些

- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [TanStack Query Overview](https://tanstack.com/query/docs/docs)
- [Textbus](https://textbus.io/)
- [Textbus Collaboration](https://textbus.io/en/guide/collaborate.html)

### 当前只需要搞懂的概念

- 阅读页和编辑器为什么不能混成一个概念
- 为什么 Markdown / Word / 富文本 / 小册要共享主模型但允许专属元数据
- 为什么小册要有章节子表

### 边学边做任务

1. 做文档列表页
2. 做文档阅读页
3. 做 Markdown 编辑页
4. 做小册管理页
5. 做富文本编辑页
6. 做 Word 文档工作流占位

### 常用命令

```bash
pnpm dev:react
pnpm --filter server dev
pnpm --filter server prisma:migrate -- --name add_content_system
```

### 这一阶段做到什么程度就够

- 能解释文档资源和工具的区别
- 能跑通至少一条完整文档链路
- Textbus 先做到“会接入、会看文档、会做单人编辑”就够

---

## Phase 4：Redis、SSE、AI

### 目标

- 跑通流式对话
- 会用 Redis 做基础缓存和限流

### 重点学习

- Redis 的 key/value、TTL
- SSE 的基本传输方式
- AI 代理层
- 用量记录和会话存储

### 官方资料先看这些

- [Redis Get Started](https://redis.io/docs/latest/get-started//)
- [Redis Quick starts](https://redis.io/docs/latest/develop/get-started/)
- [NestJS Guards](https://docs.nestjs.com/guards)
- [Docker Compose Quickstart](https://docs.docker.com/compose/gettingstarted/)

### 当前只需要搞懂的概念

- Redis 不是主数据库
- SSE 不是 WebSocket
- 为什么 AI 厂商 Key 不能放前端

### 边学边做任务

1. 用 Redis 做一个简单缓存
2. 做一个 Redis 限流计数 demo
3. 做一个模拟 SSE 接口
4. 前端做增量渲染

### 常用命令

```bash
redis-cli ping
docker compose -f compose.dev.yml logs -f
pnpm --filter server dev
pnpm dev:react
```

### 这一阶段做到什么程度就够

- 会连 Redis
- 会看 TTL
- 会解释 SSE 的基本流程
- 不需要现在就深挖 Redis 的高级数据结构

---

## Phase 5：后台管理

### 目标

- 用一套成熟组件快速搭后台
- 把精力放在业务流程和权限上

### 重点学习

- Ant Design
- Pro Components
- 表格、表单、抽屉、权限显隐

### 官方资料先看这些

- [Ant Design](https://ant.design/docs/react/introduce/?locale=en)
- [ProComponents](https://procomponents.ant.design/en-US/)

### 当前只需要搞懂的概念

- 后台是“配置型界面”，不是内容展示页面
- 菜单权限和接口权限要一致

### 边学边做任务

1. 做后台 Layout
2. 做文档管理表格
3. 做用户管理表格
4. 做系统配置表单

### 常用命令

```bash
pnpm --filter web dev
```

### 这一阶段做到什么程度就够

- 能接组件
- 能用表格和表单完成页面
- 不需要现在深入研究 Ant Design 全部设计规范

---

## Phase 6：测试、构建、部署

### 目标

- 项目不只是“本地跑起来”，而是“能交付”

### 重点学习

- lint / test / build
- Dockerfile
- Compose 生产配置
- Nginx / HTTPS / CI/CD 基本思路

### 官方资料先看这些

- [Docker Get Started](https://docs.docker.com/get-started/)
- [Docker Compose Quickstart](https://docs.docker.com/compose/gettingstarted/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

### 当前只需要搞懂的概念

- 本地能跑和可部署是两回事
- CI/CD 只是自动化执行你本地已经验证过的命令

### 边学边做任务

1. 跑通 `lint`
2. 跑通 `build`
3. 写 Web / API Dockerfile
4. 写生产 Compose 文件

### 常用命令

```bash
pnpm lint
pnpm test
pnpm build
docker compose -f docker-compose.prod.yml up -d --build
```

### 这一阶段做到什么程度就够

- 能解释部署链路
- 能自己跑一次构建
- 还不需要一开始就深入云平台复杂能力

---

## 8. 按技术拆开的“现在该学什么”

## TypeScript

### 要深学

- `type` / `interface`
- 联合类型
- 类型收窄
- 函数返回值
- 泛型基础

### 先不用深挖

- 高级类型体操
- 复杂装饰器类型推导
- 非常重的类型编程

### 推荐阅读顺序

1. [TypeScript for JavaScript Programmers](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes.html)
2. [Handbook](https://www.typescriptlang.org/docs/handbook/intro)
3. Everyday Types / Narrowing / More on Functions

### 最小练习

1. 给一个 React 组件补全 Props 类型
2. 给一个 API 响应结构写类型
3. 给一个 Nest DTO 写类型

### 常用命令

```bash
tsc -v
```

---

## Next.js

### 要深学

- App Router
- `layout.tsx` / `page.tsx`
- 动态路由
- Server Component / Client Component
- `fetch` / `revalidate`

### 先不用深挖

- 边缘运行时高级特性
- 中间件复杂能力
- 全量缓存细节

### 推荐阅读顺序

1. [Next.js Docs](https://nextjs.org/docs)
2. [App Router](https://nextjs.org/docs/app)
3. [Installation](https://nextjs.org/docs/app/getting-started/installation)
4. [Fetching Data](https://nextjs.org/docs/app/getting-started/fetching-data)
5. [Linking and Navigating](https://nextjs.org/docs/app/getting-started/linking-and-navigating)

### 最小练习

1. 新建首页
2. 新建 `/content`
3. 新建 `/content/[slug]`
4. 为详情页加 ISR

### 常用命令

```bash
pnpm --filter web dev
pnpm --filter web build
```

---

## NestJS

### 要深学

- module
- controller
- service
- DTO
- ValidationPipe
- Guard

### 先不用深挖

- 自定义复杂生命周期
- 微服务架构
- 高阶动态模块模式

### 推荐阅读顺序

1. [First Steps](https://docs.nestjs.com/first-steps)
2. [Controllers](https://docs.nestjs.com/controllers)
3. [Providers](https://docs.nestjs.com/providers)
4. [Modules](https://docs.nestjs.com/modules)
5. [Guards](https://docs.nestjs.com/guards)
6. [OpenAPI](https://docs.nestjs.com/openapi/introduction)

### 最小练习

1. 写 `GET /health`
2. 写 `POST /auth/login`
3. 写一个带 Guard 的接口

### 常用命令

```bash
pnpm --filter server dev
pnpm --filter server test
```

---

## Prisma + PostgreSQL

### 要深学

- schema.prisma
- migration
- 一对多 / 多对多
- 唯一约束
- 索引
- 分页查询

### 先不用深挖

- 复杂数据库调优
- 分区表
- 高级事务策略

### 推荐阅读顺序

1. [Prisma Getting Started](https://docs.prisma.io/docs/getting-started)
2. [Prisma Studio](https://docs.prisma.io/docs/studio/getting-started)
3. [PostgreSQL Tutorial](https://www.postgresql.org/docs/current/tutorial.html)
4. [PostgreSQL Docs](https://www.postgresql.org/docs/)

### 最小练习

1. 建 `User`
2. 建 `Content`
3. 完成一次 migration
4. 查询一条内容详情

### 常用命令

```bash
pnpm --filter server prisma:migrate
pnpm --filter server prisma:generate
pnpm --filter server prisma:studio
psql --version
```

---

## Redis

### 要学到会用

- `SET`
- `GET`
- `TTL`
- `DEL`
- `PING`
- 限流计数

### 先不用深挖

- Streams
- Cluster
- 发布订阅高级玩法

### 推荐阅读顺序

1. [Redis Get Started](https://redis.io/docs/latest/get-started//)
2. [Quick starts](https://redis.io/docs/latest/develop/get-started/)

### 最小练习

1. 缓存一个值
2. 设置过期时间
3. 做一个登录失败计数 demo

### 常用命令

```bash
redis-cli ping
redis-cli
```

---

## Docker / Compose

### 要学到会用

- image
- container
- ports
- volumes
- `docker compose up/down/ps/logs`

### 先不用深挖

- 镜像分层优化高级技巧
- BuildKit 深层细节
- 容器网络高级配置

### 推荐阅读顺序

1. [Get Started](https://docs.docker.com/get-started/)
2. [Get Docker](https://docs.docker.com/get-started/get-docker/)
3. [Compose Quickstart](https://docs.docker.com/compose/gettingstarted/)

### 最小练习

1. 跑 `hello-world`
2. 用 compose 起 PostgreSQL + Redis
3. 看日志、停服务、删服务

### 常用命令

```bash
docker run hello-world
docker compose -f compose.dev.yml up -d
docker compose -f compose.dev.yml ps
docker compose -f compose.dev.yml logs
docker compose -f compose.dev.yml down
```

---

## 9. 每周学习节奏建议

### 第 1 周

- 环境准备
- Monorepo 骨架
- Next.js / NestJS 初始化

### 第 2 周

- Prisma / PostgreSQL
- 注册 / 登录

### 第 3 周

- 文档 / 内容系统
- Markdown / 阅读页 / 文件上传

### 第 4 周

- Redis / SSE
- AI 对话

### 第 5 周之后

- 后台管理
- 测试
- 部署

---

## 10. 每日“边学边做”模板

每天不需要学很多，建议用这个固定流程：

1. 先确定今天只做一个闭环
   - 例如：`做 GET /health`
2. 先读 15～30 分钟当前相关官方文档
3. 立刻动手做最小实现
4. 卡住时先查报错和官方文档
5. 做完后写一句总结
   - 今天新学会了什么
   - 还有什么没理解

---

## 11. 一个实用的判断标准：什么时候该停下继续学，什么时候该先做

### 该继续学的情况

- 你完全不知道这个技术在项目里负责什么
- 你连最小命令都看不懂
- 你不知道成功标准是什么

### 该先动手的情况

- 你已经知道大概做什么
- 你已经有最小命令
- 你只是在担心“还没完全搞懂”

> 大多数时候，你真正缺的不是“继续看文档”，而是“先做一遍最小闭环”。

---

## 12. 当前最推荐的实际开始顺序

如果你准备正式开始，现在按这个顺序最稳：

1. 先读 [local-environment-setup-handbook.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/study/local-environment-setup-handbook.md:1)
2. 确认本机环境
3. 进入 Phase 0，搭工程骨架
4. 同时读：
   - [nextjs-learning-handbook.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/study/nextjs-learning-handbook.md:1)
   - [nestjs-learning-handbook.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/study/nestjs-learning-handbook.md:1)
5. 做认证前，再补：
   - [prisma-postgres-learning-handbook.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/study/prisma-postgres-learning-handbook.md:1)

---

## 13. 你达到什么状态，说明这条学习路径开始起作用了

不是看你记住了多少名词，而是看你是否能做到这些：

1. 能解释为什么某个页面应该是 Server Component
2. 能独立新增一个 NestJS 模块
3. 能自己做一次 Prisma migration
4. 能看懂登录链路里的 Token 流转
5. 能解释一个请求从页面到数据库经过了哪些层
6. 能区分哪些技术需要深学，哪些先会用就够

> 这份文档的目标不是让你“看起来很懂”，而是让你在做项目的过程中，真的长出下一次独立搭系统的能力。
