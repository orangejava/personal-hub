# 审查修复收口（并发、上传、任务分页）

> 状态：✅ 已落地
> 最后更新：2026-09-09
> 契约：[Canonical API](../backend/canonical-api.md)、[数据模型](../backend/canonical-data-model.md)
> 文件域切片：[apps/server/docs/implementation/file/README.md](../../apps/server/docs/implementation/file/README.md)
> 前端任务页：[content/content-review-and-uploads.md](./content/content-review-and-uploads.md)

本轮把审查发现的并发、上传可靠性和任务分页收进现有 Nest / 两端 React，不回退 mock，也不改 HTTP 信封。页面继续拿解包后的业务对象 T，失败 toast 读 Nest `error.message`。

## 1. 目标与范围

- 幂等：先原子 claim，再执行业务；普通写 TTL 24 小时，上传完成 / 导入 / 高风险异步写 7 天。
- 审核：`PENDING` 条件更新抢占；版权闸拒绝空白 `note`。
- 角色：列表返回 `version`，`PUT /admin/roles/:roleCode/permissions` 必带 `version`，冲突 `409 ROLE_VERSION_CONFLICT`。
- 上传：对象前缀魔数、流式 SHA-256、multipart parts/ETag；小册 ZIP 等数据库提交成功后再 `moveObject`。
- 工作区任务：`GET /app/upload-tasks` 服务端按 `createdAt` 真分页，默认 `pageSize=10`；不接受 `mimeKind`；可选 `taskKind` 服务端过滤。
- `server-worker` 已是独立进程：Outbox dispatcher + BullMQ 消费 `booklet-import`，不是 stub。

明确后置：`PARTIAL_SUCCESS` 细粒度业务、对象孤儿清理 worker、通用任务 SSE、自定义角色/权限范围编辑。

## 2. 调用链

```text
写接口
  → IdempotencyInterceptor claim PROCESSING（执行中刷新 updated_at）
  → 业务成功 complete / 失败 release；心跳停止超过 30s 的 PROCESSING 可被同键重新声明
  → 同键同指纹回放；不同指纹 409 IDEMPOTENCY_KEY_REUSED

编辑者发布
  → POST /app/contents/:id/publish
  → reviewStatus=PENDING
  → 并发 approve/reject 只有一个终态

浏览器上传
  → POST /app/uploads
  → PUT 预签名（>20MiB 按 partSize 分片并回传 ETag）
  → POST /app/uploads/:id/complete（前缀魔数 + 流式 sha256）
  → GET /app/upload-tasks?page=&pageSize= 轮询 QUEUED/VALIDATING/IMPORTING
```

## 3. 验证

1. `pnpm --filter server test`
2. 工作区上传任务：分页总数正确；类型下拉传 `taskKind`，不向后端传 `mimeKind`
3. 两个后台标签用过期 `version` 保存角色权限 → 一个 409，提示刷新
4. 编辑者提交公开审核 → 管理员通过/驳回 → 公开可见性与草稿状态一致

## 4. 2026-09-18 正式 Review 修复

本次复核沿用已提交的 `7204b55` 流式对话修复，补齐其余服务端风险：

- Refresh Token 轮换改为条件更新，旧 token 只能被一个并发请求抢占。
- AI 额度结算/释放以 `PENDING` 条件更新抢占，并使用账户原子增减，避免并发预占覆盖余额。
- AI 模型、provider、工具、内容引用和素材文件夹统一在服务端校验权益与归属。
- 图片/视频任务增加原子认领、心跳租约、失败补偿、额度回收和重启恢复；失败时清理资产记录与对象。
- SSE 写接口仍要求 `Idempotency-Key`，但不把空的流式返回持久化为普通 JSON 回放。
- 公开内容列表、收藏和最近阅读按 viewer 过滤，匿名用户不会通过列表获知 LOGIN 内容；搜索使用已有全文索引。

验证命令：`corepack pnpm --filter server typecheck`、`corepack pnpm --filter server lint`，以及幂等/Outbox 定向测试均通过。完整集成测试仍需要 Docker/Testcontainers，当前环境无法启动容器；监听 `0.0.0.0` 的 HTTP 测试还受本机 `EPERM` 限制。

## 5. AI 对话 SSE 收口（2026-09-19）

- 厂商调用：`apps/server/src/modules/ai/providers/openai-compatible-text.provider.ts` 的 `OpenAiCompatibleTextProvider.stream`，向 `${AI_OPENAI_BASE_URL}/chat/completions` 发送 `stream: true`，通过 `response.body.getReader()` 按 SSE 空行边界接收。
- 服务端转发：`apps/server/src/modules/ai/ai.service.ts` 的 `streamChat` 将上游增量转换为 `STARTED`、`DELTA`、`DONE`、`ERROR` 事件，并把消息终态与会话 `activeMessageId` 在同一事务中落库。
- 前端接收：`apps/user-web/src/services/aiSse.ts` 负责 `CRLF/LF`、多行 `data`、UTF-8 尾字节和 EOF 尾帧；`apps/user-web/src/services/ai.ts` 只负责读取流和分发事件。
- 上游 usage-only 帧优先用于 token/费用记录，缺失时才回退本地估算。额度结算或 usage 审计写入失败不会把已经落库的回答改成空失败消息。
- 前端渲染不把网络 chunk 直接当成 React 更新：`apps/user-web/src/components/ai/hooks/aiStreamScheduler.ts` 按浏览器帧将队列分批提交，`DONE/ERROR` 等待队列排空后再改变消息终态；停止或切换会话会 flush/取消旧队列。
