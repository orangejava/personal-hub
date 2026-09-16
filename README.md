# personal-hub

个人知识中台、内容管理平台与 AI 工具箱。

项目提供公开内容阅读、登录后工作区、内容生产、文件与小册管理、AI 工具和后台治理能力，
采用前后端分离的 Monorepo 结构，适合个人知识管理、内容发布和 AI 应用实验。

## 功能概览

- 公开内容：文章、项目、分类、登录可见内容和小册章节；
- 工作区：内容创建、Markdown/富文本编辑、收藏、上传任务、会话与个人设置；
- AI 工具：AI 首页、文本对话、文本生成、图片/视频生成工作流、资产管理和用量记录；
- 管理后台：用户、角色权限、菜单、内容、文件、系统配置和 AI 运营配置；
- 基础设施：PostgreSQL、Redis、腾讯云 COS、SMTP、BullMQ Worker；
- 工程能力：统一 API 契约、Prisma migration、Docker Compose、前后端共享类型。

## 技术栈

| 领域 | 技术 |
| --- | --- |
| Monorepo | pnpm、Turborepo、TypeScript |
| 用户端 | React、Umi、Ant Design、Pro Components |
| 管理端 | React、Umi、Ant Design、Pro Components |
| 服务端 | NestJS、Prisma、PostgreSQL、Redis、BullMQ |
| 对象存储 | AWS SDK v3 S3 协议，开发使用 MinIO，生产使用腾讯云 COS |
| 邮件 | Nodemailer，开发使用 Mailpit，生产可使用 QQ SMTP |
| AI | Fake Provider、OpenAI-compatible Provider（可接 OpenRouter 等服务） |
| 部署 | Docker、Docker Compose、Nginx |

## 项目结构

```text
apps/
├── user-web/       # 用户端 Web
├── admin-web/      # 管理后台 Web
└── server/         # NestJS API 与 Worker
packages/
├── api-client/     # API 请求与契约适配
├── shared-types/   # 前后端共享类型
└── app-origins/    # 应用 Origin 配置
compose.dev.yml     # 本地 PostgreSQL、Redis、MinIO、Mailpit
compose.prod.yml    # 生产 Compose
docs/               # 产品、工程、部署和实现文档
```

## 环境要求

- Node.js 22+
- pnpm 10+
- Docker Engine
- Docker Compose Plugin
- Git

## 本地开发

### 1. 安装依赖和基础服务

```bash
corepack enable
pnpm install
cp apps/server/.env.example apps/server/.env.local
docker compose -f compose.dev.yml up -d
```

### 2. 初始化数据库

```bash
pnpm --filter server prisma:generate
pnpm --filter server prisma:deploy
pnpm --filter server prisma:seed
pnpm --filter server seed:local-users
```

本地示例账号、密码和 Mailpit 使用方式见
[开发凭据说明](docs/engineering/dev-credentials.md)。

### 3. 启动应用

```bash
pnpm dev:server       # Nest API：http://localhost:3001
pnpm dev:user         # 用户端：http://localhost:8000
pnpm dev:admin        # 管理端：http://localhost:8001
```

需要使用前端 mock 数据时：

```bash
pnpm dev:user:mock
pnpm dev:admin:mock
```

本地邮件可以在 Mailpit 查看：

```text
http://localhost:8025
```

## 常用命令

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test:server
pnpm --filter server prisma:generate
pnpm --filter server prisma:deploy
pnpm --filter server prisma:seed
pnpm sync:booklets
```

提交代码前建议执行 `pnpm lint`、`pnpm typecheck`、`pnpm build` 和
`pnpm test:server`。不要提交 `.env.local`、`.env.prod`、API Key、密码或云服务密钥。

## 生产部署

生产部署使用 Docker Compose，应用目录约定为 `/opt/personal-hub/`，服务器上的小册源目录为
`/data/personal-hub/content-local/`，长期对象存储使用腾讯云 COS。

推荐阅读顺序：

1. [生产主线](docs/deploy/go-live-mainline.md)
2. [生产环境变量填空表](docs/deploy/prod-env-worksheet.md)
3. [服务器软件安装与检查](docs/deploy/production-prerequisites.md)
4. [首次上线检查清单](docs/deploy/prod-startup-order.md)
5. [生产服务器操作手册](docs/deploy/production-runbook.md)
6. [生产上线验收手册](docs/deploy/production-verification.md)

## 文档导航

- [项目总纲](docs/overview.md)
- [文档目录](docs/README.md)
- [本地开发命令](docs/engineering/dev-local.md)
- [开发凭据](docs/engineering/dev-credentials.md)
- [部署文档入口](docs/deploy/README.md)
- [服务端 README](apps/server/README.md)

## 参与贡献

欢迎通过 Issue 和 Pull Request 参与改进。提交代码时请：

1. 说明变更目的、影响范围和验证方式；
2. 保持单个提交聚焦；
3. 不提交真实环境变量、账号密码、API Key 或个人数据；
4. 为业务逻辑补充对应的测试或手动验证步骤；
5. 遵循仓库中的工程规范和目录约定。
