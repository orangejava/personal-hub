# Nest 阶段 0：问题复盘

> 状态：已完成  
> 最后更新：2026-08-08  
> 关联：[阶段 0 实现记录](../../docs/implementation/foundation/nest-server-bootstrap.md)、[面试题](../interview/nest-phase-0-bootstrap.md)、[HTTP 适配器技术比较](./nest-http-adapter-comparison.md)

## 1. 场景背景

阶段 0 的目标不是实现业务接口，而是建立可长期演进的 Nest 服务底座：环境配置、PostgreSQL、Redis、健康检查、Swagger、请求关联 ID 和本地 Compose。

这类阶段最容易遇到的不是业务 Bug，而是“多个工具对同一约定的理解不同”：Nest 运行时、Prisma CLI、pnpm 依赖树和 Docker 各自有生命周期与配置加载规则。

## 2. 实际问题与排查过程

| 现象 | 根因 | 排查证据 | 修复与通用经验 |
| --- | --- | --- | --- |
| `prisma migrate deploy` 报 `DATABASE_URL` 缺失 | Prisma CLI 不会自动按 Nest 的 `.env.local` 约定加载配置 | Nest 可读取环境变量，但 Prisma P1012 明确指出变量不存在 | 使用 `dotenv-cli -e .env.local -- prisma ...`，让迁移与应用读取同一配置。 |
| `EADDRINUSE: 3001` | 失败的 watch 子进程和重复启动同时抢占端口 | `lsof` 查到多个 Node/Nest 进程监听 3001 | 启动前检查端口，停止旧进程，只保留一个 `pnpm dev:server`。 |

## 3. 复用的排障顺序

1. 先看完整终端日志，区分“编译失败、启动失败、端口冲突、请求运行时异常”。
2. 用 `docker compose ... ps` 确认数据库和 Redis 是否真正健康。
3. 用 `lsof -nP -iTCP:3001 -sTCP:LISTEN` 确认监听者，而不是重复启动服务。
4. 分别执行 Prisma migration、服务启动、health/readiness/Swagger 的 HTTP 探测。
5. 最后执行 `pnpm --filter server lint && pnpm --filter server typecheck && pnpm --filter server test && pnpm --filter server build`。

## 4. 手动复盘

1. 启动 Compose 后，执行 `pnpm --filter server prisma:deploy`。
2. 启动 `pnpm dev:server`，访问 health、readiness、Swagger。
3. 查看响应体与 `X-Request-Id` 是否一致，并检查 Pino 日志能否使用该 ID 定位请求。
4. 停止 Redis，确认 liveness 仍可访问、readiness 返回不可用；恢复 Redis 后再次验证。
