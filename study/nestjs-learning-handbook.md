# NestJS 学习手册

> 面向主要写前端、准备自己搭后端 API 的开发者。
> 最后更新：2026-06-01

---

## 1. 先把 NestJS 当成什么

NestJS 可以先理解成：

- 一个强约定、模块化的 Node.js 后端框架
- 它帮你把“接口、业务逻辑、依赖注入、权限、校验、文档”组织清楚

它和前端组件化很像，只是对象从“页面组件”变成了“后端模块”。

---

## 2. 当前项目里，NestJS 负责什么

- 认证与权限
- 内容系统接口
- AI 代理层
- 文件上传
- 后台管理接口
- Swagger 文档

---

## 3. 你先只学这 7 件事

1. `module`
2. `controller`
3. `service`
4. DTO
5. ValidationPipe
6. Guard
7. Swagger

---

## 4. 最重要的职责边界

### Controller

负责：

- 接收请求
- 读取参数
- 调用 Service
- 返回响应

不应该负责：

- 大量业务逻辑
- 直接写复杂数据库查询

### Service

负责：

- 业务逻辑
- 调用 Prisma
- 组合多个业务步骤

### Module

负责：

- 把一组相关的 Controller、Service、Provider 组织在一起

---

## 5. 你当前项目最小应该先完成什么

### 第一个接口：`GET /api/health`

目的：

- 理解一个请求如何进入 Controller，再进入 Service
- 跑通 Swagger

### 第二个接口：`POST /auth/login`

目的：

- 理解 DTO 校验
- 理解 Service 里怎么查用户、校验密码、签发 Token

### 第三个接口：受保护接口

目的：

- 理解 Guard
- 理解“登录态校验”在后端发生

---

## 6. 建议模块开发顺序

```text
health
→ auth
→ user
→ role / permission
→ content
→ category / tag
→ favorite / reading
→ ai
→ admin
```

这个顺序比“想到什么写什么”稳定得多，因为：

- 先把骨架跑通
- 再把登录态跑通
- 再把内容主线跑通
- 最后再做复杂扩展

---

## 7. 常用命令

```bash
pnpm --filter api start:dev
pnpm --filter api test
pnpm --filter api lint
```

如果项目还没初始化：

```bash
pnpm dlx @nestjs/cli new apps/api --package-manager pnpm
```

---

## 8. Guard 要怎么理解

前端开发者最容易把权限理解成“按钮显不显示”。

但在后端里，真正关键的是：

- 请求能不能进入接口
- 当前用户有没有这个能力

所以至少要理解这三层：

- `JwtAuthGuard`：你是不是登录用户
- `RolesGuard`：你是不是某个角色
- `PermissionsGuard`：你有没有某个具体权限点

---

## 9. DTO 和校验为什么重要

DTO 不只是“写类型”。

它的意义是：

- 让接口参数边界清楚
- 让 Swagger 文档更准确
- 让参数校验自动化

你后面写登录、注册、创建内容时，DTO 是非常高频的基本功。

---

## 10. 当前项目最常见的几个坑

### 坑 1：Controller 里写太多业务

一开始写后端时很容易把所有逻辑塞到一个文件里。

更好的方式是：

- Controller 只管请求和响应
- Service 管业务

### 坑 2：没做统一校验

如果没有全局 `ValidationPipe`，后面很多接口会变得不稳定。

### 坑 3：只做前端路由守卫，不做后端 Guard

这会导致权限只是“看起来有”，不是真正安全。

### 坑 4：没有 Swagger

你是一个人同时写前后端时，Swagger 就是你自己的接口合同文档。

---

## 11. 学完后至少要达到什么标准

1. 能独立写一个 NestJS 模块
2. 能写 DTO 并加校验
3. 能写一个受保护接口
4. 能用 Swagger 验证接口
5. 能说清楚一个请求从 Controller 到 Service 再到 Prisma 的链路

---

## 12. 遇到问题先怎么排查

1. 模块有没有正确 `imports/providers/controllers`
2. DTO 和全局 `ValidationPipe` 是否生效
3. Guard 是否挂在正确位置
4. Service 是否真正被注入
5. Prisma 查询是否抛出了底层错误

> 你后面能不能稳定写后端，不取决于会不会背装饰器，而取决于你能不能把模块边界守住。
