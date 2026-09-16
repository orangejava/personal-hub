# 工程开发指南

> 面向开发者的环境搭建、目录规范、命名约定、核心决策规则。开始编码前必读。
>
> **阅读提示**：当前可运行应用是用户端 `apps/user-web`（`:8000`）、管理端 `apps/admin-web`（`:8001`）与 `apps/server`。Next.js 仍是长期目标；Nest 本地依赖通过 Compose 启动，服务在宿主机热更新。

---

## 环境前置要求

| 工具                    | 版本要求 | 说明                                     |
| ----------------------- | -------- | ---------------------------------------- |
| Node.js                 | ≥ 22 LTS | 使用 `.nvmrc` 锁定，建议 `nvm use`       |
| pnpm                    | ≥ 9      | 包管理器，`npm i -g pnpm`                |
| Docker + Docker Compose | Nest 开发必需 | 运行 PostgreSQL、Redis、MinIO 与 Mailpit；仅 React mock 开发可不安装 |
| Git                     | 任意     | —                                        |

---

## 当前本地启动

日常默认打 Nest，不要用 mock 当数据源。账号与端口见 [dev-credentials.md](./dev-credentials.md)。

```bash
git clone <repo-url>
cd personal-hub
nvm use
pnpm install

# 依赖 + 迁移 + 本地账号 / Fake AI 目录
docker compose -f compose.dev.yml up -d
# 复制 apps/server/.env.example 为 .env.local（若还没有）
pnpm --filter server prisma:deploy
pnpm --filter server seed:local-users

pnpm dev:server
pnpm dev:user            # MOCK=none，http://localhost:8000
pnpm dev:admin           # MOCK=none，http://localhost:8001
pnpm dev:worker          # 小册 ZIP / AI 图视频才需要
```

存量小册：`pnpm booklet:import-local -- --source <目录> --execute`，不要再靠 `sync:booklets` + mock。仅阶段 A 或排障才用 `pnpm dev:user:mock` / `dev:admin:mock`。

`apps/next-web` 仍是长期目标，当前不需要。

---

## Nest 阶段 0 本地开发入口

> Nest M0–M6 已落地（脚手架、Auth、系统配置、内容、文件/小册、AI）。实现入口见 [apps/server/docs/README.md](../../apps/server/docs/README.md)。当前产品主线是上线部署，见 [../deploy/go-live-mainline.md](../deploy/go-live-mainline.md)。

- 复制 `apps/server/.env.example` 为 `apps/server/.env.local` 后，执行 `docker compose -f compose.dev.yml up -d`、`pnpm --filter server prisma:generate`、`pnpm --filter server prisma:deploy` 与 `pnpm dev:server`。
- 目录固定为 `apps/server`，本地使用 `pnpm --filter server dev` 在宿主机热更新。
- `compose.dev.yml` 仅运行 PostgreSQL、Redis、MinIO、MinIO init job、Mailpit；Testcontainers 不复用开发卷。真实基础设施测试、readiness 故障自动化和 server CI 已在阶段 0 收口。
- 全局 API 前缀为 `/api/v1`；旧 React mock `/api/*` 仅作迁移线索。
- 认证是 JWT-only，密码使用 Argon2id；Redis 统一经 `ioredis` 封装，异步任务使用 Outbox + BullMQ。
- MinIO 仅是本地 S3 兼容模拟；生产业务对象存储唯一使用腾讯 COS，统一由 AWS SDK v3 Provider 访问。

### 查看 Docker 里的 Postgres / Redis

Compose 已经把端口映射到本机，**不要再单独安装一套 PostgreSQL / Redis 服务**（会和 5432、6379 抢端口）。只需用客户端连上去。

| 服务 | 地址 | 账号 / 密码 |
| --- | --- | --- |
| PostgreSQL | `localhost:5432`，库名 `personal_hub` | `personal_hub` / `personal_hub_dev_password` |
| Redis | `localhost:6379` | 密码 `personal_hub_redis_dev_password` |
| Mailpit | 浏览器 `http://localhost:8025` | 无 |

命令行：

```bash
# 容器内 psql（不用本机安装）
docker compose -f compose.dev.yml exec postgres psql -U personal_hub -d personal_hub

# 本机已装 psql 时
psql "postgresql://personal_hub:personal_hub_dev_password@localhost:5432/personal_hub"

# Redis
docker compose -f compose.dev.yml exec redis redis-cli -a personal_hub_redis_dev_password
```

图形工具新建连接即可，**不要再启动本机 PostgreSQL / Redis 服务**。权威账号见 `apps/server/.env.example`。

#### pgAdmin

1. 先确认容器在跑：`docker compose -f compose.dev.yml ps`，`postgres` 应为 healthy。
2. 打开 pgAdmin → 左侧 **Servers** 右键 → **Register** → **Server**。
3. **General**：Name 填 `personal-hub-dev`（仅显示名，随便起）。
4. **Connection** 按下面填：

| 字段 | 值 |
| --- | --- |
| Host name/address | `127.0.0.1`（不要用容器名；Docker 已映射到本机） |
| Port | `5432` |
| Maintenance database | `personal_hub` |
| Username | `personal_hub` |
| Password | `personal_hub_dev_password` |
| Save password | 可勾选（仅本地） |

5. 保存后展开该服务器 → **Databases** → `personal_hub` → **Schemas** → **public** → **Tables**。用户表看 `users`（邮箱列是 `email_normalized`）。

连不上时：本机若另装过 Postgres 占用了 `5432`，先停掉本机服务，或看 `docker compose ps` 的端口映射。

#### Redis Insight

1. 确认 `redis` 容器 healthy。
2. 打开 Redis Insight → **Add Redis database**。
3. 按下面填：

| 字段 | 值 |
| --- | --- |
| Host | `127.0.0.1` |
| Port | `6379` |
| Username | `default`（Redis 7 用 requirepass 时走默认用户；留空若连不上再填这个） |
| Password | `personal_hub_redis_dev_password` |

4. 连上后 key 带前缀 `ph:dev:`（例如会话 `ph:dev:auth:session:...`）。用浏览器过滤 `ph:dev:` 即可。

---

## Nest 环境变量原则

`apps/server/.env.example` 只列变量名、格式、必填性与安全说明，不能放真实密钥、服务器地址、镜像仓库或默认生产账号。`@nestjs/config + Zod` 必须在启动时校验环境变量，缺失或格式错误即阻止启动。基础设施地址、JWT、COS、SMTP 与厂商 Key 由本地私有环境文件或生产密钥管理注入；可运营配置保存在 PostgreSQL 配置表。

### 已降级的环境变量样例

以下 `apps/api`、本地磁盘上传与演示密钥样例只用于解释早期设想，**禁止复制到新工程或生产环境**：

```env
# ── 数据库 ──────────────────────────────────────
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/personal_hub"

# ── Redis ────────────────────────────────────────
REDIS_URL="redis://localhost:6379"

# ── JWT ─────────────────────────────────────────
JWT_SECRET="change-me-in-production-access-token-secret"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="change-me-in-production-refresh-token-secret"
JWT_REFRESH_EXPIRES_IN="7d"

# ── AI 厂商（至少填一个）────────────────────────
ALIYUN_BAILIAN_API_KEY=""
ALIYUN_BAILIAN_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
OPENAI_API_KEY=""
OPENAI_BASE_URL="https://api.openai.com/v1"

# ── 文件存储 ─────────────────────────────────────
# 本地存储（首版）
FILE_UPLOAD_DIR="/data/uploads"
FILE_MAX_SIZE_MB=50
# MinIO（后续启用）
# MINIO_ENDPOINT=""
# MINIO_ACCESS_KEY=""
# MINIO_SECRET_KEY=""
# MINIO_BUCKET="personal-hub"

# ── 邮件（可选，用于验证码/密码重置）──────────────
SMTP_HOST=""
SMTP_PORT=465
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="noreply@yourdomain.com"

# ── 服务配置 ─────────────────────────────────────
PORT=3001
NODE_ENV=development
CORS_ORIGIN="http://localhost:8000,http://localhost:8001"
PUBLIC_APP_ORIGIN="http://localhost:8000"

# ── 后台管理默认账号（seed 用，生产另行生成）────
# React mock 环境见 docs/engineering/dev-credentials.md
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="yyQhItHlRe8Q9suV"
```

### apps/next-web/.env.example（未来）

```env
# 后端 API 地址（服务端 fetch 与客户端 axios 共用）
NEXT_PUBLIC_API_URL="http://localhost:3001"

# 站点域名（用于 SEO、Open Graph）
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
NEXT_PUBLIC_SITE_NAME="Personal Hub"
```

> 生产环境变量通过受控密钥文件或密钥管理注入，不提交到 Git；具体服务器路径在实际部署运维文档确认前不预设。

---

## 目录结构规范

### apps/next-web（Next.js，未来）

```
apps/next-web/
├── app/                        ← App Router 路由根目录
│   ├── (public)/               ← 公开前台路由组（不含路径段）
│   │   ├── page.tsx            ← 首页 /
│   │   ├── content/            ← /content 内容中心
│   │   │   ├── page.tsx
│   │   │   └── [slug]/page.tsx ← /content/:slug 阅读页
│   │   ├── ai/                 ← /ai AI 工具中心入口
│   │   ├── projects/           ← /projects
│   │   └── about/              ← /about
│   ├── (workspace)/            ← 工作区路由组（登录后）
│   │   ├── layout.tsx          ← 工作区 Layout（含侧边栏鉴权）
│   │   ├── workspace/
│   │   │   ├── page.tsx        ← 仪表盘
│   │   │   ├── content/        ← 我的内容
│   │   │   ├── favorites/      ← 收藏
│   │   │   ├── ai-history/     ← AI 历史
│   │   │   ├── usage/          ← 用量统计
│   │   │   └── profile/        ← 个人资料
│   │   └── ai/                 ← AI 工具页（chat/text/image）
│   ├── admin/                  ← 后台管理（/admin 前缀保留路由段）
│   │   ├── layout.tsx          ← Ant Design 后台 Layout
│   │   └── ...
│   ├── auth/                   ← 登录/注册/找回密码
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── layout.tsx              ← 全局 Root Layout
│   └── globals.css
├── components/
│   ├── ui/                     ← shadcn/ui 生成组件（勿手动修改）
│   ├── public/                 ← 公开前台专属组件
│   ├── workspace/              ← 工作区专属组件
│   ├── admin/                  ← 后台专属组件
│   └── shared/                 ← 跨区域通用组件（Header、Footer 等）
├── hooks/                      ← 自定义 React Hooks
├── lib/
│   ├── api/                    ← axios 实例 + 各模块 API 函数
│   ├── utils.ts                ← cn()、格式化工具
│   └── auth.ts                 ← 认证辅助（token 读取等）
├── store/                      ← Zustand stores
│   ├── auth.store.ts           ← 用户认证状态
│   └── ai.store.ts             ← AI 会话状态
├── types/                      ← 前端本地 TypeScript 类型
└── public/                     ← 静态资源
```

### apps/server（NestJS，阶段 0 已落地）

```
apps/server/
├── src/
│   ├── main.ts                 ← 创建应用、读取配置并监听端口
│   ├── bootstrap.ts            ← Express middleware、全局管道、Swagger 与 HTTP 横切配置
│   ├── app.module.ts           ← 根模块
│   ├── infrastructure/         ← Prisma、Redis、Storage、Queue、日志实现
│   ├── modules/                ← 业务模块（每模块独立目录）
│   │   └── auth/               ← Auth 阶段按需新增的领域模块示例
│   │       ├── auth.module.ts
│   │       ├── auth.controller.ts
│   │       ├── auth.service.ts
│   │       └── dto/
│   │           ├── login.dto.ts
│   │           └── register.dto.ts
│   ├── common/
│   │   ├── guards/
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── interceptors/
│   │   └── pipes/
│   └── common/
│       ├── guards/
│       └── filters/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
└── .env.local                  ← 本机私有环境文件，不提交
```

---

## Server Component vs Client Component 决策规则

> Next.js App Router 默认所有组件为 Server Component（RSC），只有需要时才声明 `'use client'`。

| 条件     | 用 Server Component                | 用 Client Component         |
| -------- | ---------------------------------- | --------------------------- |
| 数据来源 | 直接 `fetch()` 或 Prisma           | 需要 TanStack Query / axios |
| 交互     | 无用户交互                         | 有 `onClick`、表单、动画    |
| 状态     | 无 `useState` / `useEffect`        | 有状态或副作用              |
| SEO      | 重要（首页、阅读页、关于我）       | 不重要（工作区、AI 工具）   |
| 第三方库 | 支持 SSR（无 `window`/`document`） | 依赖浏览器 API              |

**实际决策流程**：

1. 默认写 Server Component（不加 `'use client'`）
2. 遇到报错 `useState is not a function` 或需要浏览器 API → 加 `'use client'`
3. 将可交互部分单独抽成 Client Component，外层保持 Server Component 传入数据

**示例**：

```tsx
// app/(public)/content/[slug]/page.tsx — Server Component
// 服务端 fetch，SEO 友好
async function ContentPage({ params }: { params: { slug: string } }) {
  const content = await fetchContent(params.slug); // 直接调用后端
  return <ContentDetail content={content} />; // 传给 Client Component
}

// components/public/ContentDetail.tsx — Client Component
('use client');
// 处理收藏、目录跳转等交互
```

---

## 命名规范

### 文件命名

| 类型                   | 规范                               | 示例              |
| ---------------------- | ---------------------------------- | ----------------- |
| React 组件文件         | `PascalCase.tsx`                   | `ContentCard.tsx` |
| 页面文件（App Router） | `page.tsx / layout.tsx`            | 固定名称          |
| Hook 文件              | `use-xxx.ts` (kebab-case)          | `use-auth.ts`     |
| Store 文件             | `xxx.store.ts`                     | `auth.store.ts`   |
| API 函数文件           | `xxx.api.ts`                       | `content.api.ts`  |
| 工具函数文件           | `xxx.utils.ts`                     | `date.utils.ts`   |
| DTO 文件（NestJS）     | `xxx.dto.ts`                       | `login.dto.ts`    |
| NestJS 模块文件        | `xxx.module/controller/service.ts` | 按约定命名        |

### 代码命名

| 类型                 | 规范                            | 示例                        |
| -------------------- | ------------------------------- | --------------------------- |
| React 组件           | `PascalCase`                    | `ContentCard`               |
| 函数 / 方法 / 变量   | `camelCase`                     | `fetchContent`, `isLoading` |
| 常量                 | `UPPER_SNAKE_CASE`              | `MAX_FILE_SIZE`             |
| TypeScript 类型/接口 | `PascalCase`                    | `ContentDto`, `UserRole`    |
| CSS 类名（Tailwind） | 直接使用工具类，组合放 `cn()`   | —                           |
| API 路径             | `kebab-case`                    | `/api/v1/app/ai-sessions`   |
| 数据库字段           | `snake_case`（Prisma 自动映射） | `created_at` → `createdAt`  |

---

## 关键开发规范

### API 调用规范（前端）

- **公开页面（Server Component）**：直接用 `fetch()` 调用后端，加 `cache: 'no-store'` 或 `next: { revalidate: 60 }`
- **工作区 / AI 工具（Client Component）**：统一通过 `lib/api/` 下的函数调用，底层用 axios 实例
- **axios 实例**：在 `lib/api/client.ts` 中统一配置 `baseURL`、request 拦截器（加 Token）、response 拦截器（401 → 刷新 Token 或跳登录）
- **禁止**：前端直接调用 AI 厂商 API，所有 AI 请求必须经过后端代理

### Token 管理规范

- `accessToken`：存内存（Zustand store），不写 localStorage / cookie
- `refreshToken`：由后端写入 `HttpOnly Cookie`，前端不直接读取
- `accessToken` 过期（401）→ 自动调用 `/api/v1/auth/refresh` 换新 token → 重试原请求
- 刷新失败 → 清空 Zustand 认证状态 → 跳转 `/auth/login`

### SSE 规范（AI 对话流式输出）

- 前端使用 `EventSource` 或 `fetch` + `ReadableStream` 接收 SSE
- 后端 NestJS 使用 `@Sse()` 装饰器配合 `Observable<MessageEvent>` 返回流
- SSE 数据格式：
  ```
  data: {"type":"chunk","content":"生成的文字片段"}\n\n
  data: {"type":"done","usage":{"prompt_tokens":100,"completion_tokens":50}}\n\n
  ```
- 错误时发送 `data: {"type":"error","message":"..."}` 后关闭连接

### 错误处理规范（后端）

- 统一由 `GlobalExceptionFilter` 捕获，返回格式：
  ```json
  {
    "error": { "code": "AUTH_INVALID_CREDENTIALS", "message": "用户名或密码错误", "details": [] },
    "requestId": "uuid"
  }
  ```
- 业务错误使用全大写领域错误码；`requestId` 同时写入响应、日志、审计、outbox 与队列上下文
- 参数校验错误 → `class-validator` 自动返回 400

### 权限校验规范（后端）

Guard 执行顺序：`JwtAuthGuard` → `RolesGuard` → `PermissionsGuard`

```typescript
// Controller 示例
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('content:publish')
@Post(':id/publish')
async publishContent(@Param('id') id: string) { ... }
```

---

本地开发命令速查见 [dev-local.md](./dev-local.md)。生产服务器操作见 [../deploy/production-runbook.md](../deploy/production-runbook.md)，首次上线清单见 [../deploy/prod-startup-order.md](../deploy/prod-startup-order.md)。

## 当前常用命令

```bash
pnpm dev:user                          # 用户端，默认无 mock，打 Nest
pnpm dev:admin                         # 管理端，默认无 mock
pnpm dev:server                        # Nest API :3001
pnpm dev:worker                        # Outbox / BullMQ
pnpm booklet:import-local              # 存量小册导入 Nest
pnpm --filter server seed:local-users  # 本地账号 + Fake AI 目录
pnpm build:user                        # 构建用户端（不含 mock）
pnpm --filter user-web lint            # Biome + TypeScript 检查
pnpm --filter user-web test            # Vitest 单元测试
# 仅排障 / 阶段 A：
pnpm dev:user:mock
pnpm --filter user-web sync:booklets   # 只生成 mock 小册数据，不是 Nest 导入
```

---

## Prisma 常用命令（当前 apps/server）

```bash
# 创建迁移（开发时，修改 schema 后执行）
pnpm --filter server prisma:migrate -- --name add_xxx_field

# 应用迁移（生产）
pnpm --filter server prisma:deploy

# 重置数据库（开发）
pnpm --filter server exec dotenv -e .env.local -- prisma migrate reset

# 打开 Prisma Studio（图形化查看数据）
pnpm --filter server prisma:studio

# 重新生成 Prisma Client（修改 schema 后）
pnpm prisma generate

# 运行 Seed 数据
pnpm prisma db seed
```

---

## shadcn/ui 使用规范（未来 Next.js 阶段）

```bash
# 在 apps/next-web 目录下添加组件
cd apps/next-web
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add dialog
```

- 生成的组件在 `components/ui/`，**不要手动修改**，需要定制时在外部包装
- 主题配置在 `globals.css` 中的 CSS 变量，不要在 `tailwind.config` 里硬编码颜色值
- 深色模式通过 `next-themes` 切换，`globals.css` 提供 `.dark` 变量集

---

## Git 分支规范

| 分支          | 说明                                 |
| ------------- | ------------------------------------ |
| `main`        | 生产分支，保护分支，只能通过 PR 合入 |
| `develop`     | 开发主分支                           |
| `feature/xxx` | 功能分支，从 develop 切出            |
| `fix/xxx`     | Bug 修复分支                         |
| `chore/xxx`   | 配置、依赖、文档等非业务变更         |

提交信息格式：`type(scope): message`

示例：

- `feat(auth): add email verification`
- `fix(content): fix slug duplicate error`
- `chore(deps): update shadcn/ui components`
