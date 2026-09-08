# 用户端 / 管理端拆分为两个前端

> 状态：✅ 已落地（批次 0–3 + 优化 A/B/C/D）
> 最后更新：2026-09-09
> 范围：Nest Origin 白名单、`apps/admin-web`、用户端 `apps/user-web`、共享包、生产 Compose 骨架

## 1. 目标与范围

把后台从原 `apps/react-web` 拆成独立 Umi 应用 `apps/admin-web`，用户端改名为 `apps/user-web`。两边继续用 Ant Design Pro，不换 Vite / Next。

本轮做到：

- 两个 Origin：用户端 `:8000`，管理端 `:8001`，Nest `:3001`
- 登录页只在用户端；管理端靠 Refresh Cookie + `/auth/refresh` 恢复会话
- Origin / Auth HTTP 抽到 `packages/app-origins` 与 `packages/api-client`
- 应用专属文档进 `apps/*/docs`，全局 `docs/` 留索引、跨端契约与旧路径 stub
- 生产骨架：`compose.prod.yml` + Nest / Nginx Dockerfile（不要 PM2）

明确不做：本地不把两端反代成同一 Origin。生产拓扑见 [nest-compose-strategy.md](../deploy/nest-compose-strategy.md)。

## 2. 页面与入口

| 应用 | 地址 | 职责 |
| --- | --- | --- |
| `apps/user-web` | http://localhost:8000 | 公开前台、工作区、AI、登录 |
| `apps/admin-web` | http://localhost:8001 | `/admin/*` 后台；`/` 重定向到运营概览 |
| `apps/server` | http://localhost:3001 | `/api/v1` |

未登录打开管理端会 `window.location` 跳到：

`http://localhost:8000/user/login?redirect=<管理端绝对 URL>`

登录成功后，仅当 `redirect` 的 Origin 等于 `UMI_APP_ADMIN_WEB_ORIGIN` 才整页离开用户端。

## 3. 接口与数据流

1. 用户在 `:8000` 登录。Nest 写 `ph_refresh` Cookie（不设 Domain，`Path=/`，`SameSite=Lax`）。Cookie 按 host 不计端口，`:8001` 的请求也能带上。
2. Access Token 只在当前页内存。跳到管理端后内存是空的，必须先 `POST /api/v1/auth/refresh`。
3. 两端 Umi 都把 `/api/v1` 代理到 Nest，并原样转发浏览器 `Origin` / `Referer`，避免 `changeOrigin` 把来源改成 `:3001` 导致 `AUTH_ORIGIN_FORBIDDEN`。
4. Nest `CORS_ORIGIN` 是逗号分隔白名单（默认含 `:8000` 与 `:8001`）。验证/重置邮件链接用单独的 `PUBLIC_APP_ORIGIN`（默认用户端），不要用 CORS 第一项。

## 4. 关键实现

- Origin 解析：`apps/server/src/config/env.schema.ts` 的 `parseCorsOriginList`；空列表时 Cookie 鉴权回退 `PUBLIC_APP_ORIGIN`
- Cookie 接口校验：`apps/server/src/modules/auth/origin.ts` 的 `assertSameOrigin` 对白名单匹配
- 跨应用地址：`packages/app-origins`（`getUserWebOrigin` / `buildAdminWebUrl` / `resolvePostLoginRedirect` / `forwardBrowserOriginOnProxyReq`）
- Auth HTTP：`packages/api-client` 的 `createAuthApi`（各 app 注入 Umi `request` 与 `mapNestMenusToLayout`）
- 管理端启动：`apps/admin-web/src/app.tsx` 的 `getInitialState` 走 `fetchCurrentUser`（无 Access 时先 refresh）
- 用户端「后台管理」：`buildAdminWebUrl()` 整页跳 `:8001`，不再挂 `/admin` 子树
- `admin:access`：`adaptNestPermissions` 同时看 `scope === 'ADMIN'` 与 `hasMenuPath('/admin')`

## 5. 权限与异常

- 管理端路由仍用 `access: 'canAdmin'`
- 成员打开 `:8001`：有 Cookie 则进应用，无后台菜单时落到 403；无 Cookie 则跳登录
- 开放重定向：`resolvePostLoginRedirect` 只允许管理端 Origin 的绝对 URL

## 6. 验证方式

见 `docs/engineering/dev-credentials.md`。日常：`pnpm dev:server` + `pnpm dev:user` + `pnpm dev:admin`（默认无 mock），用 `owner@example.com` 登录后点「后台管理」。内容等页面仍要 mock 时改用 `dev:user:mock` / `dev:admin:mock`。`pnpm dev:react` 仍指向用户端。

## 7. 后续优化清单

下面这些已经落地。历史文档里的目录名 `apps/react-web` 仍可能出现在 `docs/history/`，以当时方案为准。

### A. 工程命名 ✅

| 项 | 结果 |
| --- | --- |
| 用户端改名 | 目录/包名 `apps/user-web` / `user-web` |
| 根脚本 | `dev:user` / `build:user`；`dev:react` / `build:react` 暂作别名 |
| 文档与脚本 | 当前路径已换成 `user-web`；阶段 A PM2 仍只起用户端 mock |

### B. 抽出共享包 ✅

| 项 | 落点 |
| --- | --- |
| 站点 Origin、`PUBLIC_PATH`、代理 Origin 转发 | `packages/app-origins` |
| 会话、Auth HTTP、权限适配 | `packages/api-client`（不依赖 Umi；401 跳转留在各 app） |
| 菜单路径解析 | 仍在各 app 的 `routeRegistry.ts`（两端 routeKey 不同） |

### C. 生产 Compose ✅ 骨架（未对真实环境发布）

| 项 | 说明 |
| --- | --- |
| Nest `Dockerfile` | `apps/server/Dockerfile`；`server` 与 `server-worker` 同一镜像 |
| 前端静态 | `deploy/nginx/Dockerfile`：用户端 `/`；管理端 `PUBLIC_PATH=/admin/` 挂 `/admin` |
| `compose.prod.yml` | Nginx + 两份静态 + `server` + `server-worker` + Postgres + Redis；**不要 PM2** |
| 生产 env | 模板 `.env.prod.example`（复制为 `.env.prod`）；`CORS_ORIGIN` 可留空 |
| `server-worker` | **不是 stub**。`apps/server/src/worker.ts` 独立进程：Outbox dispatcher + BullMQ 消费 `booklet-import`；本地 `pnpm dev:worker` |
| 域名 / 镜像仓库 | 仍不虚构；实际部署再填 |

### D. 拆分留下的边角 ✅

| 项 | 说明 |
| --- | --- |
| 管理端脚手架残留 | 已删 LICENSE / CODE_OF_CONDUCT / 多余 `.husky`；未使用的 `src/config/publicMenu.ts` |
| 用户端 mock `/api/admin/*` | 已去掉 `POST /api/admin/system/config` |
| mock 路由重复告警 | 去掉 Umi `mock.include` 对 `mock/**/*.ts` 的二次加载 |
| 前端 CI | `.github/workflows/web-ci.yml`：两端 `tsc` + `biome:lint`，以及两个共享包 typecheck |
| `devCredentials` | 管理端 mock 用户仍引用，保留 |

### 明确先不做

- 本地把 `:8000` / `:8001` 反代成同一 Origin（开发就要两个 Origin 才能测 Cookie）
- 把用户端改成 Next、把后台改成 Vite
- Flutter
- 真实域名、镜像仓库、TLS 证书、COS 替换 MinIO 环境变量

