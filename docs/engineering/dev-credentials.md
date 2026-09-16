# 本地开发常用信息

> 状态：✅ 已确定（2026-09-13）
> 适用范围：本地 Nest 联调。**生产环境禁止使用本组密码。**
> 其它文档（工程指南、`.env.example`、实现说明）原文不变；日常查账号、端口、邮箱先看这一页。
> 当前主线是上线部署，见 [../deploy/go-live-mainline.md](../deploy/go-live-mainline.md)。生产账号只走 `bootstrap:super-admin`，不要把本页密码拷到服务器。

当前 React 默认 **不加载 Umi mock**（`MOCK=none`）。登录、公开内容、工作区、后台分类/标签/文件、AI 目录与 SSE 都走 Nest `/api/v1`。也可在 `http://localhost:8000/user/register` 自行注册；验证 / 重置邮件只出现在本地 Mailpit，不会发到公网。管理端没有独立登录页，未登录访问 `http://localhost:8001` 会跳回用户端登录。

不要用 `pnpm dev:user:mock` 测 Nest：页面会混 mock，和 Canonical 对不上（尤其是 AI）。阶段 A PM2 个人远程阅读才走 `dev:mock`。

---

## 1. 本地地址

| 用途                                      | 地址                           |
| ----------------------------------------- | ------------------------------ |
| 用户端 React                              | http://localhost:8000          |
| 管理端 React                              | http://localhost:8001          |
| Nest API（经前端代理，不要直连登录/刷新） | http://localhost:3001/api/v1   |
| Nest Swagger                              | http://localhost:3001/api/docs |
| Mailpit 收信                              | http://localhost:8025          |
| MinIO S3 API                              | http://localhost:9000          |
| MinIO Console                             | http://localhost:9001          |

启动（缺一步，AI 表或小册会 500 / 假 404）：

```bash
docker compose -f compose.dev.yml up -d
pnpm --filter server prisma:deploy
pnpm --filter server seed:local-users
pnpm dev:server
pnpm dev:user          # MOCK=none，只打 Nest
pnpm dev:admin         # MOCK=none
pnpm dev:worker        # ZIP 导入、AI 图/视频任务才需要
# 存量小册目录导入（不要用 mock 扫目录）：
pnpm booklet:import-local -- --source <本地小册目录> --execute
```

| 命令                                    | Mock | 说明                                                           |
| --------------------------------------- | ---- | -------------------------------------------------------------- |
| `pnpm dev:user` / `dev:admin`           | 关   | 日常联调 Nest。内容、工作区、后台、AI 目录/Chat 已走 Nest      |
| `pnpm dev:worker`                       | —    | Outbox + BullMQ：小册 ZIP、AI 图片/视频。只测 Chat/Text 可不启 |
| `pnpm booklet:import-local`             | —    | 把本地小册目录写入 Nest，不再依赖 `dev:user:mock`              |
| `pnpm dev:user:mock` / `dev:admin:mock` | 开   | 仅排障或阶段 A；`/api/v1` 仍可能代理 Nest，页面数据会混 mock   |
| `pnpm build:user` / `build:admin`       | 无   | `max build` 不跑 mock 中间件，产物不含 `mock/`                 |

`dev:no-mock` 仍可用，等同默认 `dev`。`seed:local-users` 会跑基线 seed、重置固定账号、写入 Fake AI 目录与示例内容。

---

## 2. Nest 登录账号（日常联调用这个）

```bash
pnpm --filter server seed:local-users
```

命令会重置本地库中的固定账号（已有 super_admin 只改这一条，不会再创建第二个系统所有者）。`NODE_ENV=production` 时拒绝执行。实现：`apps/server/src/cli/seed-local-dev-users.ts`。没有单独的 `ADMIN` 种子账号；进后台用系统所有者。

| 角色       | 邮箱                 | 密码         | 说明                                                  |
| ---------- | -------------------- | ------------ | ----------------------------------------------------- |
| 系统所有者 | `owner@example.com`  | `HubDev!234` | Nest `SUPER_ADMIN`，工作区 + 后台 + AI 配置           |
| 编辑者     | `editor@example.com` | `HubDev!234` | Nest `EDITOR`，可上传小册（需 `booklet:write`）       |
| 普通会员   | `member@example.com` | `HubDev!234` | Nest `MEMBER`，含 `ai:use`；测 Chat / 额度 / 匿名认领 |

打开 http://localhost:8000/user/login 用上表登录。`mustChangePassword` 为 `false`。密码都满足 Nest 策略，不要用下面 mock 表里的 `dev123456`。

首次空库可用 `bootstrap:super-admin`（读 `.env.local` 的 `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_TEMP_PASSWORD`）。示例默认邮箱仍是 `owner@example.com`，临时密码见 `apps/server/.env.example` 的 `ReplaceWithAOneTimePassword!1`，登录后必须改密。日常忘了密码，重新跑 `seed:local-users` 即可。

测后台 AI 配置：所有者登录后从用户端进管理端，打开 http://localhost:8001/admin/ai/config。

---

## 3. Mock 账号（仅 `UMI_APP_NEST_AUTH=0` / `dev:*:mock`）

| 角色     | 邮箱                 | 密码               | 说明                                  |
| -------- | -------------------- | ------------------ | ------------------------------------- |
| 管理员   | `admin@example.com`  | `yyQhItHlRe8Q9suV` | 强随机密码，可访问工作区 + 后台       |
| 编辑者   | `editor@example.com` | `dev123456`        | 可访问工作区、创建/发布内容、上传小册 |
| 普通会员 | `member@example.com` | `dev123456`        | 仅公开区阅读 + AI 入口                |

- 账号定义：`apps/user-web/mock/data/devCredentials.ts`（管理端同名文件）
- mock 校验：`apps/user-web/mock/data/users.ts`
- 登录页**不展示**账号密码。
- `dev123456` 不满足 Nest 密码策略，Nest 联调不要用 mock 密码。

---

## 4. 基础设施账号（Compose）

权威连接串仍以 `apps/server/.env.example` 为准。图形工具连本机映射端口即可，不要再起一套本机 Postgres/Redis。

| 服务          | 地址                                  | 账号 / 密码                                                                   |
| ------------- | ------------------------------------- | ----------------------------------------------------------------------------- |
| PostgreSQL    | `localhost:5432`，库名 `personal_hub` | `personal_hub` / `personal_hub_dev_password`                                  |
| Redis         | `localhost:6379`                      | 密码 `personal_hub_redis_dev_password`；键前缀 `ph:dev:`                      |
| Mailpit SMTP  | `localhost:1025`                      | 无；发件人 `Personal Hub <noreply@localhost>`                                 |
| Mailpit UI    | http://localhost:8025                 | 无                                                                            |
| MinIO S3      | `localhost:9000`                      | `personal_hub_minio` / `personal_hub_minio_dev_secret`，桶 `personal-hub-dev` |
| MinIO Console | http://localhost:9001                 | 同上                                                                          |

```bash
docker compose -f compose.dev.yml exec postgres psql -U personal_hub -d personal_hub
docker compose -f compose.dev.yml exec redis redis-cli -a personal_hub_redis_dev_password
```

排障细节见 [engineering-guide.md](./engineering-guide.md)（原文保留）。

---

## 5. 自动化测试账号（不要用来登录 :8000）

`pnpm --filter server test` 使用 **临时 Testcontainers**，前缀 `ph:auth-http-test:`，测完即销毁。`NODE_ENV=test` 时 Nest 不读 `.env.local`，不会把会话写进上面这套开发 Redis。HTTP 用例在 `afterEach` 里再用本轮 Refresh Cookie 调 `POST /auth/logout`，作为双保险。

测试里常见邮箱：`owner@` / `editor@` / `member@` / `admin@` / `root@` / `captcha@` 等，密码是 **`OwnerPass!1`**，不是 `HubDev!234`。

---

## 6. 安全说明

- 上述密码**仅用于本地开发**，不得用于生产。
- 生产首个 `super_admin` 只通过容器内 `bootstrap:super-admin` 创建，密码来自部署环境变量。
- 浏览器必须走 `http://localhost:8000` 打开页面；Umi 代理须把浏览器 `Origin` 原样转给 Nest。若 Nest 实际收到 `http://127.0.0.1:3001`，logout/refresh 会 `403 AUTH_ORIGIN_FORBIDDEN`（浏览器 Network 里仍可能显示 localhost）。
- 不要直接打开 `http://localhost:3001` 登录（Origin 不对会 403）。

## 相关决策

- 小册上传：仅 `editor` / 后台角色（需 `booklet:write`），`member` 不可上传。
- 站点显示名：开发期用 Nest `system_configs`，后台可改；与有没有域名无关。
- 域名：首版上线用公网 IP，见 [../deploy/go-live-mainline.md](../deploy/go-live-mainline.md) §3。开发环境继续 `http://localhost:8000`。
