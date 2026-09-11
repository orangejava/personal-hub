# Nest M6 AI 域

登录用户走 `/api/v1/app/ai/*`，访客走 `/api/v1/public/ai/*`。Chat/Text 用 HTTP SSE；图片/视频用 Outbox + `server-worker`。本阶段 Provider 只有 Fake / MockVideo。

## 刀序（一次性落地）

| 刀 | 内容 | 主要文件 |
| --- | --- | --- |
| 6.0 | Canonical §4.5/4.6：stop/cancel、SSE 事件、`ph_ai_anon`、公开 home/models/sessions | `docs/backend/canonical-api.md` |
| 6.1 | Prisma AI 表 + migration + seed（含角色额度） | `prisma/schema.prisma`、`prisma/migrations/20260909070000_ai_domain/`、`prisma/seed-ai.ts` |
| 6.2 | 额度账本：预占 / 结算 / 释放 / 过期；不足 409 | `ai-quota.service.ts` |
| 6.3 | Fake Provider + SSE + Redis `ai:stop:{id}` | `providers/`、`ai-runtime.service.ts` |
| 6.4 | 目录读：home / models / tools / entitlement | `app-ai.controller.ts`、`public-ai.controller.ts` |
| 6.5 | Chat/Text SSE 写路径 + 会话互斥 | `ai.service.ts` `streamChat` |
| 6.6 | 显式 stop / job cancel | `POST .../messages/:id/stop`、`.../cancel` |
| 6.7 | 匿名 Cookie Guard + 登录认领（失败不阻断） | `ai-anonymous.guard.ts`、`auth.service.ts` |
| 6.8 | 图/视频 job + Outbox + worker `processJob` | `AiImageProcessor` / `AiVideoProcessor` |
| 6.9 | 资产 / 文件夹 / usage | `app-ai.controller.ts`、`GET /app/usage` |
| 6.10 | 后台 config PATCH 模型启停；不保留 mock 野路径 | `admin-ai.controller.ts` |
| 6.11 | 前端接 Canonical；SSE 用 `fetch`；不再客户端扣费 | `apps/user-web/src/services/ai.ts` |

## 默认决策（已写死，不再问）

| 项 | 决定 |
| --- | --- |
| 权限 | Nest 新增 `ai:use`，授给 MEMBER / EDITOR / ADMIN / SUPER_ADMIN；访客走 `/public/ai` |
| 停止 | `POST .../messages/:id/stop` 与 job `.../cancel`；本机 AbortController + Redis `ai:stop:{id}` |
| 关页没点停止 | 只靠 reservation TTL（5 分钟），不断连自动 stop |
| 额度不足 | `409` `AI_QUOTA_INSUFFICIENT` |
| 并发/限流 | `429` `AI_CONCURRENCY_LIMITED`；会话互斥 `409` `AI_GENERATION_IN_PROGRESS` |
| Provider | 全程 Fake / MockVideo；真实厂商后置 |
| 登录认领匿名历史 | 尽量认领，失败不阻断登录 |
| Chat/Text | `ai_messages` + HTTP SSE（Skip 信封） |
| 图片/视频 | `ai_generation_jobs` + Outbox + `server-worker` |
| 前端枚举 | Nest `UPPER_SNAKE`；页面小写，映射在 service |
| 公开 DTO | 禁止 `simulateFailure` |
| 后台 branding / tools/move | 不保留 mock 野路径；排序用 `sortOrder` |

## 调用链

1. Chat：`AppAiController.send` → `AiService.streamChat` → 额度预占 → FakeChat SSE → 结算。
2. 停止：写 `stopRequestedAt` + Redis `ai:stop:{id}` + 本机 `AbortController`。
3. 图片：`createImageJob` 写 job + outbox → worker `AiImageProcessor` → `processJob`。HTTP 测试直调 `processJob`。
4. 匿名写接口用 `AiAnonymousGuard` mint Cookie；GET home/models 只 peek，不新建主体。
5. 本地 `seed:local-users` 会写 Fake 目录，并为已有用户补额度账本。
6. 结算：Prisma 不能对同一字段同时 `increment` + `decrement`，必须算绝对值再 `update`。
7. 字段映射：camelCase 模型字段必须 `@map` 到 migration 的 snake_case（如 `finish_reason`、`tool_types`）。

## 前端

- Umi `request` 仍解包 T；SSE 用 `fetch` + `Idempotency-Key`，不要走信封解包。
- 页面枚举小写，Nest `UPPER_SNAKE`，映射在 service。
- `consumeAiQuota` 只刷新 entitlement，不再客户端扣费。

## 自动化验证

```bash
pnpm --filter server typecheck
pnpm --filter server test -- test/ai-http.spec.ts test/auth-http.spec.ts
pnpm --filter user-web typecheck
```

覆盖点：`test/ai-http.spec.ts`（**访客 public home**、会员 home、Chat SSE、额度 409、processJob 出资产、禁用模型后列表消失、匿名 Chat + 登录认领）、`test/auth-http.spec.ts` MEMBER 权限含 `ai:use`。

## 本地联调前（缺一步就会 500 / 假 404）

必须同时满足：

1. Postgres / Redis 已起：`docker compose -f compose.dev.yml up -d`
2. AI 表已迁移：`pnpm --filter server prisma:deploy`（应看到 `20260909070000_ai_domain`）
3. 权限 + Fake 目录 + 本地账号额度：`pnpm --filter server seed:local-users`
4. 三个进程都在跑：
   - `pnpm dev:server`（API `http://localhost:3001`）
   - `pnpm dev:user`（页面 `http://localhost:8000`，`MOCK=none`）
   - 图/视频才需要 `pnpm dev:worker`

不要用 `pnpm dev:user:mock` 测 Nest AI：页面会混 mock，和 Canonical 对不上。

浏览器请走 **`http://localhost:8000`**，不要直接打开 `http://localhost:3001` 登录（Origin 不对会 403）。

账号（密码都是 `HubDev!234`）：

| 角色 | 邮箱 | 用来测什么 |
| --- | --- | --- |
| 普通会员 | `member@example.com` | Chat / 额度 / 认领 |
| 系统所有者 | `owner@example.com` | 后台禁用模型后再回用户端 |

## 手动验证（按顺序）

### A. 接口先通（页面之前）

在终端：

```bash
curl -sS http://localhost:3001/api/v1/public/ai/home | head -c 400
curl -sS http://localhost:3001/api/v1/public/ai/models | head -c 400
```

通过：HTTP 200，JSON 有 `data.tools` / `data.models`，`tools` 里有 `"code":"chat"`。  
失败：500 且报 `ai_anonymous_subjects` 不存在 → 回到上面第 2 步；500 且 UUID `none` → 需要当前这版 `home()` 查询（访客只取系统模板）。

### B. 访客打开 AI 首页（不要先点「创作」）

1. 无痕或退出登录后打开 **http://localhost:8000/ai**
2. 应看到「AI 工作台」、剩余额度卡片、工具入口（对话 / 文本等），**不是**「抱歉，您访问的页面不存在」
3. 开发者工具 Network：`GET /api/v1/public/ai/home` 为 **200**（不要是 500/404）
4. 左侧点 **「AI 对话」**（子项），地址变为 `http://localhost:8000/ai/chat`。不要依赖折叠后的父级「创作」空路径；`/ai/create` 会重定向到 Chat。

### C. 访客 Chat SSE

1. 在输入框输入 `访客验证 SSE`，点发送（圆形按钮）
2. 几秒内出现 Fake 回复，文案以「我收到了：访客验证 SSE」开头
3. Network：`POST /api/v1/public/ai/chat`，类型 `text/event-stream`，响应里能搜到 `STARTED` / `DELTA` / `DONE`
4. 生成中可点停止：流中断，气泡状态不再一直「生成中」

### D. 登录会员 + 认领匿名历史

1. 打开 http://localhost:8000/user/login
2. `member@example.com` / `HubDev!234` 登录（若提示验证码，先点图片再填）
3. 再打开 **http://localhost:8000/ai/chat**
4. 左侧会话应出现刚才访客那条（标题含「访客」或首句摘要）
5. 顶栏 Token 约为角色发放额度（MEMBER 默认 10000，减掉刚生成的很少一点）
6. Network：`GET /api/v1/app/ai/home`、`GET /api/v1/app/ai/models` 为 200；模型下拉为 **Fake Chat · Fake Provider**（不要是空且禁用）
7. 再发一句 `MEMBER 登录后验证 SSE`，回复以「我收到了：MEMBER 登录后验证 SSE」开头
8. Network：`POST /api/v1/app/ai/sessions/.../messages` 为 SSE 200

### E. 额度不足（可选）

会员 Chat 正常时不会缺额。可用测试库或把该用户 `ai_quota_accounts.available_amount` 改为 0 后再发：应 **409**，错误码 `AI_QUOTA_INSUFFICIENT`，页面 toast 失败而不是白屏。

### F. 图片生成（需要 worker）

1. 确认 `pnpm dev:worker` 日志有 `server-worker 已启动`
2. 登录 MEMBER → http://localhost:8000/ai/image → 输入提示词 → 生成
3. Network：`POST /api/v1/app/ai/image-generations` **202**，随后 `GET .../image-generations/:id` 变为 `done`
4. 资产页 http://localhost:8000/ai/assets 能看到新图

### G. 后台禁用模型

1. 用 `owner@example.com` 登录后打开 http://localhost:8001/admin/ai/config（管理端从用户端进后台）
2. 关掉 Fake Image（或任一图片模型）保存
3. 换 MEMBER 打开 `/ai/image`：模型下拉不再出现该项

## 页面像 404 时对照

| 你看到的 | 实际原因 | 怎么处理 |
| --- | --- | --- |
| 「抱歉，您访问的页面不存在」 | 打到了没有路由的路径（例如旧的 `/ai/create`），或 Umi 编译失败 | 用 `/ai` 或 `/ai/chat`；看跑 `dev:user` 的终端有没有 webpack error |
| 工作台里大红「加载失败」 | `GET /public/ai/home` 或 `/app/ai/home` 500 | 先做 A 节 curl |
| 模型下拉是灰的「选择对话模型」 | 未登录打错接口 / 未 seed / 没有 `ai:use` | 重新 `seed:local-users` 后重新登录 |
| Chat 一结束跳登录页 | 访客误打了 `/app/ai/entitlement` | 需要当前前端：未登录不请求账本 |
