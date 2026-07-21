# 数据库表结构

> 状态：🟢 已完成
> 最后更新：2026-06-09
> 数据库：PostgreSQL 16
> ORM：Prisma

---

## 整体 ER 概览

```
users ──< user_roles >── roles ──< role_permissions >── permissions
  │
  ├──< refresh_tokens
  ├──< favorites >── contents
  ├──< reading_records >── contents
  ├──< ai_sessions ──< ai_messages
  ├──< ai_usage_logs
  └──< contents ──< content_tags >── tags
                ──< content_chapters
                ── categories（树形）
                ── file_assets

ai_models >── ai_providers

system_configs（Key-Value）
operation_logs
menus
token_transactions
```

---

## Prisma Schema

```prisma
// ============================================================
// 用户与权限体系
// ============================================================

model User {
  id             String    @id @default(cuid())
  email          String    @unique
  passwordHash   String
  nickname       String    @db.VarChar(50)
  avatar         String?
  bio            String?   @db.VarChar(500)
  status         String    @default("active")      // active | disabled
  tokenQuota     Int       @default(10000)          // 剩余 Token 配额
  emailVerified  Boolean   @default(false)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  userRoles          UserRole[]
  refreshTokens      RefreshToken[]
  contents           Content[]
  favorites          Favorite[]
  readingRecords     ReadingRecord[]
  aiSessions         AiSession[]
  aiUsageLogs        AiUsageLog[]
  tokenTransactions  TokenTransaction[]
  operationLogs      OperationLog[]

  @@map("users")
}

model Role {
  id          String   @id @default(cuid())
  name        String   @unique              // admin | editor | member
  label       String
  isSystem    Boolean  @default(false)      // 内置角色不可删除
  description String?
  createdAt   DateTime @default(now())

  userRoles       UserRole[]
  rolePermissions RolePermission[]

  @@map("roles")
}

model Permission {
  id        String   @id @default(cuid())
  code      String   @unique              // content:view, ai:chat, system:user:manage ...
  label     String
  group     String                        // content | ai | favorite | system
  createdAt DateTime @default(now())

  rolePermissions RolePermission[]
  menuPermissions MenuPermission[]

  @@map("permissions")
}

// 用户 - 角色 多对多
model UserRole {
  userId String
  roleId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  role   Role   @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([userId, roleId])
  @@map("user_roles")
}

// 角色 - 权限点 多对多
model RolePermission {
  roleId       String
  permissionId String
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
  @@map("role_permissions")
}

// Refresh Token
model RefreshToken {
  id        String    @id @default(cuid())
  userId    String
  token     String    @unique
  expiresAt DateTime
  revokedAt DateTime?                     // NULL 表示有效
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("refresh_tokens")
}

// ============================================================
// 菜单
// ============================================================

model Menu {
  id           String   @id @default(cuid())
  name         String
  path         String?                    // 路由路径（前端硬编码，此处仅记录）
  icon         String?
  parentId     String?
  sort         Int      @default(0)
  menuType     String                     // frontend | workspace | admin
  isVisible    Boolean  @default(true)
  createdAt    DateTime @default(now())

  parent          Menu?            @relation("MenuTree", fields: [parentId], references: [id])
  children        Menu[]           @relation("MenuTree")
  menuPermissions MenuPermission[]

  @@map("menus")
}

// 菜单 - 权限点 关联（访问此菜单需要的权限）
model MenuPermission {
  menuId       String
  permissionId String
  menu         Menu       @relation(fields: [menuId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([menuId, permissionId])
  @@map("menu_permissions")
}

// ============================================================
// 内容体系
// ============================================================

model Category {
  id        String     @id @default(cuid())
  name      String
  slug      String     @unique
  parentId  String?
  sort      Int        @default(0)
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  parent   Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children Category[] @relation("CategoryTree")
  contents Content[]

  @@map("categories")
}

model Tag {
  id          String   @id @default(cuid())
  name        String   @unique
  slug        String   @unique
  createdBy   String?
  createdAt   DateTime @default(now())

  contentTags ContentTag[]

  @@map("tags")
}

model Content {
  id           String    @id @default(cuid())
  title        String    @db.VarChar(500)
  type         String                        // juejin_booklet | pdf | markdown | richtext | link | project | video
  summary      String?   @db.Text
  contentRaw   String?   @db.Text
  contentHtml  String?   @db.Text
  toc          Json?                         // [{level, text, anchor}]
  sourceType   String    @default("manual")  // upload | import | manual
  categoryId   String
  cover        String?
  fileId       String?
  sourceArchiveFileId String?
  externalUrl  String?
  originalAuthor String? @db.VarChar(100)   // 导入内容的原作者
  chapterCount Int       @default(0)        // 小册/分章内容的章节数
  extraMeta    Json?                         // 类型专属扩展数据，如导入结果、预计阅读时长、外链预览信息
  visibility   String    @default("login")   // public | login | private
  status       String    @default("draft")   // draft | published | archived
  isFeatured   Boolean   @default(false)
  readCount    Int       @default(0)
  wordCount    Int?
  authorId     String
  publishedAt  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  category       Category         @relation(fields: [categoryId], references: [id])
  author         User             @relation(fields: [authorId], references: [id])
  file           FileAsset?       @relation("ContentPrimaryFile", fields: [fileId], references: [id])
  sourceArchive  FileAsset?       @relation("ContentSourceArchive", fields: [sourceArchiveFileId], references: [id])
  contentTags    ContentTag[]
  chapters       ContentChapter[]
  favorites      Favorite[]
  readingRecords ReadingRecord[]

  @@map("contents")
}

// 内容 - 标签 多对多
model ContentTag {
  contentId String
  tagId     String
  content   Content @relation(fields: [contentId], references: [id], onDelete: Cascade)
  tag       Tag     @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([contentId, tagId])
  @@map("content_tags")
}

// 章节（掘金小册 / 分章内容）
model ContentChapter {
  id          String   @id @default(cuid())
  contentId   String
  title       String   @db.VarChar(500)
  slug        String?  @db.VarChar(200)      // 章节路由锚点或导入后的稳定标识
  contentRaw  String?  @db.Text
  contentHtml String?  @db.Text
  toc         Json?                         // 章节目录（h2/h3/h4）
  wordCount   Int?                          // 章节字数，便于展示和后续统计
  estimatedReadMinutes Int?                 // 章节预计阅读时长
  sort        Int                           // 从 1 开始
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  content        Content         @relation(fields: [contentId], references: [id], onDelete: Cascade)
  readingRecords ReadingRecord[]

  @@unique([contentId, sort])
  @@map("content_chapters")
}

// 文件资产
model FileAsset {
  id           String   @id @default(cuid())
  originalName String   @db.VarChar(500)
  storagePath  String                       // 存储路径（本地相对路径 or MinIO key）
  storageType  String   @default("local")   // local | minio | s3
  mimeType     String
  size         BigInt                       // 字节数
  url          String                       // 访问 URL（后端代理）
  purpose      String   @default("general") // avatar | cover | pdf | booklet_source | general
  uploaderId   String
  createdAt    DateTime @default(now())

  uploader User      @relation(fields: [uploaderId], references: [id])
  contents Content[] @relation("ContentPrimaryFile")
  sourceContents Content[] @relation("ContentSourceArchive")

  @@map("file_assets")
}

// ============================================================
// 用户行为
// ============================================================

// 收藏
model Favorite {
  id        String   @id @default(cuid())
  userId    String
  contentId String
  createdAt DateTime @default(now())

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  content Content @relation(fields: [contentId], references: [id], onDelete: Cascade)

  @@unique([userId, contentId])
  @@map("favorites")
}

// 阅读历史 / 进度
model ReadingRecord {
  id             String    @id @default(cuid())
  userId         String
  contentId      String
  chapterId      String?                    // 当前章节（掘金小册用）
  scrollPosition Int       @default(0)      // 章节内滚动偏移（px）
  pageNumber     Int?                       // PDF 当前页码
  progress       Decimal?  @db.Decimal(5, 2) // 0.00 - 100.00
  lastReadAt     DateTime  @default(now())

  user    User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  content Content         @relation(fields: [contentId], references: [id], onDelete: Cascade)
  chapter ContentChapter? @relation(fields: [chapterId], references: [id])

  @@unique([userId, contentId])
  @@map("reading_records")
}

// ============================================================
// AI 工具
// ============================================================

// AI 厂商配置
model AiProvider {
  id              String   @id @default(cuid())
  name            String   @unique             // aliyun_bailian | openai | anthropic | gemini
  label           String                       // 展示名称
  baseUrl         String
  apiKeyEncrypted String   @db.Text            // 加密存储
  isEnabled       Boolean  @default(true)
  sort            Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  models AiModel[]

  @@map("ai_providers")
}

// AI 模型配置
model AiModel {
  id             String   @id @default(cuid())
  providerId     String
  modelId        String                        // qwen-turbo | gpt-4o | dall-e-3 ...
  label          String                        // 展示名称
  toolTypes      Json                          // ["chat", "text"] | ["image"]
  isVisible      Boolean  @default(true)       // 对用户是否可见
  isDefault      Boolean  @default(false)      // 是否为该工具类型的默认模型
  trialEnabled   Boolean  @default(false)      // 未登录试用是否可见
  contextLength  Int?                          // 上下文长度（tokens）
  priceInput     Decimal? @db.Decimal(10, 6)   // 元/1K 输入 tokens
  priceOutput    Decimal? @db.Decimal(10, 6)   // 元/1K 输出 tokens
  imageCost      Int?                          // 图片模型按次数折算的平台 token 成本
  sort           Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  provider   AiProvider  @relation(fields: [providerId], references: [id])
  sessions   AiSession[]
  usageLogs  AiUsageLog[]

  @@map("ai_models")
}

// AI 对话会话
model AiSession {
  id            String    @id @default(cuid())
  userId        String
  title         String    @db.VarChar(200)
  modelId       String?
  systemPrompt  String?   @db.Text
  messageCount  Int       @default(0)
  totalTokens   Int       @default(0)
  lastMessageAt DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  user      User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  model     AiModel?     @relation(fields: [modelId], references: [id])
  messages  AiMessage[]
  usageLogs AiUsageLog[]

  @@map("ai_sessions")
}

// AI 消息
model AiMessage {
  id         String   @id @default(cuid())
  sessionId  String
  role       String                          // user | assistant | system
  content    String   @db.Text
  tokenCount Int?
  model      String?                         // 记录生成时使用的模型
  status     String   @default("done")       // streaming | done | error | stopped
  feedback   String?                         // thumbs_down | NULL
  createdAt  DateTime @default(now())

  session AiSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@map("ai_messages")
}

// AI 使用日志（Token 消耗记录）
model AiUsageLog {
  id               String   @id @default(cuid())
  userId           String
  toolType         String                    // chat | text | image
  modelId          String?
  action           String?                   // generate | regenerate | trial_generate
  promptTokens     Int?
  completionTokens Int?
  totalTokens      Int      @default(0)
  tokenCost        Int      @default(0)      // 消耗的平台 Token 配额数
  sessionId        String?
  requestMeta      Json?                     // 输入长度、图片尺寸、风格、场景等
  createdAt        DateTime @default(now())

  user    User       @relation(fields: [userId], references: [id])
  model   AiModel?   @relation(fields: [modelId], references: [id])
  session AiSession? @relation(fields: [sessionId], references: [id])

  @@map("ai_usage_logs")
}

// ============================================================
// Token 配额变更记录
// ============================================================

model TokenTransaction {
  id          String   @id @default(cuid())
  userId      String
  delta       Int                           // 正数增加，负数扣减
  balance     Int                           // 变更后余额
  type        String                        // grant（赠送）| manual（管理员调整）| consume（AI 消耗）| recharge（充值，后续）
  remark      String?                       // 原因备注（管理员调整时必填）
  operatorId  String?                       // 操作者（管理员 ID，系统操作为 NULL）
  createdAt   DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@map("token_transactions")
}

// ============================================================
// 系统配置
// ============================================================

model SystemConfig {
  id        String   @id @default(cuid())
  key       String   @unique               // site.name | user.initial_token_quota ...
  value     String   @db.Text
  valueType String   @default("string")    // string | number | boolean | json
  group     String                         // site | theme | navigation | user | ai | content
  label     String
  description String? @db.VarChar(500)
  updatedAt DateTime @updatedAt
  updatedBy String?

  @@map("system_configs")
}

// ============================================================
// 操作日志
// ============================================================

model OperationLog {
  id         String   @id @default(cuid())
  userId     String?
  action     String                        // content:publish | user:disable | system:config:update ...
  targetType String?                       // content | user | role ...
  targetId   String?
  ip         String?  @db.VarChar(50)
  userAgent  String?  @db.Text
  result     String   @default("success")  // success | fail
  detail     Json?                         // 详细参数/错误信息
  createdAt  DateTime @default(now())

  user User? @relation(fields: [userId], references: [id])

  @@map("operation_logs")
}
```

---

## 初始化种子数据（Prisma Seed）

### 默认角色

| name   | label    | isSystem |
| ------ | -------- | :------: |
| admin  | 管理员   |   true   |
| editor | 编辑者   |   true   |
| member | 普通会员 |   true   |

### 默认权限点

（见 `auth-rbac.md` 权限点枚举，共 20+ 个 permission code）

### 默认系统配置

| key                         | 默认值       |
| --------------------------- | ------------ |
| `site.name`                 | 个人知识中台 |
| `theme.primary_color`       | #2563EB      |
| `theme.secondary_color`     | #14B8A6      |
| `theme.accent_color`        | #F97316      |
| `theme.mode`                | system       |
| `navigation.public_position`| top          |
| `navigation.workspace_position` | left     |
| `navigation.admin_position` | left         |
| `user.initial_token_quota`  | 10000        |
| `ai.trial_chat_daily_limit` | 3            |
| `ai.trial_text_daily_limit` | 3            |

### 默认 AI 模型

（见 `admin.md` 初始化数据表）

---

## 索引说明

关键索引（性能优化）：

```sql
-- 内容查询
CREATE INDEX idx_contents_status_visibility ON contents(status, visibility);
CREATE INDEX idx_contents_category ON contents(category_id);
CREATE INDEX idx_contents_author ON contents(author_id);
CREATE INDEX idx_contents_featured ON contents(is_featured) WHERE is_featured = true;
CREATE INDEX idx_contents_type_status ON contents(type, status);
CREATE INDEX idx_contents_updated_at ON contents(updated_at DESC);

-- 全文搜索（PostgreSQL FTS）
CREATE INDEX idx_contents_fts ON contents USING GIN (
  to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(summary, ''))
);

-- 章节与导入
CREATE INDEX idx_content_chapters_content_sort ON content_chapters(content_id, sort);
CREATE INDEX idx_file_assets_uploader_purpose ON file_assets(uploader_id, purpose);

-- 用户行为
CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_reading_records_user ON reading_records(user_id);
CREATE INDEX idx_reading_records_last_read ON reading_records(user_id, last_read_at DESC);

-- AI 使用
CREATE INDEX idx_ai_usage_logs_user_date ON ai_usage_logs(user_id, created_at DESC);
CREATE INDEX idx_ai_usage_logs_created ON ai_usage_logs(created_at DESC);
CREATE INDEX idx_ai_messages_session ON ai_messages(session_id, created_at);
CREATE INDEX idx_ai_models_visible_tool ON ai_models(is_visible, is_default);

-- 操作日志
CREATE INDEX idx_operation_logs_created ON operation_logs(created_at DESC);

-- 系统配置
CREATE INDEX idx_system_configs_group ON system_configs("group");
```
