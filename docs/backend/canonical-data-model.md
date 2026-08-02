# Canonical PostgreSQL / Prisma 数据模型

> 状态：🟢 已确认，Nest Prisma Schema 的实现基线
> 最后更新：2026-08-02
> 关联：[后端实现约定](./conventions.md)、[Canonical API](./canonical-api.md)

---

## 1. 总体规则

- PostgreSQL 16，所有业务表使用 UUID 主键。
- 物理表/字段为复数 `snake_case`；Prisma Model/字段通过映射使用单数 `PascalCase` / `camelCase`。
- 所有时间存 `timestamptz`；服务端以 UTC 写入和返回。
- `created_at`、`updated_at` 为常规业务表标准字段；可恢复实体增加 `deleted_at`、`deleted_by`。
- 可编辑实体增加整数 `version` 并在每次更新递增；首版不要求客户端带 version，后续乐观锁可直接启用。
- 全部生产 Schema 变化通过 Prisma migration；本文是逻辑模型，不是可直接复制的 Schema。

## 2. 身份、会话与 RBAC

### 2.1 `users`

| 字段                                            | 说明                                           |
| ----------------------------------------------- | ---------------------------------------------- |
| `id`                                            | UUID 主键                                      |
| `email`                                         | 大小写规范化后的唯一邮箱                       |
| `password_hash`                                 | Argon2id 哈希                                  |
| `status`                                        | `PENDING_VERIFICATION` / `ACTIVE` / `DISABLED` |
| `role_id`                                       | 首版单角色外键                                 |
| `auth_version`                                  | 密码、禁用、全会话撤销时递增                   |
| `permission_version`                            | 角色、权限变更时递增                           |
| `email_verified_at`                             | 验证成功时间                                   |
| `email_changed_at`                              | 用于 30 天邮箱变更冷却                         |
| `nickname` / `avatar_file_id` / `bio` / `links` | 个人资料                                       |
| `created_at` / `updated_at`                     | 时间                                           |

约束：

- `email` 使用唯一的规范化列或 PostgreSQL `citext`，不能只依赖客户端小写化。
- 默认角色为 `MEMBER`，注册后状态为 `PENDING_VERIFICATION`。
- `role_id` 由服务端修改，客户端资料 API 不可写。

### 2.2 `roles`、`permissions`、`role_permissions`

| 表                 | 核心字段                                                 |
| ------------------ | -------------------------------------------------------- |
| `roles`            | `code`、`label`、`is_system`、`is_protected`、`version`  |
| `permissions`      | `code`、`group`、`label`、`description`                  |
| `role_permissions` | `role_id`、`permission_id`、`data_scope` (`OWN` / `ALL`) |

- 权限码不包含范围；范围写在 `role_permissions.data_scope`。
- `TEAM` 仅是未来枚举预留，首版不可配置。
- `super_admin` 为受保护系统角色；事务内必须始终至少保留一个 active super_admin。
- 首版无 `user_role_assignments`、无 `user_permissions`；未来多角色扩展时新增 `user_role_assignments` 关联表并平滑迁移 `users.role_id`。

### 2.3 会话和凭证

| 表                          | 核心字段                                                                                                                                    | 说明                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `auth_sessions`             | `user_id`、设备/浏览器摘要、`ip_hash`、`last_active_at`、`expires_at`、`revoked_at`、`revoked_reason`、`auth_version`、`permission_version` | 一个客户端会话                                                |
| `refresh_tokens`            | `session_id`、`token_hash`、`expires_at`、`rotated_at`、`revoked_at`、`replaced_by_token_id`                                                | 只保存加 pepper 的哈希，并可追踪轮换链                        |
| `email_verification_tokens` | `user_id`、`token_hash`、`expires_at`、`consumed_at`                                                                                        | 24 小时一次性验证                                             |
| `password_reset_tokens`     | `user_id`、`token_hash`、`expires_at`、`consumed_at`                                                                                        | 30 分钟一次性重置                                             |
| `email_change_requests`     | `user_id`、`new_email`、`token_hash`、`expires_at`、`consumed_at`                                                                           | 需当前密码后创建                                              |
| `totp_factors`              | `user_id` 唯一、`secret_ciphertext`、`enabled_at`、`last_used_at`、`disabled_at`                                                            | admin / super_admin 自愿启用的 TOTP；密钥使用独立应用密钥加密 |
| `totp_recovery_codes`       | `factor_id`、`code_hash`、`consumed_at`                                                                                                     | 一次性恢复码；永不保存明文                                    |

建议索引：

```text
auth_sessions(user_id, revoked_at, expires_at)
refresh_tokens(session_id, revoked_at, expires_at)
totp_recovery_codes(factor_id, consumed_at)
users(role_id, status)
users(email_normalized) UNIQUE
```

规则：

- `member` 最多同时存在 5 条未撤销且未过期会话；新会话创建前撤销最久未活跃的非当前会话。`admin`、`super_admin` 首版不设上限，后续由角色级配置启用。
- 检测到已轮换的 Refresh Token 再次被使用时，撤销其 `session_id` 对应会话和整条 Token 链；不撤销该用户其他设备会话。
- `totp_factors` 不对普通 member 创建记录。停用、管理员重置和恢复码使用均必须写审计日志。

## 3. 内容、分类、标签和阅读

### 3.1 分类和标签

| 表             | 核心字段与约束                                                              |
| -------------- | --------------------------------------------------------------------------- |
| `categories`   | `name`、`slug` 唯一、`parent_id` 自引用、`sort_order`、`enabled`、`version` |
| `tags`         | `name`、`normalized_name` 唯一、`slug` 唯一、`created_by`                   |
| `content_tags` | `content_id`、`tag_id` 复合唯一                                             |

- 分类使用无限层级邻接表；移动时必须禁止循环引用。
- 分类排序只在同父节点内有意义，使用 `(parent_id, sort_order)` 索引。
- 标签大小写不敏感唯一；被引用标签删除返回 `409 TAG_IN_USE`。

### 3.2 内容主表及版本

| 表                 | 核心字段                                                                                                                                                                                                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contents`         | `type`、`title`、`summary`、`author_id`、`category_id`、`status`、`visibility`、`source_type`、`import_source`、`import_restriction`、`cover_file_id`、`primary_file_id`、`external_url`、`is_featured`、`view_count`、`search_document`、`published_at`、`deleted_at`、`version` |
| `content_bodies`   | `content_id` 唯一、`markdown_source`、`editor_document` JSONB、`rendered_html`、`toc` JSONB、`render_version`                                                                                                                                                                     |
| `content_versions` | `content_id`、`snapshot_reason`、源正文/HTML/目录快照、`created_by`、`created_at`                                                                                                                                                                                                 |
| `content_chapters` | `content_id`、`title`、`chapter_order`、`object_key`、`toc`、字数/阅读时间、`version`                                                                                                                                                                                             |

`contents.type`：

```text
MARKDOWN | RICH_TEXT | BOOKLET | PDF | WORD | LINK | PROJECT
```

规则：

- `BOOKLET` 只表示内容形态；导入来源使用 `import_source`，如 `JUEJIN`、`LOCAL`、`MANUAL`。
- Markdown 正文存 `markdown_source`；富文本存编辑器 JSON，HTML 是净化后的派生产物。
- PDF/WORD 使用 `primary_file_id`；LINK/PROJECT 使用已校验 `external_url`。
- 发布前写 `content_versions` 快照，草稿保存不为每次输入创建历史。
- `import_restriction` 固定为 `NONE` 或 `PRIVATE_UNTIL_LICENSED`；后者仅由导入流程写入，限制存在期间内容必须为 `PRIVATE`。
- `search_document` 是由标题、摘要和允许检索的派生正文生成的 PostgreSQL `tsvector`；写入时更新，公开查询使用 GIN 索引且始终先施加可见性过滤。
- 内容软删除保留 30 天；仅 super_admin 可提前 purge，必须传原因。

建议索引：

```text
contents(status, visibility, deleted_at, published_at DESC)
contents(author_id, deleted_at, updated_at DESC)
contents(category_id, status, visibility)
contents(is_featured) WHERE is_featured = true AND deleted_at IS NULL
contents(search_document) USING GIN
content_chapters(content_id, chapter_order) UNIQUE
content_tags(content_id, tag_id) UNIQUE
```

### 3.3 收藏、进度和阅读量

| 表                  | 核心字段                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `favorites`         | `user_id`、`content_id`、`created_at`，复合唯一                                                                                             |
| `reading_records`   | `user_id`、`content_id`、`chapter_id`、`content_progress_percent`、`chapter_progress_percent`、`last_read_at`，`(user_id, content_id)` 唯一 |
| `content_view_days` | `content_id`、`subject_hash`、`view_date`，`(content_id, subject_hash, view_date)` 唯一                                                     |

- `content_view_days` 用于“一主体/内容/自然日”去重；成功插入后异步原子增加 `contents.view_count`。
- 主体为登录用户或匿名 Cookie 派生哈希，不能保存匿名原始 Cookie。
- 内容变为不可见、删除或章节失效时，读取进度不返回资源细节。

## 4. 文件、上传和导入

### 4.1 `file_assets`

| 字段                            | 说明                                                                                |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| `id` / `uploader_id`            | UUID 和上传主体                                                                     |
| `original_name`                 | 清理后的展示名                                                                      |
| `object_key`                    | 唯一对象定位；不保存长期可访问 URL                                                  |
| `storage_provider`              | `MINIO` / `COS`                                                                     |
| `mime_type` / `size` / `sha256` | 校验与去重基础                                                                      |
| `purpose`                       | `AVATAR`、`COVER`、`CONTENT_FILE`、`BOOKLET_SOURCE`、`TEMPORARY_IMPORT`、`AI_ASSET` |
| `status`                        | `UPLOADING`、`PENDING_VALIDATION`、`READY`、`FAILED`、`DELETED`                     |
| `scan_status`                   | 为后续杀毒扫描预留                                                                  |
| `deleted_at`                    | 软删除，7 天后候选物理清理                                                          |

### 4.2 上传与导入表

| 表                    | 核心字段                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `upload_sessions`     | `uploader_id`、`file_id`、`upload_mode` (`SINGLE` / `MULTIPART`)、`object_key`、`expires_at`、`completed_at`、`idempotency_key` |
| `booklet_import_jobs` | `requester_id`、`source_file_id`、`content_id`、`status`、进度/计数、警告、错误码、`idempotency_key`、时间                      |
| `migration_runs`      | CLI 迁移源指纹、操作者、结果摘要、时间                                                                                          |

- ZIP 导入创建 BOOKLET 后默认为 `DRAFT + PRIVATE` 并写 `import_restriction=PRIVATE_UNTIL_LICENSED`。
- 异步任务状态和 FileAsset 生命周期是业务事实；BullMQ 仅负责执行。

## 5. 配置、菜单、审计和 Outbox

| 表                    | 核心字段                                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `system_configs`      | `key`、`group`、JSONB `value`、`is_public`、`version`、`updated_by`                                                           |
| `menus`               | `scope`、`type`、`name`、`parent_id`、`route_key`、`external_url`、`sort_order`、`visible`、`enabled`、`is_system`、`version` |
| `menu_permissions`    | `menu_id`、`permission_id` 复合唯一                                                                                           |
| `audit_logs`          | `category`、`action`、`actor_id`、目标、`request_id`、`ip_hash`、结果、白名单 `detail`、`expires_at`                          |
| `outbox_events`       | `aggregate_type`、`aggregate_id`、`event_type`、JSON `payload`、`occurred_at`、`dispatched_at`、失败信息                      |
| `idempotency_records` | 主体、方法、路径 hash、key、请求指纹、响应状态/JSON、`expires_at`                                                             |

`system_configs` 的 `value` 为经过 DTO 校验的 JSON，示例 key：

```text
site.general
site.theme
site.homepage
site.about
ai.branding
```

不得在该表存 JWT、SMTP 密码、COS 凭证、AI API Key 或基础设施地址。

`menus.scope` 只能是 `PUBLIC`、`WORKSPACE`、`ADMIN`、`AI`；`type` 只能是 `DIRECTORY`、`INTERNAL`、`EXTERNAL`。数据库约束与 DTO 使用同一受控枚举，禁止由后台自由写入未知 scope、type 或 routeKey。

`idempotency_records` 约束：

- 唯一范围为 `(subject_type, subject_id_or_hash, http_method, path_hash, idempotency_key)`；匿名请求使用签名匿名主体哈希，不保存 Cookie 原文。
- 保存请求指纹以检测同一 Key 携带不同请求体：此情况返回 `409 IDEMPOTENCY_KEY_REUSED`，不能复用原结果。
- 普通写操作记录保留 24 小时；AI 发起、上传完成、导入、批量和其他高风险异步写操作保留 7 天。过期记录由定时任务批量清理。
- 响应 JSON 必须经过字段白名单，不能把 Token、密钥、完整 AI 正文或敏感错误上下文写入幂等记录。

## 6. AI、额度与资产

### 6.1 配置和权益

| 表                | 核心字段                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `ai_providers`    | `code`、`label`、`base_url`、`enabled`；不存明文 API Key                                       |
| `ai_models`       | `provider_id`、厂商 `model_key`、工具类型、可见/试用/默认、上下文限制、平台定价规则、`version` |
| `ai_tools`        | `code`、展示信息、状态、排序、登录要求                                                         |
| `ai_entitlements` | `role_id` 或套餐标识、可用模型/工具、额度规则、并发/频率阈值、`verification_grant_amount`      |
| `ai_templates`    | `owner_id` 可空、`is_system`、工具类型、Prompt、状态、`deleted_at`                             |

- 厂商 Key 仅来自环境变量/密钥管理；`ai_providers` 表保存可运营元数据，不保存或回显 Key。
- 所有启用模型可由登录用户选择，但仍需经过 entitlement、额度、并发和频率校验。
- `verification_grant_amount` 是通过邮箱验证时一次性授予的默认平台额度；首版各默认角色均为 `10000`，但只由受控权益配置读取，不能由注册请求传入。

### 6.2 会话、生成和账本

| 表                      | 核心字段                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| `ai_conversations`      | `owner_type` (`USER` / `ANONYMOUS`)、`owner_id`、标题、状态、`deleted_at`                                    |
| `ai_messages`           | `conversation_id`、角色、内容、状态、`variant_group_id`、`parent_message_id`、模型、用量、`blocked_category` |
| `ai_generation_jobs`    | `user_id`、`tool_type`、模型、状态、请求摘要、结果 FileAsset、错误码、`idempotency_key`                      |
| `ai_assets`             | `owner_id`、`file_id`、`folder_id`、状态、来源任务、`deleted_at`                                             |
| `ai_asset_folders`      | `owner_id`、名称、`parent_id` 可空、`deleted_at`                                                             |
| `ai_quota_accounts`     | `user_id`、`available_amount`、`reserved_amount`、`version`                                                  |
| `ai_quota_reservations` | 请求/任务、最大预占、实际结算、状态、过期时间                                                                |
| `ai_usage_records`      | 用户、工具、模型、输入/输出 Token、厂商成本、平台成本、任务/消息、时间                                       |
| `ai_quota_transactions` | 账户账本：授予、预占、结算、释放、人工调整，余额快照                                                         |

额度规则：

1. 服务端根据模型、输入和允许最大输出计算最高平台额度。
2. 在事务中原子预占；余额不足即拒绝。
3. 成功后按厂商实际 input/output 用量与平台规则结算，多余预占释放。
4. 失败释放未使用额度；中断有实际用量时按实际结算。
5. 图片按后台定义的固定平台额度结算。
6. 邮箱验证成功与 `ai_quota_accounts` 创建、初始 `GRANT` 交易、幂等标记及安全审计在同一事务完成；重复消费验证 Token 不得再次赠送。

匿名 AI：

- 以签名 HttpOnly 匿名主体 ID 关联会话，保存 30 天。
- 登录时在事务中将匹配匿名主体的未过期记录认领给当前用户。
- 匿名主体和 IP Hash 仅用于限流/归属，不写入用户资料。

建议索引：

```text
ai_messages(conversation_id, created_at DESC, id DESC)
ai_generation_jobs(user_id, created_at DESC)
ai_usage_records(user_id, created_at DESC)
ai_assets(owner_id, deleted_at, created_at DESC)
ai_quota_reservations(status, expires_at)
```
