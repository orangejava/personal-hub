# 内容审核与上传任务（前端）

> 状态：UI 已接现有 Nest API
> 最后更新：2026-09-09
> 契约：[Canonical API](../../backend/canonical-api.md) 内容审核与 `GET /app/upload-tasks`

## 范围

- 后台 `/admin/content/reviews`：待审 / 通过 / 驳回；导入公开须填版权说明
- 工作区 `/workspace/uploads`：`GET /app/upload-tasks` 真分页；类型下拉传 `taskKind` 由服务端过滤；成功跳草稿
- 仅当存在 `QUEUED` / `VALIDATING` / `IMPORTING` 时轮询；标签隐藏时暂停
- 文档列表去掉「解除导入限制」；「待授权」改为「待审核」或「待审公开」
- **不做**：AI 模型审核、工作区「我的文件库」、通用任务 SSE

## 调用链

```text
编辑者 POST /app/contents/:id/publish
  → 内容保持 DRAFT，reviewStatus=PENDING
  → 后台 GET /admin/content-reviews
  → POST .../approve { copyrightNote? } 或 POST .../reject { reason }

所有者/管理员 POST .../publish { requestedVisibility, copyrightNote? }
  → 即时发布；导入且目标公开/登录时必填版权说明

工作区上传任务
  → GET /app/upload-tasks?page=&pageSize=&taskKind=  （默认 pageSize=10；不传 mimeKind）
  → 类型下拉把 `taskKind` 交给服务端过滤
  → 进行中状态为 QUEUED / VALIDATING / IMPORTING 时轮询；隐藏标签暂停
```

前端走 Umi 全局解包为 T，写接口带 `Idempotency-Key`，失败 toast 读 `error.message`，不回落 mock。
