# 工程骨架搭建 PRD

> 状态：规划中
> 最后更新：2026-06-09
> 优先级：P0
> 目标：在写具体业务前，先把可长期演进的项目框架搭起来，并把工程约定沉淀到文档和目录级 `AGENT.md`。

---

## 1. 模块目标

工程骨架阶段要完成的不是“业务功能”，而是让项目具备正规开发的底座：

- 根目录具备 Monorepo 能力。
- Web 前台、工作区、运营端在同一个 Next.js 工程内分区管理。
- 后端 API 使用 NestJS，预留模块化扩展能力。
- 共享类型包能承载前后端通用类型、枚举、Zod Schema。
- 本地 PostgreSQL、Redis 能通过 Docker Compose 启动。
- Swagger 能打开，后续接口可持续补文档。
- 工程初始化过程中的关键约定都写入文档。
- 在前端、运营端、后端目录中分别创建 `AGENT.md`，让后续开发不靠记忆。

---

## 2. 工程范围

### 2.1 首版目录结构

```txt
personal-hub/
├── apps/
│   ├── web/
│   │   ├── AGENT.md
│   │   ├── app/
│   │   │   ├── (public)/
│   │   │   ├── (workspace)/
│   │   │   ├── admin/
│   │   │   │   └── AGENT.md
│   │   │   ├── auth/
│   │   │   ├── layout.tsx
│   │   │   └── globals.css
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── store/
│   │   └── types/
│   └── api/
│       ├── AGENT.md
│       ├── src/
│       │   ├── modules/
│       │   ├── common/
│       │   ├── prisma/
│       │   ├── app.module.ts
│       │   └── main.ts
│       └── prisma/
├── packages/
│   └── shared-types/
│       ├── src/
│       └── package.json
├── docs/
├── study/
├── docker-compose.dev.yml
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

### 2.2 前台、工作区、运营端关系

| 区域 | 工程位置 | 路由 | UI 技术 |
|---|---|---|---|
| 公开前台 | `apps/web/app/(public)` | `/`、`/content`、`/projects`、`/about` | Tailwind + shadcn/ui |
| 登录后工作区 | `apps/web/app/(workspace)` | `/workspace/*`、部分 `/ai/*` | Tailwind + shadcn/ui |
| 运营端 / 后台 | `apps/web/app/admin` | `/admin/*` | Ant Design + Pro Components |
| 后端 API | `apps/api` | `/api/*` | NestJS + Fastify |

说明：

- “运营端”就是后台管理台，不单独起新前端工程。
- 后台虽然在 `apps/web` 内，但通过 `apps/web/app/admin/AGENT.md` 写独立规范。
- 前台/工作区和运营端共用登录态、请求封装、共享类型，但 UI 组件边界要清楚。

---

## 3. 初始化步骤

### Step 1：根目录 Monorepo

创建：

- `package.json`
- `pnpm-workspace.yaml`
- `turbo.json`
- `tsconfig.base.json`
- `.editorconfig`
- `.prettierrc`
- `.gitignore`

根目录脚本建议：

```json
{
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "format": "prettier --write ."
  }
}
```

### Step 2：创建 `apps/web`

基础要求：

- Next.js 15。
- App Router。
- TypeScript。
- Tailwind CSS v4。
- ESLint。
- 使用 pnpm。

首批依赖：

| 能力 | 依赖 |
|---|---|
| UI 原语 | shadcn/ui、Radix UI、lucide-react |
| 样式工具 | tailwind-merge、clsx |
| 服务端数据 | Next.js RSC + fetch |
| 客户端请求 | axios、TanStack Query |
| 客户端状态 | Zustand |
| 表单 | react-hook-form、zod、@hookform/resolvers |
| Markdown | shiki、react-markdown、remark-gfm、rehype-sanitize |
| 主题 | next-themes |
| URL 状态 | nuqs |
| Toast | sonner |
| 图表 | Recharts |
| 后台 | antd、@ant-design/pro-components |

### Step 3：创建 `apps/api`

基础要求：

- NestJS。
- Fastify Adapter。
- Swagger。
- Prisma。
- DTO 校验。
- 全局异常处理。
- 统一响应结构。
- CORS。
- Redis 接入预留。

首批依赖：

| 能力 | 依赖 |
|---|---|
| HTTP | `@nestjs/platform-fastify` |
| API 文档 | `@nestjs/swagger` |
| 认证 | `@nestjs/jwt`、`@nestjs/passport`、`passport-jwt` |
| 限流 | `@nestjs/throttler` |
| 定时任务 | `@nestjs/schedule` |
| 事件总线 | `@nestjs/event-emitter` |
| ORM | `prisma`、`@prisma/client` |
| Redis | `ioredis` |
| 校验 | `class-validator`、`class-transformer` |
| 安全 | `bcrypt`、`helmet` |
| 文件 | Fastify multipart 相关能力、`sharp` |

### Step 4：创建 `packages/shared-types`

首批文件建议：

```txt
packages/shared-types/src/
├── index.ts
├── common.ts
├── auth.ts
├── content.ts
├── system.ts
└── pagination.ts
```

首批内容：

- `ApiResponse<T>`
- `PaginationQuery`
- `PaginationResult<T>`
- `ContentType`
- `ContentStatus`
- `ContentVisibility`
- `NavigationPosition`
- `ThemeMode`
- `PermissionCode`

### Step 5：创建 Docker Compose

首版至少：

- PostgreSQL 16。
- Redis 7。

可选但建议预留：

- MinIO。
- Meilisearch。

### Step 6：创建目录级 `AGENT.md`

工程创建后必须落地：

- `apps/web/AGENT.md`
- `apps/web/app/admin/AGENT.md`
- `apps/api/AGENT.md`

模板见：

- [agent-file-templates.md](./agent-file-templates.md)

---

## 4. 后端扩展性约定

用户当前没有完整后端项目经验，所以后端骨架要更重视“以后好加东西”。

### 4.1 模块拆分原则

每个业务域独立模块：

```txt
src/modules/content/
├── content.module.ts
├── content.controller.ts
├── content.service.ts
├── dto/
├── entities/ 或 types/
└── README.md（复杂模块可选）
```

首批模块建议：

| 模块 | 作用 |
|---|---|
| `health` | 健康检查 |
| `auth` | 登录、注册、Token |
| `user` | 用户资料 |
| `system` | 系统配置 |
| `content` | 内容主表 |
| `chapter` | 小册章节 |
| `category` | 分类 |
| `tag` | 标签 |
| `file` | 文件资产 |
| `reading` | 阅读记录 |
| `favorite` | 收藏 |

### 4.2 common 层约定

```txt
src/common/
├── decorators/
├── filters/
├── guards/
├── interceptors/
├── pipes/
├── constants/
├── errors/
└── types/
```

必须提前准备：

- `GlobalExceptionFilter`
- `ResponseTransformInterceptor`
- `ValidationPipe`
- `JwtAuthGuard`
- `PermissionsGuard`
- `CurrentUser` decorator
- 统一错误码枚举

### 4.3 Service 设计原则

- Controller 只做参数接收和响应，不写业务规则。
- Service 负责业务流程。
- Prisma 查询集中在 Service 或未来 Repository，不散落到 Controller。
- 跨模块操作通过依赖注入调用模块 Service，不直接跨目录操作数据库。
- 每个复杂方法写中文 JSDoc，说明用途、参数、返回值、副作用。

### 4.4 配置扩展原则

后端所有可运营配置优先进入 `system_configs`：

- 站点名。
- 主题色。
- 导航位置。
- 默认内容可见性。
- 上传限制。
- 用户初始 Token。
- AI 试用次数。

不建议把这些写死在代码里。

---

## 5. 前端扩展性约定

### 5.1 目录职责

```txt
apps/web/
├── app/                 # 路由
├── components/ui        # shadcn/ui 基础组件
├── components/public    # 公开前台业务组件
├── components/workspace # 工作区业务组件
├── components/admin     # 后台业务组件
├── components/shared    # 跨区域共享组件
├── lib/api              # 请求层
├── lib/config           # 系统配置读取与转换
├── lib/theme            # 主题变量与应用逻辑
├── store                # Zustand
└── hooks                # Hooks
```

### 5.2 主题与导航配置

前台和运营端开发时，不允许把主题色、站点名、导航位置直接写死在页面中。

必须通过：

- 服务端读取公开系统配置。
- 转换为前端 `AppPublicConfig`。
- 注入 CSS Variables。
- 布局组件根据 `navigation.position` 选择顶部、左侧、右侧导航。

详情见：

- [theme-navigation-config-prd.md](../prd/react-first/theme-navigation-config-prd.md)

---

## 6. 首次验收标准

工程骨架完成时，需要满足：

- 根目录 `pnpm install` 成功。
- `pnpm dev` 能同时启动 web 和 api。
- `http://localhost:3000` 能打开 Web 首页占位。
- `http://localhost:3001/api/health` 返回成功。
- `http://localhost:3001/api/docs` 能打开 Swagger。
- Docker Compose 能启动 PostgreSQL 和 Redis。
- `packages/shared-types` 能被 web 和 api 引用。
- 三个目录级 `AGENT.md` 已创建。
- `docs/engineering/project-bootstrap-prd.md` 和 `docs/engineering/engineering-guide.md` 已根据真实命令更新。

---

## 7. 后续文档同步规则

工程搭建过程中如果发生以下变化，必须同步文档：

- 实际命令和 PRD 不一致。
- 依赖版本或框架初始化方式变化。
- 目录结构变化。
- 新增共享包。
- 新增全局配置项。
- 后端 common 能力调整。
- 前端主题、导航、请求封装约定调整。

同步位置：

- `docs/engineering/project-bootstrap-prd.md`
- `docs/engineering/engineering-guide.md`
- `docs/foundation/tech-stack.md`
- 对应目录的 `AGENT.md`
