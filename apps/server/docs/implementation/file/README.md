# Nest 文件 / 小册域（5.1–5.7）

> 状态：5.1–5.7 已落地
> 最后更新：2026-09-09
> 契约：[content-booklet-file-prd.md](../../../../docs/prd/long-term/content-booklet-file-prd.md)、[Canonical API](../../../../docs/backend/canonical-api.md) §4.4、[数据模型](../../../../docs/backend/canonical-data-model.md) §4

本文件只排 **文件资产、预签名上传、小册 ZIP、Worker** 的落地边界。PDF/Word **站内编辑器**、文件策略后台页、7 天物理清理见 [二期产品](../../../../docs/product/phase-2/README.md)。

## 切片一览

| 刀  | 内容                                                                               | 状态 |
| --- | ---------------------------------------------------------------------------------- | ---- |
| 5.1 | Prisma `file_assets` / 上传会话 / Outbox；`StorageProvider`（测试内存 + MinIO/S3） | ✅   |
| 5.2 | `POST /app/uploads` 预签名、`complete` 魔数校验；`GET/DELETE /admin/files`         | ✅   |
| 5.3 | 封面 / Logo 签名 URL；PDF/Word 以 `primaryFileId` 作为主文件                       | ✅   |
| 5.4 | HTTP 只写 `outbox_events`；`pnpm dev:worker` 投递 BullMQ 并消费                    | ✅   |
| 5.5 | ZIP 异步导入、单章正文、`POST /admin/contents/:id/import-license`                  | ✅   |
| 5.6 | 工作区上传向导、小册阅读接单章、后台文件列表改 Canonical                           | ✅   |
| 5.7 | `pnpm booklet:import-local --source … --dry-run\|--execute`                        | ✅   |

## 调用链

```text
浏览器上传
  → POST /api/v1/app/uploads（Idempotency-Key；上传会话 24 小时）
  → SINGLE PUT 短期预签名 URL；MULTIPART 按批获取分片签名（签名有效 15 分钟）
  → 失败或长时间暂停后 POST /app/uploads/:id/renew 更新签名；COS 分片最多 10,000 片，每片最多 5 GB
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

- `purpose` 是 Prisma 枚举，后台不能发明新用途。MIME 白名单：代码默认 + 可 merge `system_configs.file.policies`（`isPublic=false`），再套 denylist 与适用的代码天花板。小册 ZIP 默认 50 MiB，由「系统配置 → 文件上传配置」调整，不设业务最大值；COS 单片最大 5 GB、最多 10,000 片。解析器解压总量阈值为 `max(500 MiB, 配置上传上限 × 100)`；ZIP 文件名/扩展字段/注释的原始元数据累计上限为 8 MiB，Markdown 正文另有固定 64 MiB 累计读取上限，均不随上传策略提升，并在章节读取前检查 1,000 章数量上限、单章 2 MiB 限制。
- 测试 `NODE_ENV=test` 且未设 `FILE_STORAGE=s3` 时走 `MemoryStorageProvider`，HTTP 用例可 `simulateBrowserPut`。
- 上传会话 24 小时；单次签名 URL 15 分钟；下载签名 10 分钟。过期会话不再回放伪续签结果，浏览器清除旧幂等键后仅重建一次会话；普通网络失败仍保留会话供重试。complete 为高风险幂等（7 天 TTL）。
- 分片签名按每批最多 100 片获取。旧页面兼容字段仅在最多 100 片时返回；更大的会话需要刷新到新版页面。过期或非 `UPLOADING` 会话不能续签，需重新创建上传会话。
- HTTP 进程不消费 BullMQ。生产与本地都由独立 `server-worker` 扫 outbox、消费 `booklet-import`；测试直接 `BookletImportService.processJob(jobId)`。
- ZIP：兼容 UTF-8 与 GBK 文件名/正文；拒 `..`、配置化解压总量超限、Markdown 正文累计超过 64 MiB、超过 1,000 章、单章超过 2 MiB 或压缩比 >100。失败任务重试始终读源 ZIP。
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
