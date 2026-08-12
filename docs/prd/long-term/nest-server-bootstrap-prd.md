# Nest Server 脚手架 PRD

> 状态：✅ 已完成；后续维护与验收仍以本文为准
> 最后更新：2026-08-08
> 优先级：P0
> 关联：[实现记录](../../implementation/foundation/nest-server-bootstrap.md)、[后端实现约定](../../backend/conventions.md)、[Canonical API](../../backend/canonical-api.md)、[Canonical 数据模型](../../backend/canonical-data-model.md)、[依赖目录](../../engineering/nest-dependency-catalog.md)、[Compose 策略](../../deploy/nest-compose-strategy.md)

---

## 1. 目标与非目标

本阶段只创建可长期演进的 NestJS 运行底座，让后续 Auth、Content、File、AI 等领域模块有一致的目录、配置、数据库、缓存、日志、健康检查和测试入口。

完成后必须具备：

- `apps/server` 可独立开发、类型检查、构建和启动。
- 本地 Compose 可启动 PostgreSQL、Redis、MinIO、Mailpit；Nest 运行在宿主机热更新。
- Prisma 可连接本地 PostgreSQL，并通过 migration 管理 Schema。
- `/api/v1`、统一异常响应、Swagger、liveness/readiness、结构化日志和 Redis 连接均可验证。

本阶段明确不包含：

- Auth、RBAC、用户、内容、文件、小册、AI 等业务端点和真实业务 Schema。
- 真实 AI 厂商、腾讯 COS 凭证、生产域名、Nginx 配置和生产发布。
- React 服务层切换、Next.js 工程、Flutter、数据库 seed 的完整业务权限目录。

## 2. 权威边界

| 事项                                        | 唯一来源                                                    |
| ------------------------------------------- | ----------------------------------------------------------- |
| HTTP 前缀、响应、错误、分页与端点分区       | [Canonical API](../../backend/canonical-api.md)             |
| 表命名、UUID、Prisma 映射和数据约束         | [Canonical 数据模型](../../backend/canonical-data-model.md) |
| Nest 分层、Redis/队列、日志、测试和安全规则 | [后端实现约定](../../backend/conventions.md)                |
| 包选型与不可混用约束                        | [依赖目录](../../engineering/nest-dependency-catalog.md)    |
| 本地/生产 Compose、存储和发布原则           | [Compose 策略](../../deploy/nest-compose-strategy.md)       |

不得参考已降级的 `apps/api`、`/api/*`、`200 + code`、bcrypt、Passport 或生产 MinIO 方案创建本工程。

## 3. 目标目录

```text
apps/server/
├── src/
│   ├── common/                 # Filter、Guard、Interceptor、Decorator、共享类型
│   ├── config/                 # Zod 环境变量校验
│   ├── infrastructure/         # Prisma、Redis、日志等基础设施实现
│   ├── modules/
│   │   └── health/             # 首个可验证模块
│   ├── app.module.ts
│   └── main.ts
├── prisma/
│   └── schema.prisma
├── test/
├── .env.example
├── package.json
├── tsconfig.json
├── nest-cli.json
└── AGENT.md
```

- 后端应用固定为 `apps/server`，不得新建 `apps/api`。
- Prisma 固定在 `apps/server/prisma`；首版不建立 `packages/database`。
- `packages/shared-types` 仅保留跨端领域常量和类型；HTTP DTO、OpenAPI 和运行时校验由 `apps/server` 负责。
- 复杂业务模块后续按 `controller → service → repository → provider` 的领域垂直结构扩展，不能在脚手架阶段预建空业务模块。

## 4. 本地运行架构

```mermaid
flowchart LR
    React["apps/react-web Mock"] -.当前不对接.-> Server["apps/server Host Dev"]
    Server --> Postgres["PostgreSQL Compose"]
    Server --> Redis["Redis Compose"]
    Server --> Minio["MinIO Compose"]
    Server --> Mailpit["Mailpit Compose"]
```

| 文件/服务         | 规则                                                             |
| ----------------- | ---------------------------------------------------------------- |
| `compose.dev.yml` | 只编排 PostgreSQL 16、Redis 7、MinIO、MinIO init job、Mailpit    |
| `apps/server`     | 宿主机通过 `pnpm --filter server dev` 热更新，不放入本地 Compose |
| `.env.local`      | 本地机器私有，不提交；使用映射后的 `localhost` 端口              |
| `.env.example`    | 只列变量名、格式、是否必填和安全说明，不含真实密钥               |
| 自动化测试        | 使用 Testcontainers 临时 PostgreSQL/Redis，禁止复用开发卷        |

本地端口和环境变量约定：

- Nest 默认监听 `3001`，开发 CORS 只允许 `http://localhost:8000`；生产环境不注册业务 CORS。
- PostgreSQL、Redis、MinIO API/Console、Mailpit SMTP/UI 分别映射到 `5432`、`6379`、`9000/9001`、`1025/8025`。
- `DATABASE_URL`、`REDIS_URL`、`REDIS_KEY_PREFIX`、`JWT_ACCESS_SECRET`、`JWT_REFRESH_SECRET`、本地 MinIO 连接变量为启动必填项。JWT 与存储变量在阶段 0 仅校验配置，尚不启用领域能力。

生产环境将由单独实施计划落实：Nginx、Nest、PostgreSQL、Redis 使用 Compose，COS 是唯一业务对象存储；本阶段不创建生产 Compose。

## 5. 首批基础能力与验收

| 能力       | 本阶段要求                                                 | 验收方式                             |
| ---------- | ---------------------------------------------------------- | ------------------------------------ |
| HTTP       | Express、全局 `/api/v1` 前缀、ValidationPipe、统一异常格式 | 阶段 0 验证 health/404 信封；非法 DTO 在 Auth 首个写接口补验收 |
| OpenAPI    | `@nestjs/swagger` 从 DTO/Controller 生成                   | 开发环境可打开 Swagger               |
| 配置       | `@nestjs/config + Zod`；缺失必填变量阻止启动               | 移除必填变量后启动失败               |
| PostgreSQL | PrismaClient 生命周期管理；空 Schema 可迁移                | 本地 migration 成功                  |
| Redis      | `ioredis` 统一服务与启动连接检查                           | readiness 能识别 Redis 不可用        |
| 健康检查   | Terminus liveness/readiness                                | DB、Redis 状态进入 readiness         |
| 日志       | `nestjs-pino` JSON 与 requestId                            | 日志不输出敏感环境变量               |
| 质量       | ESLint、Prettier、Vitest、`tsc --noEmit`、SWC 构建         | 根脚本或 server 脚本全部通过         |

首版健康路由仅用于基础设施验证；业务健康和权限端点在领域模块开发时补充。

### 5.1 固定验证路径与首迁边界

| 路由 | 规则 |
| --- | --- |
| `GET /api/v1/health/live` | 仅确认 HTTP 进程可运行，成功使用 `{ data, requestId }`。 |
| `GET /api/v1/health/ready` | 检查 PostgreSQL 与 Redis；任一不可用时返回 `503` 和 `{ error, requestId }`。 |
| `GET /api/docs` | 仅开发/预发布环境开放的 Swagger UI，不受 `/api/v1` 全局 API 前缀约束。 |

- 每次请求都必须由服务端生成 UUID `requestId`，同时写入响应体、`X-Request-Id` 和结构化日志。
- 首个 Prisma migration 仅创建 `pgcrypto` 扩展，作为后续 UUID 相关数据库能力的初始化前置条件；Schema 不声明任何业务模型。Auth 阶段才创建用户、角色等首批领域表。
- 阶段 0 不提供 DTO 写端点；全局 `ValidationPipe` 已配置，非法 DTO 的 HTTP 验收在 Auth 阶段的首个写接口连同 DTO 一起补充。
- 本阶段具备 mock Prisma/Redis HTTP 集成测试，以及使用 Testcontainers 临时 PostgreSQL/Redis 的真实 readiness 集成测试；测试会执行正式 migration，且不复用开发卷。Redis 故障时的 readiness `503` 与 server CI 同样已自动化验证。

## 6. 依赖和脚本

精确版本在创建当天根据 Node 22、Nest 11 和 Express 实际兼容性由包管理器锁定，包名与职责必须遵守依赖目录。

`apps/server/package.json` 至少提供：

```text
dev        # Nest 开发热更新
build      # Nest CLI + SWC 构建
start      # 启动构建产物
lint       # ESLint
typecheck  # tsc --noEmit
test       # Vitest
prisma:*   # generate / migrate / studio 等明确子命令
```

根 `package.json` 在脚手架完成时补充 `dev:server`、`build:server`、`lint:server`、`typecheck:server`、`test:server`；原 React 脚本保持不变。

## 7. 实施顺序

1. 创建 `apps/server`、独立 TypeScript/Nest 配置和依赖清单。
2. 创建 `compose.dev.yml`、环境模板及本地基础设施连接配置。
3. 接入 Config、Pino、Prisma、Redis、Terminus、全局异常和 Swagger。
4. 初始化 Prisma Schema 和首个仅含 `pgcrypto` 扩展的 migration；不创建业务模型或业务领域表。
5. 补齐脚本、README/AGENT、单元与基础 HTTP 验收。
6. 验收后才进入 Auth → System/Menu → Content → File/Booklet → AI → Admin 的领域实施顺序。

## 8. 完成标准

- `docker compose -f compose.dev.yml up -d` 成功启动四类本地依赖。
- `pnpm --filter server dev` 能启动，且 `/api/v1/health/live`、`/api/v1/health/ready` 与开发 Swagger `/api/docs` 可访问。
- Prisma migration、Redis readiness、格式检查、类型检查、测试和生产构建均通过。
- 本地环境不需要真实 COS、SMTP、AI Key；Fake Provider 与 Mailpit 不泄露到生产配置。
- 工程目录、脚本、环境变量、Compose 文件与本 PRD不一致时，必须先更新本 PRD及关联实施文档，再继续业务开发。
