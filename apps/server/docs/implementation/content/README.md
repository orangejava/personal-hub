# Nest 内容域（4.1–4.5）

> 状态：4.1–4.5 已落地
> 最后更新：2026-09-09
> 契约：[内容阅读域 PRD](../../../../docs/prd/long-term/content-reading-domain-prd.md)、[Canonical API](../../../../docs/backend/canonical-api.md)、[数据模型](../../../../docs/backend/canonical-data-model.md)

本文件只排 **Content HTTP** 的刀序与落地边界，不替代 Canonical。文件/ZIP/MinIO 是下一 Nest 阶段。

## 切片一览

| 刀 | 内容 | 状态 |
| --- | --- | --- |
| 4.1 | Prisma：分类/标签/内容主表/正文/版本/章节/收藏/进度；`search_document` GIN；seed 分类与样例 | ✅ |
| 4.2 | 公开读：`/public/contents`、`meta`、`featured`、详情、章节索引；可见性 SQL；可选登录 | ✅ |
| 4.3 | 工作区：草稿 CRUD、发布/归档/软删恢复；Markdown / LINK / PROJECT / RICH_TEXT 草稿 | ✅ |
| 4.4 | 收藏、阅读进度、去重阅读计数、工作台内容统计 | ✅ |
| 4.5 | 后台跨作者列表、精选、分类/标签 CRUD、软删与 purge | ✅ |
| 内容审核 | `ContentReview` + 审核 API 已落地；管理端 UI 见 [content-review-and-uploads.md](../../../../docs/implementation/content/content-review-and-uploads.md) | ✅ |

## 调用链

```text
匿名首页 / 内容中心
  → GET /api/v1/public/contents/featured|meta|?keyword=
  → 前端 mapNestContentItem（UPPER_SNAKE → 现有小写枚举）
  → 卡片列表；LOGIN 访客锁定，点进详情 401 AUTH_REQUIRED

已发布 Markdown 详情
  → GET /api/v1/public/contents/:id（可选 Bearer）
  → markdownSource + renderedHtml/toc
  → MarkdownViewer 仍吃 markdownSource

工作区写作
  → POST /api/v1/app/contents + Idempotency-Key
  → PATCH 缺字段不改
  → POST .../publish | .../archive | DELETE 软删 | POST .../restore

收藏 / 进度
  → PUT/DELETE /api/v1/app/favorites/:id（只要求登录）
  → PUT /api/v1/app/reading-records/:id
```

## 关键约定

- 线上枚举 `UPPER_SNAKE_CASE`；React `shared-types` 旧枚举不改，映射在 `packages/api-client`。
- 公开接口 `@Public()`：有合法 Bearer 则挂 `request.auth`，坏 Token 当匿名。
- `keyword` 用标题/摘要 `ILIKE`；`search_document` 仍写入，不作为现网唯一检索。
- 封面/主文件存 UUID，公开/工作区详情的 `coverUrl` / `previewUrl` 为短时签名 URL（文件域 5.3）。
- 已发布详情返回 `markdownSource` 或服务端净化的 `renderedHtml`；RICH_TEXT 的原始 `editorDocument` 仅工作区可见，净化后正文为空时不能发布。
- 写入资源的 OWN/ALL 范围以各自动作权限为准；永久删除额外要求 `content:purge` ALL 和 `SUPER_ADMIN`。内容、分类和标签的受保护写接口均要求幂等键。
- 编辑者公开发布进入审核；`approve`/`reject` 在事务内用 `PENDING` 条件更新抢占，任意并发只有一个终态。导入公开须非空白版权说明。
- 工作区 PATCH 忽略 `isFeatured`。

## 明确不做（已迁到文件域或二期）

物理清理 worker、Textbus 文档协议、`site.homepage` 精选 ID 列表。ZIP / MinIO / 章节正文 / 封面真文件见 [file/README.md](../file/README.md)。

## 验证

1. `pnpm --filter server prisma:deploy && pnpm --filter server seed:local-users`
2. `pnpm --filter server test`
3. `pnpm dev:server` 与 `pnpm dev:user`：匿名首页有精选；内容中心可搜中文；LOGIN 卡片引导登录；`editor@` 发布后公开可见；`pnpm dev:admin` 可改分类/精选
