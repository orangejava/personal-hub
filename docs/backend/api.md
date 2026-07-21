# API 接口清单

> 状态：🟢 已完成
> 最后更新：2026-06-09
> 规范：RESTful，基础路径 `/api`
> 认证：Bearer Token（JWT Access Token），`🔓` 表示公开，`🔐` 表示需登录，`🛡️` 表示需特定权限

---

## 通用约定

### 请求/响应格式

```typescript
// 统一响应体
interface ApiResponse<T> {
  code: number; // 0 = 成功，非 0 = 错误
  message: string;
  data: T;
}

// 分页响应
interface PagedResponse<T> {
  code: number;
  message: string;
  data: {
    list: T[];
    total: number;
    page: number;
    pageSize: number;
  };
}
```

### 分页参数

| 参数       | 类型   | 默认值 | 说明     |
| ---------- | ------ | ------ | -------- |
| `page`     | number | 1      | 页码     |
| `pageSize` | number | 20     | 每页条数 |

### 错误码

| code | 说明                 |
| ---- | -------------------- |
| 0    | 成功                 |
| 400  | 请求参数错误         |
| 401  | 未登录或 Token 失效  |
| 403  | 无权限               |
| 404  | 资源不存在           |
| 409  | 冲突（如邮箱已注册） |
| 429  | 请求频率超限         |
| 500  | 服务器内部错误       |

---

## 认证模块 `/api/auth`

| 方法 | 路径                    | 认证 | 说明                               |
| ---- | ----------------------- | ---- | ---------------------------------- |
| POST | `/auth/register`        | 🔓   | 注册新用户                         |
| POST | `/auth/login`           | 🔓   | 邮箱密码登录                       |
| POST | `/auth/logout`          | 🔐   | 登出（撤销 Refresh Token）         |
| POST | `/auth/refresh`         | 🔓   | 用 Refresh Token 换新 Access Token |
| POST | `/auth/forgot-password` | 🔓   | 发送密码重置邮件                   |
| POST | `/auth/reset-password`  | 🔓   | 重置密码（使用邮件中的 token）     |
| POST | `/auth/verify-email`    | 🔓   | 验证邮箱（使用验证码）             |
| POST | `/auth/resend-verify`   | 🔐   | 重发邮箱验证码                     |

### POST `/auth/register`

**请求体**

```json
{
  "email": "user@example.com",
  "password": "Abc12345",
  "nickname": "小明"
}
```

**响应 data**

```json
{
  "accessToken": "eyJ...",
  "user": { "id": "...", "email": "...", "nickname": "..." }
}
```

> Refresh Token 通过 `Set-Cookie: refreshToken=...; HttpOnly` 返回（Web 端）

### POST `/auth/login`

**请求体**：`{ email, password }`  
**响应 data**：同 register

### POST `/auth/refresh`

**请求方式**：Cookie 中携带 `refreshToken`（Web）或请求体 `{ refreshToken }`（Flutter）  
**响应 data**：`{ accessToken: string }`

---

## 用户模块 `/api/users`

| 方法  | 路径                 | 认证 | 说明                            |
| ----- | -------------------- | ---- | ------------------------------- |
| GET   | `/users/me`          | 🔐   | 获取当前用户信息                |
| PATCH | `/users/me`          | 🔐   | 更新基本信息（昵称/Bio）        |
| PATCH | `/users/me/password` | 🔐   | 修改密码                        |
| POST  | `/users/me/avatar`   | 🔐   | 上传头像（multipart/form-data） |

### GET `/users/me` 响应

```json
{
  "id": "clxxx",
  "email": "user@example.com",
  "nickname": "小明",
  "avatar": "https://...",
  "bio": "...",
  "tokenQuota": 8400,
  "roles": ["member"],
  "createdAt": "2026-01-01T00:00:00Z"
}
```

---

## 内容模块 `/api/contents`

### 公开接口

| 方法 | 路径                                | 认证 | 说明                             |
| ---- | ----------------------------------- | ---- | -------------------------------- |
| GET  | `/contents`                         | 🔓\* | 内容列表（login 可见需登录）     |
| GET  | `/contents/featured`                | 🔓   | 精选内容（首页推荐，最多 6 条）  |
| GET  | `/contents/recent`                  | 🔓   | 最新内容（首页推荐备选）         |
| GET  | `/contents/search`                  | 🔓\* | 全文搜索                         |
| GET  | `/contents/:id`                     | 🔓\* | 内容详情（含 contentHtml + toc） |
| GET  | `/contents/:id/chapters`            | 🔓\* | 章节列表（掘金小册）             |
| GET  | `/contents/:id/chapters/:chapterId` | 🔓\* | 单章节详情                       |

> `🔓*` 表示对 `public` 内容公开，`login` 内容需登录，`private` 内容仅作者和管理员可见

**GET `/contents` 查询参数**

| 参数                | 类型     | 说明                           |
| ------------------- | -------- | ------------------------------ |
| `categoryId`        | string   | 分类 ID                        |
| `tagIds`            | string[] | 标签 ID 列表（多个用逗号分隔） |
| `type`              | string   | 内容类型（多个逗号分隔）       |
| `keyword`           | string   | 关键字搜索（走全文搜索）       |
| `sortBy`            | string   | `latest`（默认）\| `readCount` |
| `featuredOnly`      | boolean  | 是否仅返回精选内容             |
| `page` / `pageSize` | number   | 分页                           |

**GET `/contents/:id` 响应 data**

```json
{
  "id": "...",
  "title": "...",
  "type": "markdown",
  "summary": "...",
  "contentHtml": "<p>...</p>",
  "toc": [{ "level": 2, "text": "标题", "anchor": "heading-1" }],
  "category": { "id": "...", "name": "前端" },
  "tags": [{ "id": "...", "name": "React" }],
  "cover": "https://...",
  "sourceType": "manual",
  "visibility": "login",
  "status": "published",
  "readCount": 128,
  "wordCount": 3200,
  "chapterCount": 12,
  "originalAuthor": "原作者昵称",
  "isFeatured": false,
  "author": { "id": "...", "nickname": "小明", "avatar": "..." },
  "publishedAt": "2026-05-01T00:00:00Z",
  "sourceArchive": {
    "fileId": "...",
    "fileName": "juejin-booklet.zip",
    "downloadUrl": "/api/contents/.../source"
  },
  "isFavorited": true, // 当前用户是否已收藏（未登录为 null）
  "readingRecord": {
    // 当前用户的阅读进度（未登录为 null）
    "chapterId": "...",
    "scrollPosition": 1200,
    "progress": 45.5
  }
}
```

**GET `/contents/:id/chapters` 响应 data**

```json
[
  {
    "id": "...",
    "title": "第 1 章：介绍",
    "sort": 1,
    "wordCount": 1800,
    "estimatedReadMinutes": 8,
    "isCurrent": true
  }
]
```

### 工作区接口（需登录 + content:upload 权限）

| 方法   | 路径                       | 认证                    | 说明                                 |
| ------ | -------------------------- | ----------------------- | ------------------------------------ |
| GET    | `/contents/mine`           | 🔐                      | 我的内容列表                         |
| POST   | `/contents`                | 🛡️ `content:upload`     | 创建内容                             |
| PATCH  | `/contents/:id`            | 🛡️ `content:edit:own`   | 编辑内容                             |
| PATCH  | `/contents/:id/status`     | 🛡️ `content:publish`    | 更改状态（draft/published/archived） |
| PATCH  | `/contents/:id/visibility` | 🛡️ `content:edit:own`   | 更改可见性                           |
| GET    | `/contents/:id/source`     | 🛡️ `content:edit:own`   | 下载原始导入包或主资源文件           |
| DELETE | `/contents/:id`            | 🛡️ `content:delete:own` | 删除内容                             |
| POST   | `/contents/import`         | 🛡️ `content:upload`     | 批量导入（掘金小册，multipart）      |

**GET `/contents/mine` 查询参数**

| 参数                | 类型   | 说明 |
| ------------------- | ------ | ---- |
| `type`              | string | 内容类型筛选 |
| `status`            | string | `draft` \| `published` \| `archived` |
| `visibility`        | string | `public` \| `login` \| `private` |
| `categoryId`        | string | 分类筛选 |
| `keyword`           | string | 标题 / 摘要搜索 |
| `page` / `pageSize` | number | 分页 |

**POST `/contents` 请求体**

```json
{
  "type": "markdown",
  "title": "Next.js 学习笔记",
  "summary": "记录 App Router 基础",
  "categoryId": "clxxx",
  "tagIds": ["tag-1", "tag-2"],
  "visibility": "login",
  "contentRaw": "# 标题",
  "cover": "https://...",
  "externalUrl": null,
  "fileId": null
}
```

规则：

- `markdown` 至少需要 `contentRaw`。
- `pdf` 至少需要 `fileId`。
- `link` 至少需要 `externalUrl`。
- 草稿保存允许 `summary` 为空；发布时必须具备正文或主文件。

**PATCH `/contents/:id` 可更新字段**

- `title`
- `summary`
- `categoryId`
- `tagIds`
- `visibility`
- `cover`
- `contentRaw`
- `externalUrl`
- `fileId`

**POST `/contents/import` 请求参数**

- `file`：ZIP 文件（multipart）
- `categoryId`：导入后的目标分类
- `tagIds`：可选标签列表，逗号分隔
- `visibility`：默认 `login`

**POST `/contents/import` 响应 data**

```json
{
  "contentId": "clxxx",
  "title": "掘金小册标题",
  "importStatus": "success",
  "totalChapters": 12,
  "successCount": 12,
  "failedItems": [],
  "sourceArchiveFileId": "file_xxx"
}
```

导入规则：

- 只接受 ZIP，首版大小建议限制在 50MB 以内。
- 服务端必须做解压安全校验，防止目录穿越和异常嵌套。
- 成功导入后默认创建 `draft` 内容，等待作者补充分类、标签、封面后再发布。

---

## 分类模块 `/api/categories`

| 方法   | 路径               | 认证                         | 说明             |
| ------ | ------------------ | ---------------------------- | ---------------- |
| GET    | `/categories`      | 🔓                           | 获取分类树形列表 |
| POST   | `/categories`      | 🛡️ `content:manage:category` | 新建分类         |
| PATCH  | `/categories/:id`  | 🛡️ `content:manage:category` | 编辑分类         |
| DELETE | `/categories/:id`  | 🛡️ `content:manage:category` | 删除分类         |
| PATCH  | `/categories/sort` | 🛡️ `content:manage:category` | 批量更新排序     |

---

## 标签模块 `/api/tags`

| 方法   | 路径        | 认证                    | 说明                 |
| ------ | ----------- | ----------------------- | -------------------- |
| GET    | `/tags`     | 🔓                      | 标签列表（含内容数） |
| POST   | `/tags`     | 🛡️ `content:manage:tag` | 新建标签             |
| DELETE | `/tags/:id` | 🛡️ `content:manage:tag` | 删除标签             |

---

## 收藏模块 `/api/favorites`

| 方法   | 路径                    | 认证                 | 说明         |
| ------ | ----------------------- | -------------------- | ------------ |
| GET    | `/favorites`            | 🔐                   | 我的收藏列表 |
| POST   | `/favorites/:contentId` | 🛡️ `favorite:manage` | 收藏内容     |
| DELETE | `/favorites/:contentId` | 🛡️ `favorite:manage` | 取消收藏     |

---

## 阅读进度 `/api/reading-records`

| 方法 | 路径                          | 认证 | 说明                            |
| ---- | ----------------------------- | ---- | ------------------------------- |
| GET  | `/reading-records/recent`     | 🔐   | 最近阅读（工作台用，最多 5 条） |
| PUT  | `/reading-records/:contentId` | 🔐   | 更新阅读进度（upsert）          |

**PUT 请求体**

```json
{
  "chapterId": "...", // 掘金小册用
  "scrollPosition": 1200, // px
  "pageNumber": 5, // PDF 用
  "progress": 45.5
}
```

---

## 文件模块 `/api/files`

| 方法   | 路径            | 认证 | 说明                            |
| ------ | --------------- | ---- | ------------------------------- |
| POST   | `/files/upload` | 🔐   | 上传文件（multipart/form-data） |
| GET    | `/files/:id`    | 🔓\* | 获取/代理文件（PDF/图片）       |
| DELETE | `/files/:id`    | 🔐   | 删除文件（仅上传者或管理员）    |

**POST `/files/upload` 请求参数**

- `file`：文件（multipart）
- `purpose`：`avatar` \| `cover` \| `pdf` \| `booklet_source` \| `general`

**响应 data**

```json
{
  "id": "...",
  "url": "/api/files/clxxx",
  "mimeType": "application/pdf",
  "size": 1048576
}
```

---

## AI 模块 `/api/ai`

### 模型列表（前端下拉用）

| 方法 | 路径         | 认证 | 说明                     |
| ---- | ------------ | ---- | ------------------------ |
| GET  | `/ai/models` | 🔓\* | 获取对当前用户可见的模型列表 |
| GET  | `/ai/tools`  | 🔓   | 工具广场卡片配置         |

**响应**：按 toolType 分组

```json
{
  "chat": [{ "id": "...", "modelId": "qwen-turbo", "label": "Qwen Turbo", "isDefault": true }],
  "text": [...],
  "image": [...]
}
```

> `🔓*` 表示未登录时只返回试用可见模型，登录后返回完整可用模型

---

### 对话（Chat）

| 方法   | 路径                                          | 认证         | 说明                     |
| ------ | --------------------------------------------- | ------------ | ------------------------ |
| GET    | `/ai/sessions`                                | 🔐           | 会话列表                 |
| POST   | `/ai/sessions`                                | 🛡️ `ai:chat` | 新建会话                 |
| GET    | `/ai/sessions/:id`                            | 🔐           | 会话详情（含 messages）  |
| PATCH  | `/ai/sessions/:id`                            | 🔐           | 重命名会话               |
| DELETE | `/ai/sessions/:id`                            | 🔐           | 删除会话                 |
| GET    | `/ai/sessions/:id/messages`                   | 🔐           | 获取消息列表（分页）     |
| POST   | `/ai/sessions/:id/messages`                   | 🔓\*         | 发送消息（SSE 流式返回） |
| POST   | `/ai/sessions/:id/messages/:msgId/regenerate` | 🛡️ `ai:chat` | 重新生成最后一条 AI 回复 |
| PATCH  | `/ai/sessions/:id/messages/:msgId/feedback`   | 🔐           | 消息反馈（thumbs_down）  |

访客试用请求额外字段：

```json
{
  "visitorId": "guest_browser_uuid"
}
```

**POST `/ai/sessions/:id/messages` SSE 响应格式**

```
Content-Type: text/event-stream

data: {"type":"delta","content":"你好"}
data: {"type":"delta","content":"，我"}
data: {"type":"delta","content":"是 AI"}
data: {"type":"done","tokenUsage":{"prompt":12,"completion":8,"total":20}}
data: [DONE]
```

**试用限制（未登录）**：

- 未登录用户使用独立 sessionId（存 localStorage），不保存历史
- 每日限 3 轮对话（后端按 IP + cookie_session_id 限流）
- 访客只能使用被标记为 `trialEnabled` 的 Chat 模型

---

### 文本生成（Text）

| 方法 | 路径                | 认证 | 说明                     |
| ---- | ------------------- | ---- | ------------------------ |
| POST | `/ai/text/generate` | 🔓\* | 文本生成（SSE 流式返回） |

**请求体**

```json
{
  "scene": "summarize", // 见 ai-tools.md 场景列表
  "input": "原文内容...",
  "modelId": "clxxx", // 可选，不传则用默认模型
  "params": {
    "outputLength": "medium", // short | medium | long
    "tone": "formal", // formal | casual | professional
    "targetLanguage": "en" // 翻译模式用
  }
}
```

**SSE 响应格式**：同 Chat

试用限制：

- 未登录每日最多 3 次。
- 未登录单次输入建议限制 2000 字，输出 500 字内。

---

### 图片生成（Image）

| 方法 | 路径                 | 认证          | 说明                             |
| ---- | -------------------- | ------------- | -------------------------------- |
| POST | `/ai/image/generate` | 🛡️ `ai:image` | 图片生成（同步返回，不使用 SSE） |

**请求体**

```json
{
  "prompt": "描述词...",
  "negativePrompt": "反向描述...",
  "size": "1024x1024",
  "count": 1,
  "style": "realistic",
  "modelId": "clxxx"
}
```

**响应 data**

```json
{
  "images": [{ "url": "https://...", "width": 1024, "height": 1024 }],
  "tokenCost": 500
}
```

---

## 用量模块 `/api/usage`

| 方法 | 路径               | 认证 | 说明                         |
| ---- | ------------------ | ---- | ---------------------------- |
| GET  | `/usage/summary`   | 🔐   | 配额汇总（工作台用量页顶部） |
| GET  | `/usage/logs`      | 🔐   | 使用明细（分页）             |
| GET  | `/usage/trend`     | 🔐   | 近 30 天趋势（折线图数据）   |
| GET  | `/usage/breakdown` | 🔐   | 工具消耗分布（饼图数据）     |

**GET `/usage/summary` 响应 data**

```json
{
  "tokenQuota": 10000,
  "tokenUsed": 1600,
  "tokenRemaining": 8400,
  "usagePercent": 16.0
}
```

---

## 工作台模块 `/api/workspace`

| 方法 | 路径               | 认证 | 说明                 |
| ---- | ------------------ | ---- | -------------------- |
| GET  | `/workspace/stats` | 🔐   | 工作台仪表盘统计数据 |

**GET `/workspace/stats` 响应 data**

```json
{
  "monthlyReadCount": 12,
  "tokenRemaining": 8400,
  "uploadedContentCount": 5,
  "recentRead": [...],      // 最近 5 条阅读记录
  "recentSessions": [...]   // 最近 3 条 AI 会话
}
```

---

## 系统公开配置 `/api/system`

| 方法 | 路径                    | 认证 | 说明                                  |
| ---- | ----------------------- | ---- | ------------------------------------- |
| GET  | `/system/config/public` | 🔓   | 获取公开系统配置（站点名/首页区块等） |
| GET  | `/system/homepage`      | 🔓   | 获取首页区块配置                      |
| GET  | `/system/theme`         | 🔓   | 获取主题色与导航布局配置              |

**GET `/system/theme` 响应 data**

```json
{
  "siteName": "个人知识中台",
  "theme": {
    "primaryColor": "#2563EB",
    "secondaryColor": "#14B8A6",
    "accentColor": "#F97316"
  },
  "navigation": {
    "publicPosition": "top",
    "workspacePosition": "left",
    "adminPosition": "left"
  },
  "reserved": {
    "radiusPreset": "md",
    "layoutDensity": "comfortable"
  }
}
```

---

## 管理员接口 `/api/admin`

> 所有接口需要 `admin` 角色

### 用户管理

| 方法  | 路径                          | 说明                                   |
| ----- | ----------------------------- | -------------------------------------- |
| GET   | `/admin/users`                | 用户列表（分页+筛选）                  |
| GET   | `/admin/users/:id`            | 用户详情                               |
| PATCH | `/admin/users/:id`            | 编辑用户基本信息                       |
| PATCH | `/admin/users/:id/status`     | 启用/禁用账号                          |
| PATCH | `/admin/users/:id/roles`      | 修改用户角色                           |
| POST  | `/admin/users/:id/token`      | 调整 Token 配额（`{ delta, remark }`） |
| GET   | `/admin/users/:id/token-logs` | Token 变更记录                         |

### 角色与权限管理

| 方法   | 路径                           | 说明                        |
| ------ | ------------------------------ | --------------------------- |
| GET    | `/admin/roles`                 | 角色列表                    |
| POST   | `/admin/roles`                 | 新建角色                    |
| PATCH  | `/admin/roles/:id`             | 编辑角色信息                |
| DELETE | `/admin/roles/:id`             | 删除角色（系统内置不可删）  |
| PUT    | `/admin/roles/:id/permissions` | 更新角色权限点（全量替换）  |
| GET    | `/admin/permissions`           | 权限点列表（按 group 分组） |

### 内容管理

| 方法   | 路径                           | 说明                             |
| ------ | ------------------------------ | -------------------------------- |
| GET    | `/admin/contents`              | 全量内容列表（含他人内容）       |
| GET    | `/admin/contents/:id`          | 内容详情（后台抽屉 / 详情页）    |
| PATCH  | `/admin/contents/:id/status`   | 修改内容状态                     |
| PATCH  | `/admin/contents/:id/visibility` | 修改可见性                    |
| PATCH  | `/admin/contents/:id/featured` | 设置/取消精选                    |
| POST   | `/admin/contents/:id/rebuild-toc` | 重新生成目录 / 章节统计      |
| DELETE | `/admin/contents/:id`          | 强制删除（`content:delete:all`） |

### 文件管理

| 方法   | 路径               | 说明                                  |
| ------ | ------------------ | ------------------------------------- |
| GET    | `/admin/files`     | 文件列表                              |
| DELETE | `/admin/files/:id` | 删除文件                              |
| DELETE | `/admin/files`     | 批量删除（body: `{ ids: string[] }`） |

### AI 配置

| 方法   | 路径                      | 说明     |
| ------ | ------------------------- | -------- |
| GET    | `/admin/ai/providers`     | 厂商列表 |
| POST   | `/admin/ai/providers`     | 新建厂商 |
| PATCH  | `/admin/ai/providers/:id` | 编辑厂商 |
| DELETE | `/admin/ai/providers/:id` | 删除厂商 |
| GET    | `/admin/ai/models`        | 模型列表 |
| POST   | `/admin/ai/models`        | 新建模型 |
| PATCH  | `/admin/ai/models/:id`    | 编辑模型 |
| DELETE | `/admin/ai/models/:id`    | 删除模型 |

### 分类与标签管理

| 方法   | 路径                         | 说明 |
| ------ | ---------------------------- | ---- |
| GET    | `/admin/categories`          | 分类树形列表 |
| POST   | `/admin/categories`          | 新建分类 |
| PATCH  | `/admin/categories/:id`      | 编辑分类 |
| DELETE | `/admin/categories/:id`      | 删除分类 |
| PATCH  | `/admin/categories/sort`     | 同级分类排序 |
| GET    | `/admin/tags`                | 标签列表 |
| POST   | `/admin/tags`                | 新建标签 |
| DELETE | `/admin/tags/:id`            | 删除标签 |

### AI 统计

| 方法 | 路径                      | 说明                       |
| ---- | ------------------------- | -------------------------- |
| GET  | `/admin/stats/ai/summary` | 全平台汇总（月/周/自定义） |
| GET  | `/admin/stats/ai/trend`   | 每日消耗趋势               |
| GET  | `/admin/stats/ai/users`   | 用户消耗排行               |
| GET  | `/admin/stats/ai/models`  | 模型消耗分布               |

### 首页配置

| 方法 | 路径              | 说明                         |
| ---- | ----------------- | ---------------------------- |
| GET  | `/admin/homepage` | 获取首页区块配置             |
| PUT  | `/admin/homepage` | 更新首页区块配置（全量替换） |

### 菜单管理

| 方法  | 路径                | 说明         |
| ----- | ------------------- | ------------ |
| GET   | `/admin/menus`      | 菜单树形列表 |
| PATCH | `/admin/menus/:id`  | 编辑菜单项   |
| PATCH | `/admin/menus/sort` | 批量更新排序 |

### 系统配置

| 方法 | 路径                    | 说明 |
| ---- | ----------------------- | ---- |
| GET  | `/admin/system/configs` | 系统配置列表（支持按 group 筛选） |
| PUT  | `/admin/system/configs` | 批量更新系统配置 |
| GET  | `/admin/system/theme`   | 获取主题与导航配置 |
| PUT  | `/admin/system/theme`   | 更新主题与导航配置 |

### 操作日志

| 方法 | 路径               | 说明 |
| ---- | ------------------ | ---- |
| GET  | `/admin/logs`      | 操作日志列表 |
| GET  | `/admin/logs/:id`  | 操作日志详情 |

### 系统配置

| 方法  | 路径                        | 说明           |
| ----- | --------------------------- | -------------- |
| GET   | `/admin/system/config`      | 全量配置列表   |
| PATCH | `/admin/system/config/:key` | 更新单个配置项 |
| PUT   | `/admin/system/config/batch`| 批量更新配置项 |

### 操作日志

| 方法 | 路径          | 说明                      |
| ---- | ------------- | ------------------------- |
| GET  | `/admin/logs` | 操作日志列表（分页+筛选） |
