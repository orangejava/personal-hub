# 工程开发指南

> 面向开发者的环境搭建、目录规范、命名约定、核心决策规则。开始编码前必读。
>
> **阅读提示**：当前可运行应用是 `apps/react-web`。文中 Next.js / NestJS / Docker 内容属于长期目标，不能作为当前环境的启动步骤。

---

## 环境前置要求

| 工具                    | 版本要求 | 说明                                     |
| ----------------------- | -------- | ---------------------------------------- |
| Node.js                 | ≥ 22 LTS | 使用 `.nvmrc` 锁定，建议 `nvm use`       |
| pnpm                    | ≥ 9      | 包管理器，`npm i -g pnpm`                |
| Docker + Docker Compose | 可选     | 进入 NestJS 阶段后用于 PostgreSQL、Redis |
| Git                     | 任意     | —                                        |

---

## 当前本地启动（React-first）

```bash
# 1. 安装依赖并生成本地小册 mock（没有本地小册时会生成空数据）
git clone <repo-url>
cd personal-hub
nvm use
pnpm install

# 2. 启动 Umi mock 应用
pnpm dev:react
```

启动后：

- React Web（公开前台、工作区、后台和 AI mock）：http://localhost:8000

当前阶段不需要 `apps/web`、`apps/api`、数据库、Docker 或环境变量文件；这些目录尚未创建。

---

## 长期全栈启动参考（尚未实施）

以下内容描述未来 `apps/next-web` + `apps/api` 落地后的目标流程，不可直接在当前仓库执行。

---

## 环境变量说明

### apps/api/.env.example

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
CORS_ORIGIN="http://localhost:3000"

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

> 生产环境变量通过服务器 `/etc/personal-hub/.env` 注入，不提交到 Git。

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

### apps/api（NestJS，未来）

```
apps/api/
├── src/
│   ├── main.ts                 ← 应用入口，Fastify 适配器配置
│   ├── app.module.ts           ← 根模块
│   ├── modules/                ← 业务模块（每模块独立目录）
│   │   └── auth/
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
│   └── prisma/
│       ├── prisma.module.ts
│       └── prisma.service.ts
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
└── .env
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
("use client");
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
| API 路径             | `kebab-case`                    | `/api/ai-sessions`          |
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
- `accessToken` 过期（401）→ 自动调用 `/auth/refresh` 换新 token → 重试原请求
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
    "code": 40001,
    "message": "用户名或密码错误",
    "timestamp": "2025-01-01T00:00:00Z"
  }
  ```
- 业务错误抛 `BusinessException(code, message)`
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

## 当前常用命令

```bash
pnpm dev:react                         # 启动当前 React-first 应用
pnpm build:react                       # 构建当前应用
pnpm --filter react-web lint           # Biome + TypeScript 检查
pnpm --filter react-web test           # Vitest 单元测试
pnpm --filter react-web sync:booklets  # 同步本地小册 mock
```

---

## Prisma 常用命令（未来 apps/api 创建后启用）

```bash
cd apps/api

# 创建迁移（开发时，修改 schema 后执行）
pnpm prisma migrate dev --name add_xxx_field

# 应用迁移（生产）
pnpm prisma migrate deploy

# 重置数据库（开发）
pnpm prisma migrate reset

# 打开 Prisma Studio（图形化查看数据）
pnpm prisma studio

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
