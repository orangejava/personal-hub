# Nest M2 第 1 刀：登录、当前用户、刷新与登出

> 状态：✅ 已落地
> 最后更新：2026-08-28
> 依据：[Auth/RBAC PRD](../../../../docs/prd/long-term/auth-rbac-session-prd.md)、[Canonical API](../../../../docs/backend/canonical-api.md)

## 目标与边界

本切片让 React 登录页接到真实 Nest API，并在浏览器里完成登录、刷新、退出。

已实现：

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`（页面刷新后换 Access Token）
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- Access JWT（8 小时，仅内存）+ Refresh HttpOnly Cookie（7 天）
- 未验证 / 禁用账号拒绝登录；密码错误统一 `AUTH_INVALID_CREDENTIALS`
- MEMBER 活跃会话上限 5；登录失败计数限流。`429 AUTH_RATE_LIMITED` 带 `Retry-After`（窗口秒数）。登录页 Alert 展示剩余冷却时间，冷却内禁用提交。图形验证码见 [auth-captcha-slice.md](./auth-captcha-slice.md)

后续切片（不要再把它们当成「本刀未做」）：

- 权限菜单：[auth-permissions-slice.md](./auth-permissions-slice.md)
- 公开注册与邮件验证：[auth-register-slice.md](./auth-register-slice.md)
- 忘记密码：[auth-forgot-password-slice.md](./auth-forgot-password-slice.md)

M2 Auth HTTP 仍不做：TOTP、真实 SMTP。总表见 [README.md](./README.md)。

## 调用链

```text
React 登录页
  → POST /api/v1/auth/login（经 Umi 代理到 :3001）
  → 校验密码、写 auth_sessions / refresh_tokens
  → 响应 Access Token；Set-Cookie ph_refresh
  → 前端把 Access Token 放内存，并把角色映射为 mock-token 供其余 mock 业务接口使用

页面刷新
  → POST /api/v1/auth/refresh（带 Cookie）
  → 轮换 Refresh Token，签发新 Access Token
  → 401：清内存登录态，按未登录处理
  → 403 / 5xx / 断网：不清会话，不跳登录页，提示稍后刷新
```

## 登出与 Redis 会话

`POST /api/v1/auth/logout` 与 refresh 一样自己认会话：优先 Refresh Cookie，没有再用 Access Token。Access 过期时不必先换票。前端仍须等接口成功再清内存 Token 并跳登录页。

- 登出成功：清本地登录态，跳 `/user/login`
- 断网 / 5xx / Origin 不允许（403）：提示错误，留在当前页，会话保持
- 无有效凭证：服务端仍返回 200 并清 Cookie，前端按成功退出处理

开发期 Umi 代理 `changeOrigin` 可能把 Nest 收到的 Origin 改成 `http://127.0.0.1:3001`。校验改为：Origin 或 Referer 任一等于 `CORS_ORIGIN` 即通过；代理也会把浏览器 Origin 原样转发。

Redis `auth:session:{sid}` 会带上登录邮箱快照，只为方便对照账号，不参与鉴权。已有旧键没有 `email` 字段，重新登录或刷新后才会写入。

历史失败登出留下的 Redis 会话键会等到 Refresh TTL（最长 7 天）过期，不会被这次修复自动清掉。

`NODE_ENV=test` 时 Nest `ConfigModule` 不读 `.env.local`。HTTP 测试必须先写好 `process.env` 再动态 `import` AppModule（`ConfigModule.forRoot` 在加载时就会校验）。会话只进 Testcontainers Redis（前缀 `ph:auth-http-test:`）。用例结束后仍用本轮 Refresh Cookie 登出，作为双保险。

## 本地联调

1. `docker compose -f compose.dev.yml up -d`
2. `pnpm --filter server prisma:deploy && pnpm --filter server prisma:seed`
3. `pnpm --filter server seed:local-users`（写入文档中的 `owner@example.com` / `HubDev!234`）
4. `pnpm dev:server` 与 `pnpm dev:user`
5. 打开 `http://localhost:8000/user/login`，使用 [本地开发账号](../../../../docs/engineering/dev-credentials.md)

空库首次创建系统所有者仍用 `bootstrap:super-admin`。日常联调账号用 `seed:local-users`；也可自行注册后走邮箱验证。

## 关键文件

- `apps/server/src/modules/auth/`：Controller / Service / Repository / JWT Guard
- `apps/server/src/config/config.module.ts`：测试忽略 `.env.local`
- `apps/server/src/infrastructure/http/refresh-cookie.ts`：Cookie 写入
- `apps/user-web/src/auth/session.ts`：内存 Access Token
- `apps/user-web/src/services/auth.ts`：refresh 仅在 401 清会话
- `apps/user-web/src/pages/user/login/index.tsx`：登录失败冷却读 `Retry-After`
- `apps/user-web/config/proxy.ts`：`/api/v1` → Nest `:3001`

## 验证

1. 运行 `pnpm --filter server test`，覆盖登录成功、错误密码、未验证/禁用、刷新与登出；`REDIS_KEY_PREFIX` 应为 `ph:auth-http-test`。
2. 浏览器用 `owner@example.com` 登录后，工作区/后台菜单来自 Nest `/auth/permissions`。
3. 刷新页面后仍保持登录；退出后 `/auth/me` 返回 401。
