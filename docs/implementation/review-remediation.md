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
