# personal-hub

个人知识中台 + 内容管理平台 + AI 工具箱。

## 当前阶段

React-first 用户端：`apps/user-web`（`:8000`）；管理端：`apps/admin-web`（`:8001`）；Nest：`apps/server`。

## 本地启动

```bash
pnpm install
pnpm sync:booklets   # 需本地 content-local/（不进 Git）
pnpm dev:server
pnpm dev:user        # http://localhost:8000（`pnpm dev:react` 仍是同一命令的别名）
pnpm dev:admin       # http://localhost:8001
```

### Nest 阶段 0（本地）

```bash
cp apps/server/.env.example apps/server/.env.local
docker compose -f compose.dev.yml up -d
pnpm --filter server prisma:generate
pnpm --filter server prisma:deploy
pnpm dev:server
```

详细说明见 [apps/server/README.md](apps/server/README.md)。

## 文档

- [项目总纲](docs/overview.md)
- [文档目录规范](docs/README.md)
- [Agent 规则与技能](.agents/README.md)
- [Git 提交 skill](.agents/skills/git-commit/SKILL.md)
- [部署文档入口](docs/deploy/README.md)
- [个人远程阅读方案](docs/deploy/personal-remote-reading.md)
- [React 远程部署速查](docs/deploy/server-deployment-guide.md)
