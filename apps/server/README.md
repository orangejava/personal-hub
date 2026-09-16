# Personal Hub Nest Server

NestJS + Express 后端。阶段 0 脚手架与 **M1–M6**（Auth、系统配置/菜单、内容、文件/小册、AI）已落地。跨端契约在仓库根 `docs/backend/`；切片说明在 [docs/README.md](./docs/README.md)。

当前产品主线是首版上线，不是继续开 M7。见 [docs/deploy/go-live-mainline.md](../../docs/deploy/go-live-mainline.md)。本地账号见 [docs/engineering/dev-credentials.md](../../docs/engineering/dev-credentials.md)。

## 本地启动

```bash
cp apps/server/.env.example apps/server/.env.local
docker compose -f compose.dev.yml up -d
pnpm --filter server prisma:generate
pnpm --filter server prisma:deploy
pnpm --filter server seed:local-users
pnpm dev:server
# ZIP / AI 图视频：
pnpm dev:worker
```

- Swagger：`http://localhost:3001/api/docs`
- 存活检查：`http://localhost:3001/api/v1/health/live`
- 就绪检查：`http://localhost:3001/api/v1/health/ready`
- Mailpit：`http://localhost:8025`
- MinIO Console：`http://localhost:9001`

页面请走 `http://localhost:8000`，不要直接打开 `:3001` 登录。`.env.local` 仅供本机使用，不得提交。

## 质量命令

```bash
pnpm --filter server lint
pnpm --filter server typecheck
pnpm --filter server test
pnpm --filter server build
```
