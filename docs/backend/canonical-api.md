# Canonical Nest API 契约

> 状态：🟢 已确认，后续 NestJS、React 对接与 Next 迁移的唯一 API 来源
> 最后更新：2026-09-09
> 基础路径：`/api/v1`
> 关联：[后端实现约定](./conventions.md)、[数据模型](./canonical-data-model.md)、[React Mock 对照](./react-mock-migration.md)

---

## 1. 通用规则

- 成功使用 `2xx`，响应 `{ data, requestId }`；失败使用 `4xx/5xx`，响应 `{ error, requestId }`。
- 所有字段为 `camelCase`，固定枚举为 `UPPER_SNAKE_CASE`。
- 普通列表默认 `page=1&pageSize=10`，最大 `100`；滚动时间序列使用 `pageSize` 和不透明 `cursor`。工作区与后台表格默认页大小与此对齐。
- 受保护写接口接受 `Idempotency-Key`；标记 `必填` 的接口缺失时返回 `400 IDEMPOTENCY_KEY_REQUIRED`。
- 同一主体、方法、路径和幂等键携带不同请求体时返回 `409 IDEMPOTENCY_KEY_REUSED`；普通写操作记录保留 24 小时，AI、上传完成、导入、批量和其他高风险异步写操作保留 7 天。
- Web Access Token 通过 `Authorization: Bearer` 发送；Refresh Cookie 仅用于 Web 的 Auth 接口。
- 本文中的 `权限` 表示动作权限；数据范围 `OWN/ALL` 由服务端附加，客户端不得传 owner 或范围绕过校验。
- Web 生产环境同源：Next 位于 `/`、React Admin 位于 `/admin`、Nest API 位于 `/api/v1`。因此生产业务 API 不开放 CORS；开发环境仅允许明确本地 Origin 并携带 Cookie。
- Refresh Cookie 不设宽泛 `Domain`，使用 `Secure`、`HttpOnly`、`SameSite=Lax`。所有使用该 Cookie 的 Auth 接口都严格校验 `Origin` / `Referer` 同源白名单；Access Token 仍只从 Authorization Header 读取。

## 2. Auth：`/auth`

| 方法   | 路径                         | 鉴权                | 说明                                                             |
| ------ | ---------------------------- | ------------------- | ---------------------------------------------------------------- |
| POST   | `/auth/register`             | 公开                | 注册 `PENDING_VERIFICATION` member，发送验证邮件                 |
| POST   | `/auth/verify-email`         | 公开                | 消费一次性验证 Token 并激活账号                                  |
| POST   | `/auth/resend-verification`  | 公开                | 重新发送验证邮件，统一响应避免枚举                               |
| POST   | `/auth/captcha-challenges`   | 公开（限流）        | 在登录风险状态下创建 5 分钟一次性 SVG/算术验证码                 |
| POST   | `/auth/login`                | 公开                | Web 登录；可能要求验证码或返回 MFA challenge                     |
| POST   | `/auth/login/mfa`            | MFA challenge       | 校验 TOTP/恢复码后创建会话，写 Refresh Cookie，返回 Access Token |
| POST   | `/auth/refresh`              | Refresh Cookie      | 轮换 Web Refresh Token，返回 Access Token                        |
| POST   | `/auth/logout`               | Refresh Cookie / Access Token | 撤销当前会话并清 Cookie；Cookie 优先，没有再用 Bearer            |
| POST   | `/auth/forgot-password`      | 公开                | 发送一次性重置邮件，统一 `202` 响应                              |
| POST   | `/auth/reset-password`       | 公开                | 使用重置 Token 更新密码并撤销旧会话                              |
| GET    | `/auth/me`                   | 登录                | 当前身份、单角色、资料、权益摘要                                 |
| GET    | `/auth/permissions`          | 登录                | 有效动作权限、独立数据范围、按权限过滤后的菜单                   |
| GET    | `/auth/sessions`             | 登录                | 当前账号会话列表，含 `isCurrent`                                 |
| DELETE | `/auth/sessions/:sessionId`  | own / all           | 撤销指定非当前会话                                               |
| POST   | `/auth/sessions/revoke-all`  | 登录                | 撤销本人全部会话；可选保留当前会话                               |
| POST   | `/auth/change-password`      | 登录                | 当前密码 + 新密码；成功后撤销全部会话并递增 `authVersion`        |
| POST   | `/auth/change-email`         | 登录                | 需当前密码；创建新邮箱验证请求                                   |
| POST   | `/auth/confirm-email-change` | 公开                | 消费新邮箱验证 Token，更新邮箱并撤销其他会话                     |
| POST   | `/auth/mfa/totp/setup`       | admin / super_admin | 创建待确认的 TOTP 绑定信息                                       |
| POST   | `/auth/mfa/totp/confirm`     | admin / super_admin | 校验动态码，启用 TOTP 并仅此一次返回恢复码                       |
| POST   | `/auth/mfa/totp/disable`     | admin / super_admin | 校验当前密码和动态码后停用 TOTP                                  |

`POST /auth/register`：

```json
{ "email": "user@example.com", "password": "Abc!1234", "nickname": "昵称" }
```

- 密码至少 8 位，必须包含大写、小写、数字和特殊字符。
- 成功返回 `202`，不签发 Access/Refresh Token。
- 账号激活前登录返回 `403 AUTH_EMAIL_NOT_VERIFIED`。
- 已存在邮箱（含已激活、已禁用）同样返回 `202`，避免枚举；仅 `PENDING_VERIFICATION` 会轮换 Token 并重发邮件。

```json
// 202
{ "data": { "accepted": true }, "requestId": "uuid" }
```

`POST /auth/verify-email` 使用邮件链接中的一次性 Token（24 小时，SHA-256 + pepper 入库）：

```json
{ "token": "opaque-link-token" }
```

- 首次成功：用户变为 `ACTIVE`，同一事务创建 `ai_quota_accounts` 并按角色 `verification_grant_amount` 写入 `GRANT`（MEMBER 默认 10000）。幂等键 `email-verify-grant:{userId}`，重复点击不二次发放。
- Token 无效或过期：`400 AUTH_VERIFICATION_TOKEN_INVALID`。
- 已激活账号重复点击已消费 Token：仍返回成功。

```json
// 200
{ "data": { "verified": true }, "requestId": "uuid" }
```

`POST /auth/resend-verification`：

```json
{ "email": "user@example.com" }
```

- 始终 `202` `{ "accepted": true }`。仅未验证账号会真正发信。

`POST /auth/forgot-password`：

```json
{ "email": "user@example.com" }
```

- 始终 `202` `{ "accepted": true }`，避免枚举。仅 `ACTIVE` 账号会轮换 30 分钟一次性重置 Token 并发信（本地 Mailpit）。
- 同一邮箱 + IP 3 次 / 15 分钟，单 IP 10 次 / 15 分钟；超限 `429 AUTH_RATE_LIMITED` 带 `Retry-After`。

`POST /auth/reset-password`：

```json
{ "token": "opaque-link-token", "newPassword": "HubDev!234" }
```

- 新密码遵循注册策略。Token 无效、过期、已消费或账号非 ACTIVE：`400 AUTH_RESET_TOKEN_INVALID`。
- 成功后：更新密码哈希、`mustChangePassword=false`、递增 `authVersion`、撤销全部会话。

### 2.1 登录反爆破、验证码与 TOTP

- 登录按“账号规范化值 + IP”限制 5 次/15 分钟，IP 总计限制 20 次/15 分钟。密码错误统一返回 `401 AUTH_INVALID_CREDENTIALS`；超过窗口返回 `429 AUTH_RATE_LIMITED` 并带 `Retry-After`。
- 同一账号 + IP 连续 3 次失败后，下一次 `POST /auth/login` 缺少或提交无效验证码返回 `403 AUTH_CAPTCHA_REQUIRED`。客户端调用 `POST /auth/captcha-challenges` 获取 `{ challengeId, imageSvg, expiresIn: 300 }`，并将 `challengeId` 与 `captchaAnswer` 一并放入下一次登录 body。
- 验证码答案不在 HTTP 响应或客户端持久化中出现；挑战与账号/IP 的关联仅由服务端 Redis 保存。同一规范化邮箱 + IP 只保留最新一条挑战，刷新时删除旧键；验证成功、过期或使用后立即失效。
- 已绑定 TOTP 的 `admin` / `super_admin` 密码校验成功后返回 `202` 和短期 `mfaChallengeToken`，而不是创建会话。客户端随后调用 `/auth/login/mfa`：

```json
{
  "mfaChallengeToken": "short-lived-single-use-token",
  "code": "123456",
  "method": "TOTP"
}
```

- `method` 可为 `TOTP` 或 `RECOVERY_CODE`。错误响应统一为 `401 AUTH_MFA_INVALID`；MFA challenge 过期、已使用或与账号/IP 不匹配返回 `401 AUTH_MFA_CHALLENGE_INVALID`。
- 仅 `admin` / `super_admin` 可自愿绑定 TOTP，首版默认不强制。确认绑定接口返回恢复码数组一次，之后不可再次读取；停用操作必须同时验证当前密码和 TOTP。

获取验证码挑战：

```json
// POST /auth/captcha-challenges
{ "email": "user@example.com" }

// 200
{
  "data": {
    "challengeId": "uuid",
    "imageSvg": "<svg>…</svg>",
    "expiresIn": 300
  },
  "requestId": "uuid"
}
```

登录请求的可选验证码字段：

```json
{
  "email": "user@example.com",
  "password": "Abc!1234",
  "challengeId": "uuid-or-omitted",
  "captchaAnswer": "abcd-or-omitted"
}
```

Web 登录、MFA 登录完成或刷新成功：

```json
{
  "data": {
    "accessToken": "jwt",
    "expiresIn": 28800,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "nickname": "昵称",
      "role": "MEMBER",
      "status": "ACTIVE"
    }
  },
  "requestId": "uuid"
}
```

未来 Flutter 使用独立 `/auth/mobile/*` 登录/刷新传输契约；Refresh Token 写入 App 系统安全存储，复用同一 SessionService，不削弱 Web Cookie 策略。

`POST /auth/logout`（Web）：

- 必须校验 `Origin` / `Referer` 同源白名单，与 `/auth/refresh` 相同。
- 优先用 Refresh Cookie 反查当前 `sid` 并撤销；Cookie 缺失或无法识别时，再用未过期 Access Token。
- 没有有效凭证也返回 `200 { "loggedOut": true }` 并清 Cookie，避免前端无法幂等退出。
- 只撤销当前这一场会话，不会变成踢全部设备。

首版仅支持邮箱密码认证。GitHub、微信等 OAuth 不提供表、回调或绑定接口；不得把它们作为登录备用路径。

`GET /auth/permissions` 不把权限写入 JWT。响应为当前角色的动作权限、独立数据范围，以及按权限过滤后的菜单树（多权限菜单为 OR；无关联权限的菜单对已登录用户可见）。后端只返回 `routeKey`，前端用路由注册表解析路径。

```json
{
  "data": {
    "permissions": [{ "code": "content:read", "dataScope": "OWN" }],
    "menus": [
      {
        "id": "uuid",
        "scope": "WORKSPACE",
        "type": "INTERNAL",
        "name": "文档管理",
        "routeKey": "workspace.contents",
        "externalUrl": null,
        "sortOrder": 10,
        "children": []
      }
    ]
  },
  "requestId": "uuid"
}
```

`GET /auth/sessions` 不返回 Token、完整 User-Agent 或精确 IP：

```json
{
  "data": [
    {
      "id": "uuid",
      "deviceName": "Mac",
      "browser": "Chrome",
      "ipMasked": "127.0.0.0",
      "lastActiveAt": "2026-08-21T11:00:00.000Z",
      "createdAt": "2026-08-21T10:00:00.000Z",
      "isCurrent": true
    }
  ],
  "requestId": "uuid"
}
```

- `DELETE /auth/sessions/:sessionId` 不能撤销当前会话，返回 `400 AUTH_CANNOT_REVOKE_CURRENT`。
- `POST /auth/sessions/revoke-all` body `{ "keepCurrent": true }`；`keepCurrent` 默认 `true`。为 `false` 时撤销全部会话并清 Refresh Cookie。

`POST /auth/change-password`：

```json
{ "currentPassword": "OneTimePassword!1", "newPassword": "HubDev!234" }
```

- 新密码遵循与注册相同的策略，且不能与当前密码相同。
- 当前密码错误返回 `401 AUTH_INVALID_CREDENTIALS`。
- 成功后：`mustChangePassword=false`，递增 `authVersion`，撤销该用户全部会话，清 Refresh Cookie。客户端必须重新登录。
- `mustChangePassword === true` 的账号除 `GET /auth/me`、`GET /auth/permissions`、`POST /auth/logout`、`POST /auth/change-password` 外，其它受保护接口返回 `403 AUTH_PASSWORD_CHANGE_REQUIRED`。

## 3. Public：`/public`

### 3.1 站点配置和导航

| 方法 | 路径                  | 说明                                                      |
| ---- | --------------------- | --------------------------------------------------------- |
| GET  | `/public/site-config` | 白名单公开配置：站点、主题、首页、About Markdown、AI 开关 |
| GET  | `/public/navigation`  | 匿名可见的 public/ai 菜单                                 |

### 3.2 内容读取

| 方法 | 路径                                              | 说明                             |
| ---- | ------------------------------------------------- | -------------------------------- |
| GET  | `/public/contents`                                | 公开内容列表                     |
| GET  | `/public/contents/featured`                       | 当前主体可见的精选内容           |
| GET  | `/public/contents/meta`                           | 公开分类树和标签筛选元数据       |
| GET  | `/public/contents/:contentId`                     | 内容详情；成功后异步去重阅读计数 |
| GET  | `/public/contents/:contentId/chapters`            | BOOKLET 章节索引，不含正文       |
| GET  | `/public/contents/:contentId/chapters/:chapterId` | 单章正文和目录                   |

`GET /public/contents`：

| 参数                | 说明                   |
| ------------------- | ---------------------- |
| `categorySlug`      | 公开 URL 使用分类 slug |
| `tagSlugs`          | 逗号分隔，AND 匹配     |
| `types`             | 内容类型集合           |
| `keyword`           | 标题/摘要/受限正文搜索 |
| `sort`              | `LATEST` / `POPULAR`   |
| `page` / `pageSize` | 普通分页               |

可见性：

- `PUBLISHED + PUBLIC`：匿名可读。
- `PUBLISHED + LOGIN`：匿名列表返回锁定卡片和摘要，正文详情返回 `401 AUTH_REQUIRED`；登录后可读。
- `PRIVATE`、`DRAFT`、`ARCHIVED`：非所有者/非管理员通过 public 路径返回 `404 CONTENT_NOT_FOUND`。
- 导入 BOOKLET 在解除版权限制前即使已发布也只允许作者/管理员读取。

## 4. App：`/app`

所有 App 接口要求登录；member 可以使用个人能力，只有具备 `content:*` 的 editor/admin 能创作、编辑和发布内容。

### 4.1 工作区与个人资料

| 方法  | 路径             | 权限 | 说明                                       |
| ----- | ---------------- | ---- | ------------------------------------------ |
| GET   | `/app/dashboard` | 登录 | 个人统计、最近阅读、最近 AI 活动、权益摘要 |
| GET   | `/app/profile`   | 登录 | 当前用户公开资料与偏好                     |
| PATCH | `/app/profile`   | 登录 | 昵称、头像 FileAsset、简介、网站/社交链接  |
| GET   | `/app/usage`     | 登录 | 配额汇总、趋势和使用明细入口               |

普通资料 PATCH 不得更新邮箱、密码、角色、会话或额度。

### 4.2 我的内容

| 方法   | 路径                               | 权限                                  | 说明                                  |
| ------ | ---------------------------------- | ------------------------------------- | ------------------------------------- |
| GET    | `/app/contents`                    | `content:read`                        | 我的内容/回收站列表；`lifecycle=DRAFT | PUBLISHED | ARCHIVED`、`includeDeleted=true` 仅查询本人 OWN 或授权 ALL 范围内的内容 |
| POST   | `/app/contents`                    | `content:create`，必填幂等键          | 创建草稿                              |
| GET    | `/app/contents/:contentId`         | `content:read` OWN/ALL                | 工作区详情，含编辑源数据              |
| PATCH  | `/app/contents/:contentId`         | `content:update` OWN/ALL              | 更新元信息/正文                       |
| POST   | `/app/contents/:contentId/publish` | `content:publish` OWN/ALL，必填幂等键 | OWN：提交审核（内容保持 `DRAFT`，列表 `reviewStatus=PENDING`）；ALL：校验、快照、即时发布。可选 `{ requestedVisibility, copyrightNote }` |
| POST   | `/app/contents/:contentId/archive` | `content:publish` OWN/ALL             | 归档                                  |
| DELETE | `/app/contents/:contentId`         | `content:delete` OWN/ALL              | 软删除                                |
| POST   | `/app/contents/:contentId/restore` | `content:restore` OWN/ALL             | 30 天内恢复                           |

内容 payload 按类型互斥：

| 类型               | 编辑源/引用                                |
| ------------------ | ------------------------------------------ |
| `MARKDOWN`         | `markdownSource`                           |
| `RICH_TEXT`        | `editorDocument` JSON；服务端生成净化 HTML |
| `BOOKLET`          | 由导入任务创建，章节不在 PATCH 直接提交    |
| `PDF` / `WORD`     | `primaryFileId` 指向 `READY` FileAsset     |
| `LINK` / `PROJECT` | 合法 `https` 外链；后端不抓取远程预览      |

内容列表统一响应：

```json
{
  "data": {
    "list": [
      {
        "id": "uuid",
        "type": "MARKDOWN",
        "title": "…",
        "status": "PUBLISHED",
        "visibility": "PUBLIC",
        "reviewStatus": null,
        "updatedAt": "2026-08-02T00:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 10
  },
  "requestId": "uuid"
}
```

详情在列表字段基础上按内容类型附加唯一编辑源：`markdownSource`、`editorDocument`、`primaryFileId`、`externalUrl` 或小册章节索引；回收站条目额外返回 `deletedAt` 与可恢复截止时间。工作区/后台列表项额外返回最近一条 `reviewStatus`（`PENDING` / `APPROVED` / `REJECTED` / `CANCELED` / `null`）。字段缺失不代表客户端猜测默认值，DTO/OpenAPI 必须显式声明可选性。

### 4.3 收藏与阅读

| 方法   | 路径                              | 说明                    |
| ------ | --------------------------------- | ----------------------- |
| GET    | `/app/favorites`                  | 我的收藏列表            |
| PUT    | `/app/favorites/:contentId`       | 幂等收藏可见内容        |
| DELETE | `/app/favorites/:contentId`       | 幂等取消收藏            |
| GET    | `/app/reading-records/recent`     | 最近阅读，默认最多 5 条 |
| PUT    | `/app/reading-records/:contentId` | 幂等 upsert 进度        |

阅读进度请求：

```json
{
  "contentProgressPercent": 47.5,
  "chapterId": "uuid-or-null",
  "chapterProgressPercent": 12.0
}
```

小册恢复使用 `chapterId + chapterProgressPercent`；普通文章只使用 `contentProgressPercent`。客户端应节流提交。

### 4.4 上传和小册导入

| 方法 | 路径                                | 权限                                 | 说明                                 |
| ---- | ----------------------------------- | ------------------------------------ | ------------------------------------ |
| POST | `/app/uploads`                      | 登录，必填幂等键                     | 创建单 PUT 或 Multipart 上传会话     |
| POST | `/app/uploads/:uploadId/complete`   | 登录，必填幂等键，高风险 7 天         | 校验对象前缀魔数与流式 SHA-256，创建 READY FileAsset |
| GET    | `/app/upload-tasks`                 | 登录                                 | 文件与小册导入按 `createdAt` 真分页；不接受 `mimeKind`；可选 `taskKind=booklet\|pdf\|word\|zip` 服务端过滤；`hasActiveBookletImports` 表示存在 `QUEUED`/`VALIDATING`/`IMPORTING` |
| GET    | `/app/files`                        | 登录                                 | 当前用户上传任务文件分页；默认不按 MIME 裁剪；`hiddenFromTaskList=false`；已挂导入任务的源文件由 booklet-imports 展示 |
| DELETE | `/app/files/:fileId`                | 登录且为上传者                       | 从上传任务列表隐藏，不删文件与内容 |
| GET    | `/app/files/:fileId/download-url`   | own / all                            | 校验后签发短时 URL                   |
| POST   | `/app/booklet-imports`              | `booklet:import` OWN/ALL，必填幂等键，高风险 7 天 | 基于 ZIP FileAsset 创建导入任务      |
| GET    | `/app/booklet-imports`              | `booklet:import` OWN                 | 当前用户导入任务分页；排除已隐藏条目 |
| GET    | `/app/booklet-imports/:jobId`       | own / all                            | 轮询导入任务                         |
| POST   | `/app/booklet-imports/:jobId/retry` | own / all，必填幂等键，高风险 7 天   | 重试同一条失败任务，不新建内容       |
| DELETE | `/app/booklet-imports/:jobId`       | own                                  | 从上传任务列表隐藏，不删草稿与源 ZIP |

上传小于等于 20 MiB 时返回单 PUT 签名 URL；超过时返回 S3 Multipart 分片计划。导入任务不在 HTTP 请求中同步解压。

### 4.5 AI

| 方法         | 路径                                     | 说明                                          |
| ------------ | ---------------------------------------- | --------------------------------------------- |
| GET          | `/app/ai/home`                           | 工具、可见模型、权益、模板和近期活动聚合      |
| GET          | `/app/ai/models`                         | 当前用户可选模型                              |
| GET/POST     | `/app/ai/templates`                      | 系统模板与我的私有模板列表/创建               |
| PATCH/DELETE | `/app/ai/templates/:templateId`          | 仅更新/删除私有模板                           |
| GET/POST     | `/app/ai/sessions`                       | 会话列表/创建                                 |
| PATCH/DELETE | `/app/ai/sessions/:sessionId`            | 重命名/软删除会话                             |
| GET          | `/app/ai/sessions/:sessionId/messages`   | cursor 加载历史消息                           |
| POST         | `/app/ai/sessions/:sessionId/messages`   | SSE 发送 Chat 消息，必填幂等键                |
| POST         | `/app/ai/messages/:messageId/regenerate` | SSE 生成新 variant，必填幂等键                |
| PATCH        | `/app/ai/messages/:messageId/feedback`   | 反馈                                          |
| POST         | `/app/ai/text-generations`               | SSE 文本生成，必填幂等键                      |
| POST         | `/app/ai/image-generations`              | `202` 创建图片任务，必填幂等键                |
| GET          | `/app/ai/image-generations/:jobId`       | 轮询图片任务                                  |
| POST         | `/app/ai/video-generations`              | `202` 创建 MockVideoProvider 任务，必填幂等键 |
| GET          | `/app/ai/video-generations/:jobId`       | 轮询视频 Mock 任务                            |
| GET/POST     | `/app/ai/assets`                         | AI 资产列表/创建元数据                        |
| PATCH/DELETE | `/app/ai/assets/:assetId`                | 移动、软删除、恢复、永久删除                  |
| GET/POST     | `/app/ai/asset-folders`                  | 资产文件夹列表/创建                           |
| PATCH/DELETE | `/app/ai/asset-folders/:folderId`        | 重命名/删除空文件夹                           |
| GET          | `/app/ai/entitlement`                    | 当前角色/套餐权益和用量                       |

Chat/Text SSE 事件：

```text
event: message
data: {"type":"STARTED","assistantMessageId":"uuid"}

event: message
data: {"type":"DELTA","content":"增量文本"}

event: message
data: {"type":"DONE","usage":{"inputTokens":12,"outputTokens":20,"platformCost":32}}
```

- 连接中断或用户停止：终止厂商流，保存已产生部分并标记 `STOPPED`，按实际使用结算。
- 重新生成保留旧回复，使用 `variantGroupId` 关联候选，默认展示最新候选。
- 图片/视频/导入任务只轮询资源，不复用 Chat SSE。

### 4.6 匿名 AI

匿名接口位于 `/public/ai/*`，只允许 Chat/Text：

| 方法 | 路径                          | 说明             |
| ---- | ----------------------------- | ---------------- |
| POST | `/public/ai/chat`             | SSE 访客 Chat    |
| POST | `/public/ai/text-generations` | SSE 访客文本生成 |

服务端管理签名 HttpOnly 匿名 Cookie，并叠加 IP Hash 限流。匿名历史保存 30 天；首次登录自动认领同浏览器尚未过期历史。图片必须登录。

## 5. Admin：`/admin`

### 5.1 用户、角色与审计

| 方法         | 路径                                       | 权限                                 |
| ------------ | ------------------------------------------ | ------------------------------------ |
| GET          | `/admin/dashboard`                         | `dashboard:read`                     |
| GET          | `/admin/users`                             | `user:read` ALL                      |
| GET          | `/admin/users/:userId`                     | `user:read` ALL                      |
| PATCH        | `/admin/users/:userId/status`              | `user:status:update` ALL             |
| PUT          | `/admin/users/:userId/role`                | `user:role:assign` ALL               |
| GET          | `/admin/users/:userId/sessions`            | `user:session:read` ALL              |
| POST         | `/admin/users/:userId/sessions/revoke-all` | `user:session:revoke` ALL            |
| POST         | `/admin/users/:userId/quota-adjustments`   | `ai:quota:adjust` ALL，必填幂等键    |
| GET/POST     | `/admin/roles`                             | `role:read` / `role:manage`          |
| PATCH/DELETE | `/admin/roles/:roleId`                     | `role:manage`                        |
| PUT          | `/admin/roles/:roleCode/permissions`      | `role:permission:manage`，必填幂等键；body `{ permissions, version }`，`version` 为列表返回的乐观锁；冲突 `409 ROLE_VERSION_CONFLICT` |
| GET          | `/admin/permissions`                       | `role:read`                          |
| GET          | `/admin/audit-logs`                        | `audit:read` ALL                     |
| GET          | `/admin/audit-logs/:logId`                 | `audit:read` ALL                     |

- 用户首版只有一个角色；`super_admin` 受不可降级/不可禁用/至少保留一名 active 约束。
- 禁用用户、改角色、改权限必须使现有 Token 下一次受保护请求失效。
- 约束刀已落地：`GET /admin/users`、`GET /admin/users/:userId/sessions`、`POST /admin/users/:userId/sessions/revoke-all`。`admin` 不能踢 `admin` / `super_admin`，也不能踢自己。禁用用户 / 改用户角色 / 额度仍后置。
- 角色权限已落地：`GET /admin/roles` 返回 `version`；`PUT /admin/roles/:roleCode/permissions` 必填 `version` 与幂等键。不能改 `SUPER_ADMIN`；创建自定义角色、按权限配 `OWN`/`ALL` 仍后置。

### 5.2 内容、分类、标签与文件

| 方法         | 路径                                        | 权限                                                  | 说明                           |
| ------------ | ------------------------------------------- | ----------------------------------------------------- | ------------------------------ |
| GET          | `/admin/contents`                           | `content:read` ALL                                    | 跨作者列表和筛选               |
| GET          | `/admin/contents/:contentId`                | `content:read` ALL                                    | 后台详情                       |
| POST         | `/admin/contents/:contentId/publish`        | `content:publish` ALL，必填幂等键                     | 代发布（即时，不进审核队列） |
| POST         | `/admin/contents/:contentId/archive`        | `content:publish` ALL                                 | 代归档                         |
| PATCH        | `/admin/contents/:contentId/featured`       | `content:featured` ALL，必填幂等键                    | 设置精选                       |
| POST         | `/admin/contents/:contentId/restore`        | `content:restore` ALL，必填幂等键                     | 恢复软删除内容                 |
| DELETE       | `/admin/contents/:contentId/purge`          | `content:purge` ALL；仅 super_admin，必填幂等键和原因 | 永久删除                       |
| POST         | `/admin/contents/:contentId/import-license` | `content:publish` ALL，必填幂等键                     | 内部清闸实现；UI 走内容审核。必填授权说明 |
| GET          | `/admin/content-reviews`                    | `content:publish` ALL                                 | 审核队列；`?status=&page=&pageSize=` |
| POST         | `/admin/content-reviews/:reviewId/approve`  | `content:publish` ALL，必填幂等键                     | 通过并发布；导入且目标为公开/登录时 body `{ copyrightNote }` 必填 |
| POST         | `/admin/content-reviews/:reviewId/reject`   | `content:publish` ALL，必填幂等键                     | 驳回，body `{ reason }` 必填   |
| GET/POST     | `/admin/categories`                         | `category:manage` ALL                                 | 分类树/创建                    |
| PATCH/DELETE | `/admin/categories/:categoryId`             | `category:manage` ALL                                 | 更新/删除                      |
| PATCH        | `/admin/categories/sort`                    | `category:manage` ALL，必填幂等键                     | 同父节点批量排序               |
| GET/POST     | `/admin/tags`                               | `tag:manage` ALL                                      | 标签列表/后台创建              |
| DELETE       | `/admin/tags/:tagId`                        | `tag:manage` ALL                                      | 被引用时返回冲突和关联数       |
| GET          | `/admin/files`                              | `file:read` ALL                                       | 文件资产列表                   |
| DELETE       | `/admin/files/:fileId`                      | `file:delete` ALL，必填幂等键                         | 逻辑删除并异步引用检查         |
| DELETE       | `/admin/files`                              | `file:delete` ALL，必填幂等键                         | 批量删除，返回逐项结果         |

导入版权限制状态仅为 `NONE` 或 `PRIVATE_UNTIL_LICENSED`。ZIP 导入创建的内容固定为后者。`import-license` 仍作为内部清闸路径保留（同一事务写授权说明、操作者、审计和 `ContentVersion`），审核通过或所有者/管理员直接发布且目标可见性为 `PUBLIC`/`LOGIN` 时复用该逻辑。编辑者（`content:publish` OWN）发布只创建 `ContentReview`（`PENDING`），内容保持 `DRAFT`，不能自己公开。

### 5.3 系统、菜单与 AI 配置

| 方法         | 路径                              | 说明                        |
| ------------ | --------------------------------- | --------------------------- |
| GET          | `/admin/system-configs`           | 类型化配置；`?group=` 可选，不传返回全部 |
| PUT          | `/admin/system-configs/:group`    | 同组原子更新，必填幂等键    |
| GET/POST     | `/admin/menus`                    | 完整树/新增菜单项           |
| PATCH/DELETE | `/admin/menus/:menuId`            | 单项更新/删除               |
| PATCH        | `/admin/menus/sort`               | 批量排序                    |
| GET          | `/admin/menu-route-options`       | 前端受控 routeKey 清单      |
| GET          | `/admin/ai/config`                | 只读 BFF 聚合               |
| GET          | `/admin/ai/stats`                 | 只读 BFF 统计，支持时间范围 |
| GET/POST     | `/admin/ai/providers`             | 资源管理；Key 只写不回显    |
| PATCH/DELETE | `/admin/ai/providers/:providerId` | 更新/删除                   |
| GET/POST     | `/admin/ai/models`                | 模型资源管理                |
| PATCH/DELETE | `/admin/ai/models/:modelId`       | 更新/删除                   |
| GET/POST     | `/admin/ai/tools`                 | 工具展示与启用配置          |
| PATCH/DELETE | `/admin/ai/tools/:toolId`         | 更新/删除                   |
| GET/POST     | `/admin/ai/templates`             | 系统模板管理                |
| PATCH/DELETE | `/admin/ai/templates/:templateId` | 更新/删除系统模板           |
| GET/PUT      | `/admin/ai/entitlements`          | 角色/套餐额度和模型权益     |

### 5.4 领域错误码目录

所有失败仍使用统一 `{ error, requestId }` 信封；以下是模块实现前必须写入 DTO/OpenAPI 并覆盖 HTTP E2E 的最小错误码目录：

| 领域                   | 代表错误码                                                                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content                | `CONTENT_NOT_FOUND`、`CONTENT_INVALID_STATE`、`CONTENT_PUBLISH_VALIDATION_FAILED`、`CONTENT_VERSION_CONFLICT`、`CONTENT_IMPORT_RESTRICTION_ACTIVE` |
| Category / Tag         | `CATEGORY_NOT_FOUND`、`CATEGORY_IN_USE`、`CATEGORY_CYCLE_DETECTED`、`TAG_IN_USE`                                                                   |
| File / Upload / Import | `FILE_NOT_FOUND`、`FILE_NOT_READY`、`FILE_VALIDATION_FAILED`、`UPLOAD_EXPIRED`、`BOOKLET_IMPORT_FAILED`、`BOOKLET_IMPORT_NOT_RETRYABLE`            |
| AI                     | `AI_MODEL_NOT_AVAILABLE`、`AI_QUOTA_INSUFFICIENT`、`AI_CONCURRENCY_LIMITED`、`AI_GENERATION_NOT_FOUND`                                             |
| Admin / Audit          | `RBAC_PERMISSION_DENIED`、`RBAC_DATA_SCOPE_DENIED`、`ADMIN_PROTECTED_ACCOUNT`、`ADMIN_LAST_SUPER_ADMIN`、`AUDIT_LOG_NOT_FOUND`                     |
| System / Menu          | `SYSTEM_CONFIG_NOT_FOUND`、`SYSTEM_CONFIG_INVALID`、`SYSTEM_CONFIG_VERSION_CONFLICT`、`MENU_NOT_FOUND`、`MENU_INVALID`、`MENU_CYCLE_DETECTED`、`MENU_HAS_CHILDREN`、`MENU_ROUTE_KEY_UNAVAILABLE`、`MENU_CORE_PROTECTED`、`MENU_INVALID_EXTERNAL_URL`、`MENU_VERSION_CONFLICT` |

## 6. 旧 Mock 迁移

- 新 API 不保留长期别名。React 对接时建立明确 adapter 或一次性迁移 service。
- `/api/auth/current-user` → `/api/v1/auth/me`。
- `/api/workspace/*` → `/api/v1/app/*`。
- `/api/contents/*` → `/api/v1/public/contents/*` 或 `/api/v1/app/contents/*`，按调用者与可见性拆分。
- 前端手动 `consumeAiQuota`、本地 SSE 完成后 `persistAiChatMessages` 必须删除；改为服务端流式持久化与结算。
- `/api/admin/ai/config` 的写入拆为资源端点，保留同名新路径仅作只读聚合。
