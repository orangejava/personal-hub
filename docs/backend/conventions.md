# NestJS 后端实现约定

> 状态：🟢 已确认，编码前必须遵循
> 最后更新：2026-08-02
> 适用：`apps/server` 及后续 NestJS 模块
> 权威范围：工程、命名、API 横切规则、数据访问、Redis、队列、日志与测试。领域端点见 [canonical-api.md](./canonical-api.md)，数据实体见 [canonical-data-model.md](./canonical-data-model.md)。

---

## 1. 客户端与 API 分区

Nest 是所有客户端共用的后端，不依赖当前 React 路由：

```text
未来 Next：公开前台、登录后个人工作区
当前 React：过渡期混合前端，最终只保留后台管理台
未来 Flutter：移动端
        ↓
apps/server
```

统一路径前缀为 `/api/v1`：

| 分区   | 路径        | 适用客户端 | 含义                            |
| ------ | ----------- | ---------- | ------------------------------- |
| Auth   | `/auth/*`   | 全部       | 注册、登录、会话、凭证          |
| Public | `/public/*` | 匿名/登录  | 公开站点与可见内容              |
| App    | `/app/*`    | 登录用户   | 个人工作区、收藏、阅读、AI 资产 |
| Admin  | `/admin/*`  | 后台管理台 | 用户、角色、配置、运营治理      |

- `public/app/admin` 是 HTTP 与权限边界，不是三套重复业务模块。
- 内部按 `auth`、`content`、`file`、`ai`、`system` 等领域模块组织。
- `apps/react-web` 的 `/api/workspace/*`、旧 `/api/contents/*` 等 mock 路径只作迁移线索，不是新 API 的规范。

## 2. Nest 模块与数据访问

采用领域垂直模块：

```text
src/
├── common/                    # 与领域无关的 Guard、Filter、Interceptor、类型
├── config/                    # 环境配置与 Zod 校验
├── infrastructure/            # Prisma、Redis、Storage、Mail、Queue、日志实现
└── modules/
    └── content/
        ├── content.module.ts
        ├── content.controller.ts
        ├── content.service.ts
        ├── content.repository.ts
        ├── dto/
        ├── policies/
        └── providers/
```

- Controller：HTTP 路由、DTO、权限装饰器、响应状态；不写业务判断或 Prisma 查询。
- Service：用例编排、状态机、权限范围、事务、调用领域 Provider。
- Repository：本模块唯一可直接访问 Prisma 的位置；封装查询、持久化和索引相关查询。
- Provider：对象存储、邮件、AI 厂商等可替换外部能力的接口。
- 不为简单类型再建立“全局 controllers/services/repositories”顶层目录。

### 2.1 事务规则

跨 Repository 的原子用例由 Service 开启事务：

```ts
await prisma.$transaction(async (tx) => {
  await contentRepository.publish(tx, input);
  await contentVersionRepository.createPublishSnapshot(tx, input);
  await outboxRepository.enqueue(tx, event);
});
```

- Repository 接收 `PrismaClient | Prisma.TransactionClient` 执行器。
- Repository 不为跨领域用例自行开启顶层事务。
- 禁止以进程内锁保护余额、会话或并发；多实例环境下无效。
- AI 余额预占使用带条件的原子更新，例如 `remaining >= reservedAmount`，受影响行数为 0 时返回 `AI_QUOTA_INSUFFICIENT`。

### 2.2 Outbox 与异步投递

创建图片生成、导入、清理、备份等任务时：

1. 业务记录与 `outbox_events` 在同一 PostgreSQL 事务写入。
2. Dispatcher 读取未投递事件，投递 BullMQ 后标记为已投递。
3. Consumer 以业务任务 ID 或幂等键处理重复投递。
4. 失败事件保留可诊断的脱敏错误摘要并重试。

禁止“数据库提交成功后仅尝试一次 `queue.add()`，失败只记日志”。

## 3. PostgreSQL 与 Prisma 命名

| 层              | 规则                                                                      |
| --------------- | ------------------------------------------------------------------------- |
| PostgreSQL 表   | 复数 `snake_case`，如 `auth_sessions`                                     |
| PostgreSQL 字段 | `snake_case`，如 `permission_version`                                     |
| Prisma Model    | 单数 `PascalCase`，如 `AuthSession`                                       |
| Prisma 字段     | `camelCase`，使用 `@map` / `@@map` 映射                                   |
| 主键            | PostgreSQL UUID；API 返回 UUID 字符串                                     |
| 时间            | `timestamptz` / Prisma `DateTime`；API 返回 ISO 8601 UTC                  |
| 枚举            | API 使用 `UPPER_SNAKE_CASE`；数据库枚举或受约束字符串必须在领域文档中明确 |

- 可恢复业务实体（内容、文件、AI 资产、菜单等）使用 `deleted_at`；会话、额度账本、审计日志、outbox 等事实记录不做软删除。
- 可编辑内容、菜单、角色、模型配置维护递增 `version`，首版默认后写覆盖前写；未来启用乐观锁时在 PATCH 带 `version` 并返回 `409`。
- 所有共享/生产 Schema 变更必须提交 Prisma migration；禁止在共享或生产环境使用 `prisma db push`。
- 迁移前必须备份，测试/预发布环境先执行迁移验证。

## 4. HTTP、DTO 与错误

### 4.1 响应语义

```json
// 2xx
{ "data": {}, "requestId": "uuid" }

// 4xx / 5xx
{
  "error": {
    "code": "CONTENT_VERSION_CONFLICT",
    "message": "内容已被更新，请刷新后重试",
    "details": []
  },
  "requestId": "uuid"
}
```

- HTTP 状态码表达请求成功或失败；禁止用 `200 + code != 0` 表示失败。
- `error.code` 使用全大写 `DOMAIN_REASON`，如 `AUTH_INVALID_CREDENTIALS`、`RBAC_PERMISSION_DENIED`、`AI_QUOTA_INSUFFICIENT`。
- 批量操作本身执行成功但部分条目失败时返回 `200`，在 `data.results[]` 给出每项状态和错误码。
- 异步任务受理返回 `202` 和任务资源；不是 `200` 内塞“处理中错误码”。
- 每个请求由服务端生成 UUID `requestId`，写入响应体、`X-Request-Id`、日志、审计、outbox 和队列上下文。客户端传入的同名 Header 不可替代服务端 ID。

### 4.2 DTO 与 PATCH

- DTO 使用 `class-validator`、`class-transformer` 和全局 `ValidationPipe`，启用白名单并拒绝未知字段。
- 字段采用 `camelCase`；固定枚举采用 `UPPER_SNAKE_CASE`。
- PATCH 中字段缺失表示不修改；可空字段显式 `null` 表示清空。
- 数组字段在 PATCH 中整体替换；复杂关系增删使用专用端点。
- 所有写接口支持 `Idempotency-Key`；AI 发起、上传完成、导入、批量和高风险操作必须携带。
- 幂等记录按“认证/匿名主体 + HTTP 方法 + 路径 + Key”保存首次状态码、白名单响应和请求指纹，重试返回相同结果。
- 相同主体、方法、路径和 Key 若携带不同请求指纹，返回 `409 IDEMPOTENCY_KEY_REUSED`，禁止把旧结果错配给新请求。
- 普通写操作保留 24 小时；AI 发起、上传完成、导入、批量和其他高风险异步操作保留 7 天。每次用户主动新操作必须生成新 Key，不能复用过期或已完成操作的 Key。

### 4.3 认证入口安全

- Web 生产环境同源部署：Next 位于 `/`、React Admin 位于 `/admin`、Nest 位于 `/api/v1`。生产不开放业务 CORS；开发环境只允许明确本地 Origin。
- Refresh Cookie 不设宽泛 `Domain`，使用 `Secure + HttpOnly + SameSite=Lax`。所有 Cookie 鉴权 Auth 路由严格校验 `Origin` / `Referer` 同源白名单；Access Token 只从 Authorization Header 读取。
- 登录使用账号规范化值 + IP 的 5 次/15 分钟限制，并叠加 IP 总计 20 次/15 分钟限制。连续 3 次失败后，下一次登录必须完成 5 分钟、一次性的自建 SVG/算术验证码；验证码答案只保存 Redis 哈希。
- `admin`、`super_admin` 可自主绑定 TOTP；启用后密码校验只换取单次短期 MFA challenge，验证 TOTP 或恢复码后才可签发会话。恢复码只保存哈希，绑定/停用/使用/重置都写审计。
- 旧 Refresh Token 被重放时，只撤销当前设备会话和 Token 链；不波及该用户其他会话。

### 4.4 分页

| 场景                   | 契约                                                               |
| ---------------------- | ------------------------------------------------------------------ |
| 后台表格、普通内容列表 | `page` / `pageSize`，响应含 `list` / `total` / `page` / `pageSize` |
| 无需总页数的时间序列   | `pageSize` / `cursor`，响应含 `list` / `nextCursor` / `hasMore`    |

- 普通分页默认 `page=1`、`pageSize=20`，最大 `100`。
- AI 消息、AI 图片/视频任务历史、审计日志等滚动加载视图使用 cursor；cursor 对客户端不透明，内部至少包含稳定排序的 `createdAt + id`。

## 5. RBAC 与数据范围

权限码只描述动作，例如：

```text
content:create
content:update
content:publish
user:status:update
role:permission:manage
system:config:manage
```

数据范围作为角色权限关联上的独立字段：

| 值     | 首版                           |
| ------ | ------------------------------ |
| `OWN`  | 已实现，服务层按 owner 过滤    |
| `ALL`  | 已实现，不按 owner 过滤        |
| `TEAM` | 仅保留规范，首版不能配置或授予 |

- Guard 校验动作权限；Service/Repository 对列表、详情、更新、删除执行 `OWN/ALL` 范围。
- 菜单可见性只改善体验，不能替代 Guard。
- JWT 仅含 `sub`、`sid`、`authVersion`、`permissionVersion`；不含完整权限列表。
- Guard 每次从 Redis 会话读取当前版本；角色、权限、用户状态变更时事务内更新版本，并经 outbox 失效权限/菜单缓存。

## 6. Redis 规范

使用 `ioredis`，由项目 `RedisService` / `CacheService` 封装；不得让业务模块自行拼接任意 Key。

```text
{REDIS_KEY_PREFIX}:{domain}:{resource}:{identifier}
```

`REDIS_KEY_PREFIX` 按环境配置，例如 `ph:dev`、`ph:prod`。示例：

| Key 模式                                        | 用途                           | 生命周期                  |
| ----------------------------------------------- | ------------------------------ | ------------------------- |
| `{prefix}:auth:session:{sid}`                   | 会话版本和状态                 | 至会话过期                |
| `{prefix}:auth:permission:{userId}:{pv}`        | 有效权限与范围快照             | 短 TTL + 主动删除         |
| `{prefix}:auth:login-fail:{emailHash}:{ipHash}` | 同账号/IP 登录失败计数         | 15 分钟                   |
| `{prefix}:auth:login-ip:{ipHash}`               | 单 IP 登录请求计数             | 15 分钟                   |
| `{prefix}:auth:captcha:{challengeId}`           | 一次性验证码答案哈希与绑定主体 | 5 分钟或使用后删除        |
| `{prefix}:auth:mfa:{challengeId}`               | 单次短期 MFA challenge         | 至多 5 分钟或使用后删除   |
| `{prefix}:cache:content:list:{hash}`            | 可见内容列表                   | 短 TTL + 内容变更失效     |
| `{prefix}:rate:{route}:{subject}:{window}`      | 固定窗口计数                   | 一个窗口                  |
| `{prefix}:ai:semaphore:{subject}:{modelId}`     | AI 并发占位                    | 请求超时上限              |
| `{prefix}:idempotency:{subject}:{hash}`         | 写请求结果与请求指纹缓存       | 普通 24 小时，高风险 7 天 |

- 通用频率限制使用 `@nestjs/throttler` 的项目内 `ThrottlerStorage` 实现，固定窗口并经 `RedisService` 访问 Redis；不因脚手架阶段未验证兼容性而锁定第三方 storage 包。
- AI 并发用 Redis 原子信号量，完成、失败、超时都必须释放。
- 缓存值使用明确的 JSON schema / 版本，不存储密码、Token 或完整 AI 正文。
- 认证验证码、MFA challenge 和幂等 Redis 缓存只作快速路径；认证/会话、TOTP 因子和幂等最终响应仍以 PostgreSQL 事实记录为准。

## 7. BullMQ 规范

使用 `@nestjs/bullmq + BullMQ`。队列名同样受 Redis 前缀隔离，使用领域动作：

```text
{prefix}:queue:booklet-import
{prefix}:queue:ai-image-generation
{prefix}:queue:ai-video-generation
{prefix}:queue:file-cleanup
{prefix}:queue:database-backup
{prefix}:queue:audit-purge
```

- 可恢复错误最多重试 3 次，指数退避并加随机抖动。
- 任务最终失败后，业务任务表保存状态、错误分类、脱敏摘要；用户可重试自己的任务，管理员可筛选/重放。
- 关键定时任务使用 BullMQ 持久化重复任务；仅轻量进程内维护才使用 `@nestjs/schedule`。
- 任务状态至少使用 `QUEUED`、`PROCESSING`、`SUCCEEDED`、`FAILED`、`CANCELED`；对外以业务资源端点查询，不提供万能队列 API。
- Outbox Dispatcher 和 BullMQ Consumer 生产环境运行于独立 `server-worker` Compose 服务，与 HTTP `server` 使用同一镜像但不同启动命令；开发期可由显式 `worker` 脚本启动，不得让 HTTP 进程隐式吞掉所有后台任务。

## 8. 文件与对象存储

- 生产唯一对象存储为腾讯 COS；本地 Docker Compose 使用 MinIO。
- `StorageProvider` 基于 AWS SDK v3 S3 Client/Presigner，业务模块不依赖厂商 SDK。
- Bucket 默认私有。Nest 校验归属和内容可见性后签发短时下载/预览 URL。
- 浏览器只使用预签名 URL；不可获得永久 COS/MinIO 凭证。
- 小于等于 20 MiB 的文件使用预签名单 PUT；超过 20 MiB 使用 S3 Multipart；单文件上限 500 MiB。
- 上传对象先处于 `UPLOADING/PENDING`，完成时校验大小、扩展名、MIME、魔数和对象元数据后才可变为 `READY`。
- 首版允许类型和每类上限由 File 模块 DTO/配置白名单定义；禁止可执行文件、未处理 HTML 和不安全 SVG。
- 文件软删除后保留 7 天，异步任务确认无引用后物理删除。

## 9. 配置、日志与审计

| 类别                                             | 来源                |
| ------------------------------------------------ | ------------------- |
| 基础设施地址、JWT、COS、SMTP、厂商 API Key       | 环境变量 / 密钥管理 |
| 可运营站点、主题、首页、菜单、模型启用、配额规则 | PostgreSQL 配置表   |

- 环境变量由 `@nestjs/config + Zod` 在启动时严格校验；错误必须阻止启动。
- 后台业务配置提交后通过 outbox 失效对应 Redis 缓存，无需重启。
- 使用 `nestjs-pino + pino`。生产输出结构化 JSON 到 stdout；开发可使用 `pino-pretty`。
- 日志永不记录密码、Access/Refresh Token、Cookie、厂商 Key、完整 AI 提示词/输出或文件二进制。
- 审计记录只存最小必要上下文、关联 ID、错误分类和脱敏 IP Hash。
- Nest 仅在受控 Nginx 反向代理网络内信任 `X-Forwarded-For` / `X-Forwarded-Proto`；Nginx 必须覆盖而非透传客户端提供的同名 Header，防止伪造 IP 绕过限流或污染审计。

审计保留期：

| 类型                   | 保留期 |
| ---------------------- | ------ |
| 安全、权限、会话、额度 | 365 天 |
| 后台运营               | 90 天  |
| 一般业务审计           | 90 天  |

- 磁盘使用率 80% 时告警，并优先清理普通运行日志、到期缓存和已过期审计记录；90% 时仅允许 `super_admin` 在填写原因、二次确认和产生新的清理审计后提前清理普通审计记录。
- 高风险审计记录只有在 90% 紧急容量状态下，才可由 `super_admin` 按明确时间和类别范围提前清理；禁止无差别清空审计表。

## 10. 测试与构建

- `apps/server` 使用独立 Node 专用 tsconfig，不继承 React 的 DOM/JSX/Bundler 配置。
- Nest CLI 使用 SWC 构建；CI 单独运行 `tsc --noEmit`。
- 使用 Vitest、`@nestjs/testing`、Testcontainers。
- 单元测试覆盖纯业务规则；集成测试连接临时 PostgreSQL/Redis；关键鉴权、RBAC、额度、上传/导入链路做 HTTP 级 E2E。
- 日常测试使用 Fake AI/COS Provider；真实厂商仅独立、手工触发的 non-production smoke test。
- 合并质量门槛：格式/静态检查、类型检查、单元测试、关键集成/E2E、生产构建必须通过；覆盖率先观察趋势，不设硬阈值。
