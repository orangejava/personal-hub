# 技术学习地图（结合本项目）

> 目标：不是把所有技术都学一遍，而是只学习“当前阶段马上会用到”的最小知识，再通过项目实战加深理解。

---

## 1. 学习原则

### 原则 1：先学最小闭环

例如学 NestJS，不要先把所有高级特性都看完。先学：

- module
- controller
- service
- DTO
- Swagger

只要能写出一个接口，就足够进入项目实战。

### 原则 2：边学边做

每学一个概念，立刻在项目里落一次：

- 学 Prisma migration → 马上给表加字段
- 学 Next.js ISR → 马上用于内容详情页
- 学 Guard → 马上保护工作区接口

### 原则 3：先解决“为什么”，再记“怎么写”

例如 JWT，不要只背 API。先理解：

- 为什么要区分 Access Token 和 Refresh Token
- 为什么 Refresh Token 放 HttpOnly Cookie 更安全

---

## 2. 学习顺序总览

```text
第一层：TypeScript / pnpm / Monorepo
第二层：Next.js / NestJS
第三层：Prisma / PostgreSQL / JWT / RBAC
第四层：Redis / SSE / Docker / CI/CD
第五层：AI 代理 / 文件存储 / Flutter 接入
```

---

## 3. 分技术学习说明

## TypeScript

### 为什么要学

- 这是整个项目的主语言。
- Next.js、NestJS、Prisma 都围绕 TypeScript 组织。

### 重点学什么

- interface / type
- 泛型基础
- 联合类型
- 类型收窄
- 函数参数与返回值标注

### 在项目里哪里会用到

- DTO 类型
- React Props
- Prisma 查询结果类型
- API 响应结构

### 达标标准

- 能看懂大多数 TS 报错并自己修复
- 能给组件和函数补出明确类型

---

## Next.js

### 为什么要学

- 它承载前台、工作区、后台三类页面。
- 你已经写过 React，Next.js 是在 React 之上加工程能力。

### 重点学什么

- App Router
- layout / page
- 动态路由 `[slug]`
- Server Component / Client Component
- `fetch` / `revalidate`
- 表单和客户端交互

### 最小实践任务

1. 新建首页
2. 新建 `/content` 列表页
3. 新建 `/content/[slug]` 详情页
4. 给详情页加 ISR

---

## NestJS

### 为什么要学

- 它是整个后端主框架。
- 你的认证、权限、AI 代理、文件上传都在这里。

### 重点学什么

- module / controller / service
- DTO
- ValidationPipe
- Guard
- Interceptor
- Exception Filter
- Swagger

### 最小实践任务

1. 写 `GET /health`
2. 写 `POST /auth/login`
3. 写一个需要登录的接口

---

## Prisma

### 为什么要学

- 它决定你怎么定义和操作数据库。

### 重点学什么

- `schema.prisma`
- model / relation
- `prisma migrate dev`
- `prisma generate`
- `prisma studio`
- CRUD 查询

### 最小实践任务

1. 建 `User` 表
2. 新增 `Content` 表
3. 完成一次迁移
4. 用 Prisma 查询一条内容详情

---

## PostgreSQL

### 为什么要学

- ORM 最终还是落到数据库。
- 不理解数据库，就很难正确建模和优化查询。

### 重点学什么

- 表、主键、外键
- 唯一约束
- 索引
- offset 分页
- 排序
- JSONB

### 最小实践任务

1. 设计内容相关表关系
2. 给 `slug` 加唯一索引
3. 用分页查询内容列表

---

## JWT / RBAC

### 为什么要学

- 本项目所有登录态与权限控制都依赖它。

### 重点学什么

- Access Token vs Refresh Token
- 过期时间设计
- 角色和权限点的区别
- 后端权限校验 vs 前端菜单显隐

### 最小实践任务

1. 登录成功签发 Token
2. 访问受保护接口
3. 用权限点保护发布内容接口

---

## Redis

### 为什么要学

- 适合做短时数据存储和性能优化，不适合替代主数据库。

### 重点学什么

- key/value
- TTL
- 限流计数
- 热点缓存

### 最小实践任务

1. 缓存首页热门内容
2. 给登录接口加失败次数限制

---

## SSE

### 为什么要学

- AI 输出不是一次性返回，而是逐步流式返回。

### 重点学什么

- HTTP 长连接的基本概念
- SSE 数据格式
- 前端如何逐块接收并渲染

### 最小实践任务

1. 后端返回一个模拟流式消息
2. 前端边接收边显示文本

---

## Docker

### 为什么要学

- 本地开发和线上部署都依赖它。

### 重点学什么

- Dockerfile
- docker compose
- 镜像与容器
- 端口映射
- volume

### 最小实践任务

1. 用 compose 起 PostgreSQL + Redis
2. 给 API 写 Dockerfile
3. 给 Web 写 Dockerfile

---

## Turborepo

### 为什么要学

- 它是这个 Monorepo 的任务中枢。

### 重点学什么

- root scripts
- task dependencies
- cache
- filter

### 最小实践任务

1. 跑通 `pnpm dev`
2. 跑通 `pnpm build`
3. 理解为什么 shared-types 改了后 web/api 会受影响

---

## 4. 推荐学习路径

### 第一步：先让工程跑起来

- TypeScript 基础
- pnpm workspace
- Turborepo 基础
- Next.js 基础
- NestJS 基础

### 第二步：再学数据与认证

- Prisma
- PostgreSQL
- JWT
- RBAC

### 第三步：再学性能与部署

- Redis
- ISR / revalidate
- Docker
- CI/CD

### 第四步：最后学 AI 与多端

- SSE
- AI 代理模式
- Flutter API 复用

---

## 5. 学习时的常见误区

### 误区 1：还没开始做项目，就想把所有技术都学完

这是最常见的问题。正确做法是：学到能支撑下一步开发即可。

### 误区 2：只看教程，不做最小实践

看懂和会做不是一回事。每学一个点，都要立刻在项目里落一次。

### 误区 3：只会抄代码，不理解分层原因

例如 NestJS 的 `controller/service` 分层，不是为了形式，而是为了把请求入口与业务逻辑拆开，后期更好测、更好复用。

---

## 6. 一个简单的学习判断标准

学完一个技术后，问自己 3 个问题：

1. 它解决什么问题？
2. 为什么在这个项目里需要它？
3. 如果不用它，替代方案是什么？

能回答出来，才算真正开始理解。