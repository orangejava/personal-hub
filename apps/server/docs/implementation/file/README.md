# Nest 文件 / 小册域（5.1–5.7）

> 状态：5.1–5.7 已落地
> 最后更新：2026-09-09
> 契约：[content-booklet-file-prd.md](../../../../docs/prd/long-term/content-booklet-file-prd.md)、[Canonical API](../../../../docs/backend/canonical-api.md) §4.4、[数据模型](../../../../docs/backend/canonical-data-model.md) §4

本文件只排 **文件资产、预签名上传、小册 ZIP、Worker** 的落地边界。PDF/Word **站内编辑器**、文件策略后台页、7 天物理清理见 [二期产品](../../../../docs/product/phase-2/README.md)。

## 切片一览

| 刀 | 内容 | 状态 |
| --- | --- | --- |
| 5.1 | Prisma `file_assets` / 上传会话 / Outbox；`StorageProvider`（测试内存 + MinIO/S3） | ✅ |
| 5.2 | `POST /app/uploads` 预签名、`complete` 魔数校验；`GET/DELETE /admin/files` | ✅ |
| 5.3 | 封面 / Logo 签名 URL；PDF/Word 以 `primaryFileId` 作为主文件 | ✅ |
| 5.4 | HTTP 只写 `outbox_events`；`pnpm dev:worker` 投递 BullMQ 并消费 | ✅ |
| 5.5 | ZIP 异步导入、单章正文、`POST /admin/contents/:id/import-license` | ✅ |
| 5.6 | 工作区上传向导、小册阅读接单章、后台文件列表改 Canonical | ✅ |
| 5.7 | `pnpm booklet:import-local --source … --dry-run\|--execute` | ✅ |

## 调用链

```text
浏览器上传
  → POST /api/v1/app/uploads（Idempotency-Key）
  → PUT 预签名 URL（MinIO，需 CORS）
  → POST /app/uploads/:id/complete（前缀魔数 + 流式 sha256；>20MiB 需 parts）
  → 得到 READY FileAsset id
  → GET /app/upload-tasks 统一分页查看文件与导入任务

PDF / Word
  → POST /app/contents { type: PDF|WORD, primaryFileId, coverFileId? }
  → 详情 previewUrl / coverUrl 为 10 分钟签名 URL

小册 ZIP
  → purpose=TEMPORARY_IMPORT 上传 ZIP
  → POST /app/booklet-imports { sourceFileId }
  → Worker processJob：流式落到临时文件再解压、写章节对象、数据库提交成功后再 move ZIP；失败可 retry 同一任务；心跳过期的 VALIDATING/IMPORTING 可被重新认领
  → GET /public/contents/:id/chapters 索引
  → GET .../chapters/:chapterId 单章 markdownSource
  → 管理员 POST /admin/contents/:id/import-license { note } 后才可公开
```

## 关键约定

- `purpose` 是 Prisma 枚举，后台不能发明新用途。MIME 白名单：代码默认 + 可 merge `system_configs.file.policies`（`isPublic=false`），再套 denylist 与天花板。
- 测试 `NODE_ENV=test` 且未设 `FILE_STORAGE=s3` 时走 `MemoryStorageProvider`，HTTP 用例可 `simulateBrowserPut`。
- 上传会话 15 分钟；下载签名 10 分钟。complete 为高风险幂等（7 天 TTL）。
- HTTP 进程不消费 BullMQ。生产与本地都由独立 `server-worker` 扫 outbox、消费 `booklet-import`；测试直接 `BookletImportService.processJob(jobId)`。
- ZIP：拒 `..`、解压 500MB、1000 章、单章 2MB、压缩比 >100。失败任务重试始终读源 ZIP。
- 小册不能通过 `POST /app/contents type=BOOKLET` 创建。

## 明确不做（二期或后置）

站内 PDF/Word 编辑器、文件策略运营页、头像 UI、AI 资产 HTTP、7 天物理清理 worker、生产 COS 实桶。

## 验证

1. `pnpm --filter server prisma:deploy`（本地库必须先有 `file_assets` / `outbox_events`，否则 worker 会退出）
2. `pnpm --filter server test`
3. `pnpm dev:server` 与 **`pnpm dev:worker`**、`pnpm dev:user`
4. 工作区新建 → 上传 ZIP → 轮询成功 → 私有草稿；匿名公开 404；作者可读单章
5. 所有者 `import-license` 后改为 PUBLIC 并发布，公开详情可见
6. `pnpm booklet:import-local --source /abs/content-local --dry-run` 不写库
