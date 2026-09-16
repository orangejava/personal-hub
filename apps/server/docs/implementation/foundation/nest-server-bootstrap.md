# Nest Server 阶段 0 脚手架

> 状态：✅ 已完成
> 最后更新：2026-08-09
> 对应 PRD：[Nest Server 脚手架](../../prd/nest-server-bootstrap-prd.md)

## 目标与范围

本次新增 `apps/server`，建立后续领域模块共用的 NestJS + Express 运行底座。范围只包含配置、日志、PostgreSQL、Redis、健康检查、Swagger、Prisma 与本地依赖 Compose；不包含 Auth、RBAC、内容、文件、队列或 AI 业务端点。

## 调用链

```text
HTTP 请求
  → Express requestId middleware（服务端 UUID）
  → Controller
  → ResponseEnvelopeInterceptor / HttpExceptionFilter
  → { data | error, requestId }

readiness
  → PrismaService（SELECT 1）
  → RedisService（PING）
```

## 关键文件

- `apps/server/src/main.ts`：创建 Express 应用、加载配置并监听端口。
- `apps/server/src/bootstrap.ts`：Express 安全 middleware、`/api/v1`、Swagger 和全局 HTTP 横切能力；生产启动与 HTTP 集成测试共用。
- `apps/server/src/app.module.ts`：开发环境通过 `pino-pretty` 用颜色区分日志级别；生产保持 JSON 结构化日志。
- `apps/server/src/config/env.schema.ts`：Zod 环境变量启动校验。
- `apps/server/src/infrastructure/{prisma,redis}/`：全应用唯一数据库与 Redis 客户端生命周期。
- `apps/server/src/modules/health/`：liveness 和依赖 readiness。
- `apps/server/prisma/`：PostgreSQL 数据源与不包含业务表的初始迁移。
- `compose.dev.yml`：PostgreSQL 16、Redis 7、MinIO、MinIO Bucket 初始化和 Mailpit。

## 本地验证

1. 复制 `apps/server/.env.example` 为本机 `.env.local`，启动 `docker compose -f compose.dev.yml up -d`。
2. 执行 `pnpm --filter server prisma:generate`、`pnpm --filter server prisma:deploy`、`pnpm dev:server`。
3. 访问 `/api/v1/health/live`、`/api/v1/health/ready` 和 `/api/docs`；停止 Redis、PostgreSQL 或对象存储时，readiness 应返回不可用。
4. 开发服务启动后，终端只输出 API/health 与 Swagger 两条访问摘要；error 日志应与普通日志使用不同颜色。

> 质量收口状态：mock HTTP 测试覆盖成功、404 信封与 Redis 故障；Testcontainers 使用临时 PostgreSQL/Redis 执行正式 migration 并验证 readiness；根目录 `.github/workflows/server-ci.yml` 在 CI 执行格式、Lint、类型、测试和构建检查。

## 后续扩展

Auth 阶段从 Prisma Schema 的真实领域模型与迁移开始，并在已有 `PrismaService`、`RedisService`、统一响应和 requestId 链路上扩展。不得将 React mock 路由直接复制为 Nest 路由。
