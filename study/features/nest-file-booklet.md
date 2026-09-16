# Nest 文件域：预签名、purpose 与 Outbox

## 场景背景

浏览器不能拿永久 COS/MinIO 密钥，又不能让 Nest HTTP 进程同步解压 50MB ZIP。需要「预签名直传 + 完成校验」和「HTTP 只记账、Worker 才干活」。

## 核心概念

- **purpose**：文件用途（封面/正文/临时导入），不是 MIME。
- **StorageProvider**：测试内存实现、本地 MinIO、以后 COS 共用同一接口。
- **Outbox**：业务事务里写 `outbox_events`，Worker 再投递 BullMQ，避免「库成功、队列失败」或反过来。

## 实现步骤

1. `POST /app/uploads` 按 purpose 校验 MIME/大小，签发 PUT URL。
2. 浏览器 PUT 对象后 `complete`：head 大小、魔数、sha256，状态 `READY`。
3. 小册导入只传 `sourceFileId`；Worker `processJob` 解压并建 `BOOKLET` 草稿。
4. 详情只返回签名 `coverUrl` / `previewUrl`，不返回永久密钥。

## 常见错误

- 忘了起 `pnpm dev:worker`，导入任务一直 `QUEUED`。
- MinIO 未配 CORS，浏览器预签名 PUT 被拦。
- 前端还打 `/api/admin/files` mock 路径，或失败后再回落 mock。
- 用 `POST /app/contents type=BOOKLET` 想直接建小册。

## 手动验证

见 [apps/server/docs/implementation/file/README.md](../../apps/server/docs/implementation/file/README.md)。
