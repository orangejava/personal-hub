# Nest AI 域（额度预占、SSE、停止、导航与媒体）

## 场景背景

AI Chat 不能把扣费放在浏览器里，也不能靠「关页 / 断连」当停止。停止必须是显式 HTTP；额度必须服务端预占再结算。公开写接口的匿名主体必须在 Guard 里写入，因为幂等拦截器早于 Controller。图片结果不能把 `memory://` 交给 `<img src>`。

## 核心概念

- **预占 / 结算 / 释放**：`ai_quota_reservations` + 条件更新 `ai_quota_accounts.version`。
- **SSE**：`STARTED / DELTA / DONE / ERROR`，跳过响应信封。
- **跨实例停止**：本机 `AbortController` + Redis `ai:stop:{id}`。
- **匿名主体**：Cookie `ph_ai_anon` HMAC，密钥 `JWT_REFRESH_SECRET`。
- **图视频**：Outbox 投递，HTTP 进程不消费 BullMQ；任务 `assets` 走鉴权媒体接口。
- **导航**：独立 `AiNavigationItem`，与 `AiTool` 执行能力分离。隐藏不展示；禁用/即将上线仍展示。生成和会员/创作中心接口会再校验状态，`409 AI_TOOL_UNAVAILABLE`。
- **Provider**：默认 Fake；`AI_TEXT_PROVIDER=openai_compatible` 且有 Key 时走 OpenAI Chat Completions 适配层。本地可用 `scripts/openai-compatible-stub.mjs`。
- **权限**：`ai:use` 授给 MEMBER 及以上；访客只走 `/public/ai`。

## 实现步骤

1. Prisma 一次建全 AI 表，API 可以瘦。
2. Fake Provider 先打通链路，真实厂商后置；协议适配层不阻塞真实 Key。
3. 前端 Chat/Text 用 `fetch` 读 SSE；写接口带 `Idempotency-Key`。
4. 图片任务轮询 job 的 `assets`，用带 Bearer 的 fetch 换 blob URL。
5. Prisma 字段 camelCase 必须 `@map` 到 SQL snake_case。
6. 结算同一字段不要同时 increment + decrement。

## 关键代码

- Guard：`apps/server/src/modules/ai/ai-anonymous.guard.ts`
- 额度：`apps/server/src/modules/ai/ai-quota.service.ts`
- 流式：`AiService.streamChat` + `consumeAiSse`（`apps/user-web/src/services/ai.ts`）
- 媒体：`GET /api/v1/app/ai/assets/:assetId/content` + `AiAuthenticatedMedia`
- 适配层：`providers/openai-compatible-text.provider.ts`

## 常见错误

- 公开写接口把 `ensureAnonymousSubject` 放在 Controller 里：幂等拦截器更早执行 → 401。
- 访客 `home()` 模板条件写成 `{ id: 'none' }`：UUID 列 500，页面像挂了。访客只查 `isSystem: true`。
- 访客 Chat 完成后打 `/app/ai/entitlement`：401 被拦截器踢去登录。
- 本地只 `seed:local-users` 不跑权限基线：MEMBER 没有 `ai:use`，模型下拉为空。
- SSE 走 Umi `request`：会被当成 JSON 信封解包。
- 测试里 HTTP app 不会跑 worker：应直调 `processJob`。
- `column ai_messages.finishReason does not exist`：缺 `@map("finish_reason")`。
- Prisma `availableAmount: { increment, decrement }` 同时出现会报错：改成算 `nextAvailable` 再 `update`。
- 把 `memory://` 当图片地址：浏览器无法加载，应走鉴权 content 接口。
- 用 `dev:user:mock` 测 Nest AI：会混旧 `/api/ai/*` mock。

## 手动验证

1. `curl -sS http://localhost:3001/api/v1/public/ai/home` 必须 200 且有 `data.tools`。
2. 未登录打开 http://localhost:8000/ai ，应是工作台而不是站点 404；Network 里 home 为 200。
3. 点侧栏「AI 对话」发一条，Fake 回复以「我收到了：」开头。
4. 登录 `member@example.com` / `HubDev!234` 后再发一条，走 `/app/ai/sessions/.../messages` SSE。
5. 登录生成图片后，当前任务只展示本次资产；刷新资产页仍能显示。
6. 后台改品牌或隐藏 WebUI 后，刷新用户端侧栏立即生效。

逐步截图级步骤见 `apps/server/docs/implementation/ai/README.md`。
