# Personal Hub Nest Server

NestJS + Express 后端运行底座。阶段 0 仅提供配置校验、PostgreSQL/Redis 连接、结构化日志、健康检查和 Swagger，不含业务领域接口。

## 本地启动

```bash
cp apps/server/.env.example apps/server/.env.local
docker compose -f compose.dev.yml up -d
pnpm --filter server prisma:generate
pnpm --filter server prisma:deploy
pnpm dev:server
```

- Swagger：`http://localhost:3001/api/docs`
- 存活检查：`http://localhost:3001/api/v1/health/live`
- 就绪检查：`http://localhost:3001/api/v1/health/ready`
- Mailpit：`http://localhost:8025`
- MinIO Console：`http://localhost:9001`

`.env.local` 仅供本机使用，不得提交。后续领域接口实现前，先阅读仓库根 `AGENTS.md` 与 `AGENT.md`。

## 质量命令

```bash
pnpm --filter server lint
pnpm --filter server typecheck
pnpm --filter server test
pnpm --filter server build
```
