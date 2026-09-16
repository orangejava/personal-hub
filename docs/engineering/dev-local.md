# 本地开发命令

> 状态：🟢 本地开发速查（2026-09-15）
> 账号与端口：[dev-credentials.md](./dev-credentials.md)
> 生产服务器操作：[../deploy/production-runbook.md](../deploy/production-runbook.md)
> Git 提交规范：[../../.agents/skills/git-commit/SKILL.md](../../.agents/skills/git-commit/SKILL.md)（不要在本文件展开）

仓库根执行，除非写了 `cd`。Node 用 `.nvmrc`：`nvm use`。

---

## 1. 仓库 / pnpm / Turbo

```bash
nvm use
pnpm install
pnpm lint
pnpm typecheck
pnpm build
pnpm format
```

---

## 2. 本地依赖（Docker Compose）

```bash
docker compose -f compose.dev.yml up -d
docker compose -f compose.dev.yml ps
docker compose -f compose.dev.yml logs -f postgres
docker compose -f compose.dev.yml exec postgres psql -U personal_hub -d personal_hub
docker compose -f compose.dev.yml exec redis redis-cli -a personal_hub_redis_dev_password
docker compose -f compose.dev.yml down
```

只起 PostgreSQL、Redis、MinIO、Mailpit。**Nest 和前端不在这个文件里。**

---

## 3. Nest（apps/server）

```bash
# 日常
pnpm --filter server prisma:generate
pnpm --filter server prisma:deploy
pnpm --filter server seed:local-users    # 仅本地；生产禁止
pnpm dev:server
pnpm dev:worker

# 质量
pnpm --filter server lint
pnpm --filter server typecheck
pnpm --filter server test
pnpm --filter server build

# 开发迁库（改 schema 后）
pnpm --filter server prisma:migrate -- --name describe_the_change
pnpm --filter server prisma:studio

# 空库系统所有者（读 .env.local）
pnpm --filter server bootstrap:super-admin

# 存量小册
pnpm booklet:import-local -- --source /path/to/booklets --dry-run
pnpm booklet:import-local -- --source /path/to/booklets --execute
```

本地测 AI 图/视频必须同时有 `dev:server` + `dev:worker`。不要用 `dev:user:mock` 测 Nest。

---

## 4. 用户端 / 管理端

```bash
pnpm dev:user              # :8000，MOCK=none
pnpm dev:admin             # :8001，MOCK=none
pnpm build:user
pnpm build:admin
pnpm --filter user-web lint
pnpm --filter admin-web lint
pnpm --filter user-web test

# 仅排障 / 阶段 A
pnpm dev:user:mock
pnpm dev:admin:mock
pnpm --filter user-web sync:booklets   # mock 小册，不是 Nest 导入
```

生产管理端静态前缀：`PUBLIC_PATH=/admin/ pnpm --filter admin-web build`（Nginx 镜像 Dockerfile 已写）。

---

## 5. 生产命令入口

生产服务器命令不放在本地开发速查中，统一见：

- [生产服务器操作手册](../deploy/production-runbook.md)
- [首次上线检查清单](../deploy/prod-startup-order.md)

---

## 6. Prisma 注意

| 命令                                      | 环境                           |
| ----------------------------------------- | ------------------------------ |
| `prisma:migrate`                          | 只本地开发，会写新 migration   |
| `prisma:deploy` / 容器内 `migrate deploy` | 应用已有 migration，生产用这个 |
| `migrate reset`                           | 清空本地库，生产禁止           |
| `seed:local-users`                        | 写入 `HubDev!234`，生产禁止    |
| `prisma/seed.ts`                          | 角色菜单 + 当前还会带样例内容  |

---

## 7. Git（只列日常，规范看 skill）

```bash
git status
git diff
git log --oneline -15
```

未获用户明确授权不要 `git commit` / `git push`。

---

## 8. 腾讯云（控制台为主）

对象存储、域名、SSL、邮件推送一般在网页控制台操作，没有必须每天敲的 CLI。准备事项见 [../deploy/tencent-cloud-prep.md](../deploy/tencent-cloud-prep.md)。
