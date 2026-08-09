# NestJS 依赖目录与版本治理

> 状态：🟢 已确认；创建 `apps/server` 时按本目录验证兼容性并锁定版本
> 最后更新：2026-08-02
> 关联：[后端实现约定](../backend/conventions.md)

---

## 1. 版本治理

- 设计阶段固定“包名、职责、组合边界”，不凭空锁定未来精确版本。
- 创建 `apps/server` 当天，根据 Node 22、Nest 11、Prisma、Express 的实际兼容性选择稳定版本。
- 精确版本以 `apps/server/package.json` 和根 `pnpm-lock.yaml` 为唯一事实来源。
- `apps/server` 使用独立 Node tsconfig；不得继承 React 的 DOM/JSX/Bundler tsconfig。
- Nest CLI 使用 SWC 构建，CI 额外执行 `tsc --noEmit`。

## 2. 首版核心依赖

| 类别       | 首选包                                                       | 用途                                | 禁止/避免                                           |
| ---------- | ------------------------------------------------------------ | ----------------------------------- | --------------------------------------------------- |
| 框架       | `@nestjs/core`、`@nestjs/common`、`@nestjs/platform-express` | Nest 11 + Express                   | 不混入 Fastify 适配器                               |
| 配置       | `@nestjs/config`、`zod`                                      | 环境加载和启动时校验                | 不手写分散 env 判断                                 |
| API        | `@nestjs/swagger`                                            | DTO/Controller 生成 OpenAPI         | 不手工维护第二份 API 类型                           |
| DTO        | `class-validator`、`class-transformer`                       | HTTP DTO 与 ValidationPipe          | 不在 HTTP DTO 混用 Zod                              |
| 数据库     | `prisma`、`@prisma/client`                                   | PostgreSQL Schema、迁移、查询       | 共享/生产禁用 `db push`                             |
| Redis      | `ioredis`                                                    | 缓存、会话、幂等、限流、信号量      | 不把高级操作塞进 CacheModule                        |
| 通用限流   | `@nestjs/throttler` + 项目自定义 `ThrottlerStorage`          | 固定窗口 Guard                      | 不锁定第三方 Redis storage 包；不只依赖 Nginx       |
| 队列       | `@nestjs/bullmq`、`bullmq`                                   | 重试、延迟、重复任务、Worker        | 不用旧 Bull 或自研 Redis 队列                       |
| JWT        | `@nestjs/jwt`                                                | JWT 签发/验签                       | 不为当前 JWT-only 模型引入 Passport                 |
| 密码       | `argon2`                                                     | Argon2id 哈希                       | 不降级保存明文/可逆密码                             |
| Cookie     | `cookie-parser`                                               | Refresh Cookie                      | 不使用前端 localStorage 存 Refresh                  |
| 安全       | `helmet`、`cors`                                              | Header、明确来源 CORS               | 不设 `Access-Control-Allow-Origin: *` + credentials |
| 认证验证码 | `svg-captcha`                                                | 服务端生成一次性 SVG/算术登录验证码 | 不把答案或可复用校验状态交给前端                    |
| TOTP       | `otplib`                                                     | 认证器动态码校验与绑定 URI          | 不保存明文 TOTP 密钥或恢复码                        |
| 日志       | `nestjs-pino`、`pino`、开发期 `pino-pretty`                  | JSON 日志、requestId、脱敏          | Docker 生产不写应用日志文件                         |
| 健康       | `@nestjs/terminus`                                           | liveness/readiness                  | 不只写进程存活 `/health`                            |
| 存储       | `@aws-sdk/client-s3`、`@aws-sdk/s3-request-presigner`        | MinIO/COS S3 协议和预签名 URL       | 不在基础 Provider 并存 MinIO/COS SDK                |
| 邮件       | `nodemailer`                                                 | SMTP MailProvider                   | 不把生产邮件绑定到本地 Mailpit                      |
| 测试       | `vitest`、`@nestjs/testing`、`testcontainers`                | 单元、集成、E2E                     | 不复用开发数据库作为测试库                          |

## 3. 依赖组合约束

### 3.1 HTTP 与 OpenAPI

- Express 与 `@nestjs/swagger` 是当前唯一 HTTP/文档组合。
- Swagger 仅在开发和预发布环境开放；生产默认关闭或置于受保护入口。
- Nest DTO 是 OpenAPI 来源；生成的独立 API Client/类型供 React、Next、Flutter 使用。
- `packages/shared-types` 只保留非 HTTP 的领域常量/类型，`apps/server` 不把它当运行时 DTO 依赖。

### 3.2 Redis

- 所有 Redis 操作由 `RedisService` / `CacheService` 统一封装并使用 `REDIS_KEY_PREFIX`。
- `@nestjs/throttler` 仅负责通用频率 Guard。项目在 `infrastructure/redis` 实现 `ThrottlerStorage`，通过已有 `ioredis` 客户端完成固定窗口计数、TTL 和原子递增；不得为此锁定或隐式依赖第三方 Redis storage 包。
- AI 并发、额度原子预占、幂等缓存使用 `ioredis` 原子操作，不复用通用限流存储语义。
- BullMQ 使用同一 Redis 集群但独立、带前缀的队列命名。
- `svg-captcha` 只生成图像或算术题；答案哈希、账号/IP 绑定、5 分钟 TTL 与单次消费由 Auth 模块经 `RedisService` 管理。
- `otplib` 仅执行 TOTP 算法。因子密钥必须通过应用密钥加密后写 PostgreSQL；恢复码必须单向哈希。

### 3.3 文件

- 基础 S3 Provider 统一通过 AWS SDK v3 访问 MinIO/COS。
- 上传是预签名直传，首版通常不需要服务端 multipart body，因此不要无目的引入重型上传中间件。
- 当确实需要服务端接收小型表单文件时再评估 Multer 与 Nest 文件上传模块。
- `sharp` 仅在头像/封面缩略图真实需求进入实现批次后引入；不提前安装。

### 3.4 AI 与外部服务

- 领域依赖 `AiProvider`、`StorageProvider`、`MailProvider` 接口，具体 SDK 在 infrastructure 实现。
- 日常测试用 Fake Provider；真实 AI/COS 仅独立手工 smoke test。
- 视频使用 `MockVideoProvider`，不引入真实视频厂商 SDK。

### 3.5 队列进程边界

- `outbox` dispatcher 与 BullMQ worker 都使用同一份 `apps/server` 构建产物和基础设施配置，但职责必须可单独启动。
- 生产 Compose 中，HTTP API 运行在 `server` 服务，dispatcher/worker 运行在独立 `server-worker` 服务；不得把 worker 仅作为 API 容器的附属线程。
- worker 处理器必须按业务任务 ID 或幂等键抵御重复投递；最终失败状态和脱敏摘要写入业务任务记录。

## 4. 开发与质量工具

| 工具     | 规则                                                                |
| -------- | ------------------------------------------------------------------- |
| 格式化   | Prettier，与仓库根保持一致                                          |
| Lint     | ESLint + typescript-eslint                                          |
| 测试     | Vitest；不因 Nest 默认模板而改用 Jest                               |
| 类型检查 | `tsc --noEmit` 独立执行                                             |
| 构建     | Nest CLI + SWC                                                      |
| 本地邮件 | Mailpit Compose 容器，不发真实邮件                                  |
| 本地依赖 | Compose 启动 PostgreSQL、Redis、MinIO、Mailpit；Nest 在宿主机热更新 |

合并门槛：格式/静态检查、类型检查、单元测试、关键集成/E2E、生产构建必须通过。覆盖率只观察趋势，不设硬阈值。

## 5. 阶段化依赖

以下不随脚手架提前引入：

| 依赖/能力            | 引入条件                                 |
| -------------------- | ---------------------------------------- |
| `multer`             | 需要 Nest 代理接收小型 multipart 文件    |
| `sharp`              | 实现头像/封面裁剪和缩略图                |
| 全文搜索引擎         | PostgreSQL FTS 确认不足后                |
| 邮件模板引擎         | 纯文本/简单 HTML 模板无法满足运营需求后  |
| 第三方 CAPTCHA SDK   | 自建验证码加分层限流不足以应对实际滥用后 |
| COS 专有 SDK         | S3 兼容接口无法满足明确 COS 特性后       |
| 支付/订阅 SDK        | 启动真实付费订阅后                       |
