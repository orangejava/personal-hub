# 总执行手册（React-first 历史路线）

> 状态：🟡 React-first 阶段记录可参考；不得作为 NestJS 脚手架或领域开发的实现依据
> 最后更新：2026-08-02
> 当前 Nest 入口：[Nest Server 脚手架 PRD](../prd/long-term/nest-server-bootstrap-prd.md) → [后端需求总览](../prd/long-term/nest-backend-requirements.md)
> 后端权威契约：[Canonical API](../backend/canonical-api.md)、[Canonical 数据模型](../backend/canonical-data-model.md)、[实现约定](../backend/conventions.md)、[Compose 策略](../deploy/nest-compose-strategy.md)

> **历史提示**：本文后续 `apps/web`、`apps/api`、`/api/*`、旧 API 与数据模型草案 与“认证在 Phase 6”的描述仅代表早期路线，禁止用于当前 Nest 实现。当前 React 应用是 `apps/user-web`，后端固定为 `apps/server`，认证是脚手架后的首个领域模块。

---

## 1. 这份文档解决什么问题

这份文档重点解决四件事：

1. 当前项目应该按什么顺序推进，避免一上来就并行做太多模块。
2. 每个阶段先读哪些文档、先学哪些知识、再开发哪些功能。
3. 每个阶段做完后，应该同步更新哪些项目文档。
4. 每个阶段的功能开发文档和学习文档，应该沉淀到哪里。

它不是替代 PRD，也不是替代学习手册，而是把它们串成一条可执行路径。

---

## 2. 开发前先读哪些文档

### 第一层：先建立全局认知

1. [overview.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/overview.md)
2. [architecture.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/foundation/architecture.md)
3. [tech-stack.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/foundation/tech-stack.md)
4. [framework-recommendations.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/foundation/framework-recommendations.md)
5. [engineering-guide.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/engineering/engineering-guide.md)

### 第二层：进入某个阶段前补对应 PRD

1. 工程骨架： [Nest Server 脚手架 PRD](../prd/long-term/nest-server-bootstrap-prd.md)
2. 主题与导航： [theme-navigation-config-prd.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/prd/react-first/theme-navigation-config-prd.md)
3. 内容阅读： [content-reading-prd.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/prd/react-first/content-reading-prd.md)
4. 内容工作区： [content-workspace-prd.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/prd/react-first/content-workspace-prd.md)
5. 后台运营： [后台内容与配置历史 PRD](./admin-content-config-prd.md)
6. AI 工具： [ai-tools-prd.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/prd/long-term/ai-tools-prd.md)

### 第三层：开始实作前补学习手册

1. [frontend-to-fullstack-learning-path.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/study/frontend-to-fullstack-learning-path.md)
2. [monorepo-docker-learning-handbook.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/study/monorepo-docker-learning-handbook.md)
3. [nextjs-learning-handbook.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/study/nextjs-learning-handbook.md)
4. [nestjs-learning-handbook.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/study/nestjs-learning-handbook.md)
5. [prisma-postgres-learning-handbook.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/study/prisma-postgres-learning-handbook.md)

---

## 3. 当前推荐实施顺序（历史）

```text
Phase 0 工程骨架
→ Phase 1 配置与布局底座
→ Phase 2 内容阅读闭环（Markdown / 掘金小册）
→ Phase 3 内容生产闭环（工作区）
→ Phase 4 后台运营闭环
→ Phase 5 AI 工具闭环
→ Phase 6 认证与权限增强
→ Phase 7 测试、部署、上线
→ Phase 8 Flutter 接入
```

关键原则：

- 先做“能跑起来的工程”，再做“第一条核心业务闭环”。
- 先完成阅读链路，再做上传、编辑、后台和 AI。
- 认证与 RBAC 不跳过，但首版不必先把所有鉴权细节做到最重。
- 每完成一个阶段，都要同步更新文档，而不是等项目后期再补。

---

## 4. 阶段执行规则

每个阶段建议都按下面顺序推进：

1. 阅读该阶段对应 PRD 与后端文档。
2. 确认页面、接口、数据表、权限点是否已经足够清晰。
3. 如果不清晰，先补 `docs/prd/`，再写代码。
4. 开发完成后，同步更新 `docs/backend/`、`docs/product/`、`docs/engineering/` 中受影响的文档。
5. 产出功能实现文档到 `docs/implementation/`。
6. 产出学习沉淀到 `study/features/`。

当前 Nest 开发顺序替换为：

```text
Nest 脚手架
→ Auth / User / RBAC / Session
→ SystemConfig / Menu
→ Content / Category / Tag / Favorite / Reading
→ Storage / Upload / BookletImport
→ AI
→ Admin / Audit
```

固定归档位置：

- 需求细化与功能拆解：`docs/prd/`
- 开发实现文档：`docs/implementation/`
- 功能学习文档：`study/features/`

---

## 5. 每日开发工作流

```bash
pnpm install
docker compose -f docker-compose.dev.yml up -d
pnpm dev
pnpm lint
pnpm test
pnpm build
```

推荐习惯：

- 每次只推进一个闭环，例如“Markdown 阅读页可打开并保存进度”。
- 每次新增接口都去 Swagger 验证一次。
- 每次改 Prisma Schema 都立刻做 migration。
- 每次改权限或布局配置，都做一次前后台手动回归。

---

## 6. 阶段拆解与文档索引

## Phase 0：工程骨架

### 目标

- 仓库从纯文档状态进入可运行工程状态。
- 建立 `apps/web`、`apps/api`、`packages/shared-types` 的 Monorepo 基础。
- 生成目录级 `AGENT.md`，把局部规范落到真实目录中。

### 先读文档

- [Nest Server 脚手架 PRD](../prd/long-term/nest-server-bootstrap-prd.md)
- [agent-file-templates.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/engineering/agent-file-templates.md)
- [engineering-guide.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/engineering/engineering-guide.md)

### 子任务

> **历史说明**：本节的 `apps/api` 与 Fastify 描述已被当前 `apps/server` + Express 实现取代，仅用于追溯原计划。

1. 初始化根目录工程配置：`pnpm-workspace`、`turbo`、TS、ESLint、Prettier。
2. 创建 `apps/web`，完成 Next.js App Router 基础工程。
3. 创建 `apps/api`，完成 NestJS + Fastify 基础工程。
4. 接入 Prisma 初始化配置。
5. 建立 `packages/shared-types`。
6. 准备 PostgreSQL、Redis、Docker Compose。
7. 在真实目录下创建 `apps/web/AGENT.md`、`apps/web/app/admin/AGENT.md`、`apps/api/AGENT.md`。

### 本阶段重点文件

- 根目录工程配置
- `apps/web/*`
- `apps/api/*`
- `packages/shared-types/*`
- `docker-compose.dev.yml`

### 完成标准

- `pnpm dev` 可以同时跑起 web 与 api。
- Swagger 可打开。
- Prisma 可连接数据库。
- 三份局部 `AGENT.md` 已实际落地。

### 完成后同步文档

- `docs/prd/long-term/nest-server-bootstrap-prd.md`
- `docs/engineering/engineering-guide.md`
- `docs/implementation/foundation/project-bootstrap.md`
- `study/features/project-bootstrap.md`

---

## Phase 1：配置与布局底座

### 目标

- 先把主题色、导航位置、公开配置读取链路跑通。
- 为前台、工作区、后台三个区域准备统一布局约定。

### 先读文档

- [theme-navigation-config-prd.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/prd/react-first/theme-navigation-config-prd.md)
- [product/frontend-public.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/product/frontend-public.md)
- [product/workspace.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/product/workspace.md)
- [product/admin.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/product/admin.md)
- [Canonical API](../backend/canonical-api.md)
- [Canonical 数据模型](../backend/canonical-data-model.md)

### 子任务

1. 建立 `system_configs` 与公开配置读取接口。
2. 约定主题色转换为 CSS Variables 的前端接入方式。
3. 支持公开前台导航位置配置 `top / left / right`。
4. 预留工作区与后台的导航布局配置。
5. 建立 Web 根布局、公开布局、工作区布局、后台布局骨架。
6. 预留后续配置项字段，例如圆角密度、布局密度、站点文案。

### 完成标准

- 前台能根据配置切换主题色。
- 前台导航位置能根据配置切换。
- 后台能读写主题与导航配置。
- 配置项不需要改代码即可生效或触发重新拉取。

### 完成后同步文档

- `docs/backend/canonical-api.md`
- `docs/backend/canonical-data-model.md`
- `docs/product/frontend-public.md`
- `docs/product/admin.md`
- `docs/implementation/foundation/theme-and-layout.md`
- `study/features/theme-navigation-config.md`

---

## Phase 2：内容阅读闭环

### 目标

- 跑通“内容列表 -> 内容详情 -> Markdown 阅读 -> 掘金小册阅读 -> 收藏 -> 阅读进度”的第一条核心业务主线。
- 这是当前项目最优先的首个业务闭环。

### 先读文档

- [content-reading-prd.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/prd/react-first/content-reading-prd.md)
- [product/content-system.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/product/content-system.md)
- [product/frontend-public.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/product/frontend-public.md)
- [Canonical API](../backend/canonical-api.md)
- [Canonical 数据模型](../backend/canonical-data-model.md)

### 子任务

1. 建立 `contents`、`content_chapters`、`categories`、`tags`、`favorites`、`reading_records` 数据结构。
2. 完成公开内容列表、精选内容、内容详情接口。
3. 完成 Markdown HTML 渲染与安全清洗流程。
4. 完成小册章节列表与单章详情接口。
5. 前台完成内容列表页与详情页。
6. 前台完成 Markdown 阅读页：目录、代码高亮、复制、阅读进度保存。
7. 前台完成掘金小册阅读页：章节切换、上下章、进度恢复。
8. 完成收藏接口与最近阅读接口。

### 完成标准

- 能阅读一篇 Markdown 内容。
- 能阅读一本小册并切换章节。
- 登录用户能收藏并恢复阅读进度。
- 未登录用户仍能浏览公开内容。

### 完成后同步文档

- `docs/backend/canonical-api.md`
- `docs/backend/canonical-data-model.md`
- `docs/product/content-system.md`
- `docs/product/frontend-public.md`
- `docs/implementation/content/reading-flow.md`
- `study/features/content-reading.md`

---

## Phase 3：内容生产闭环

### 目标

- 跑通“工作区列表 -> 新建 Markdown -> 编辑 -> 保存草稿 -> 发布 -> 小册导入”的内容生产链路。

### 先读文档

- [content-workspace-prd.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/prd/react-first/content-workspace-prd.md)
- [product/workspace.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/product/workspace.md)
- [Canonical API](../backend/canonical-api.md)
- [Canonical 数据模型](../backend/canonical-data-model.md)

### 子任务

1. 完成“我的内容”分页与筛选。
2. 完成内容创建向导。
3. 完成 Markdown 编辑器：保存草稿、发布、预览、离开提醒。
4. 完成文件上传能力与封面资源引用。
5. 完成掘金小册 ZIP 导入、解析、章节落库、导入结果页。
6. 完成主资源文件 / 原始导入包下载接口。
7. 完成内容状态流转：`draft -> published -> archived`。

### 完成标准

- 编辑者可创建并发布 Markdown 内容。
- 可导入一份小册 ZIP 并在阅读页打开。
- 工作区能查看自己的内容状态和更新时间。

### 完成后同步文档

- `docs/backend/canonical-api.md`
- `docs/backend/canonical-data-model.md`
- `docs/product/workspace.md`
- `docs/implementation/content/content-workspace.md`
- `study/features/content-workspace.md`

---

## Phase 4：后台运营闭环

### 目标

- 管理员可以完成内容、分类、标签、首页配置、主题配置、系统配置、操作日志等日常运营动作。

### 先读文档

- [后台内容与配置历史 PRD](./admin-content-config-prd.md)
- [product/admin.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/product/admin.md)
- [Canonical API](../backend/canonical-api.md)
- [Canonical 数据模型](../backend/canonical-data-model.md)

### 子任务

1. 搭建后台基础布局与菜单。
2. 完成全站内容管理：状态、可见性、精选、删除。
3. 完成小册详情抽屉与源文件下载。
4. 完成分类树、标签管理、菜单管理。
5. 完成首页区块配置与主题配置。
6. 完成系统配置批量保存。
7. 完成操作日志列表与详情查看。

### 完成标准

- 管理员能在后台完成主要内容运营动作。
- 首页配置与主题配置修改后能影响前台显示。
- 删除、下线、禁用等危险操作有二次确认和日志记录。

### 完成后同步文档

- `docs/backend/canonical-api.md`
- `docs/backend/canonical-data-model.md`
- `docs/product/admin.md`
- `docs/implementation/admin/admin-operations.md`
- `study/features/admin-content-config.md`

---

## Phase 5：AI 工具闭环

### 目标

- 跑通 AI 工具广场、Chat、多会话、文本生成、图片生成、Token 用量和后台模型配置。

### 先读文档

- [ai-tools-prd.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/prd/long-term/ai-tools-prd.md)
- [product/ai-tools.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/product/ai-tools.md)
- [Canonical API](../backend/canonical-api.md)
- [Canonical 数据模型](../backend/canonical-data-model.md)

### 子任务

1. 建立 AI 厂商与模型配置。
2. 完成工具广场配置与可见性控制。
3. 完成 Chat 会话、消息、SSE 流式返回、重新生成。
4. 完成内容引用作为上下文注入。
5. 完成文本生成场景模板。
6. 完成图片生成参数与结果展示。
7. 完成 Token 扣减、明细、趋势、分布统计。
8. 完成后台 AI 模型管理与统计页。

### 完成标准

- 登录用户可完成 Chat、Text、Image 三类工具使用。
- 访客试用规则可执行。
- 用量数据与扣减日志一致。

### 完成后同步文档

- `docs/backend/canonical-api.md`
- `docs/backend/canonical-data-model.md`
- `docs/product/ai-tools.md`
- `docs/implementation/ai/ai-platform.md`
- `study/features/ai-platform.md`

---

## Phase 6：认证与权限增强

### 目标

- 在已有业务骨架稳定后，再把注册、登录、RBAC、管理员权限和更多安全细节补到可长期维护状态。

### 先读文档

- [product/auth-rbac.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/product/auth-rbac.md)
- [Canonical API](../backend/canonical-api.md)
- [Canonical 数据模型](../backend/canonical-data-model.md)

### 子任务

1. 完成注册、登录、刷新、登出、找回密码等链路。
2. 落地用户、角色、权限点、菜单权限关系。
3. 完成工作区和后台路由守卫。
4. 完成权限点 seed 与管理员初始化策略。
5. 补充鉴权异常态、无权限页面、刷新恢复登录态等体验。

### 完成标准

- 核心接口具备后端鉴权保护。
- 工作区与后台具备可验证的访问控制。
- 至少一套角色权限链路完整可用。

### 完成后同步文档

- `docs/product/auth-rbac.md`
- `docs/backend/canonical-api.md`
- `docs/backend/canonical-data-model.md`
- `docs/implementation/auth/auth-rbac.md`
- `study/features/auth-rbac.md`

---

## Phase 7：测试、部署、上线

### 目标

- 把当前已完成的 Web、API、数据库、缓存和配置能力放到稳定的部署链路中。

### 先读文档

- [deployment.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/deploy/deployment.md)
- [engineering-guide.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/engineering/engineering-guide.md)

### 子任务

1. 补齐构建、Lint、测试命令。
2. 准备生产 Docker Compose、环境变量、域名与 HTTPS。
3. 设计备份、回滚、日志与监控最小方案。
4. 校验 Swagger、数据库迁移、Seed、配置初始化流程。

### 完成标准

- 生产环境可启动、可访问、可迁移数据库。
- 至少一条可重复执行的部署流程文档化。

### 完成后同步文档

- `docs/deploy/deployment.md`
- `docs/deploy/personal-remote-reading.md`
- `study/features/deployment.md`（若有运维学习笔记再补）

---

## Phase 8：Flutter 接入

### 目标

- 在 Web 主流程稳定后，再补移动端阅读、收藏、AI Chat 等复用能力。

### 先读文档

- [product/flutter.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/product/flutter.md)
- Web 已完成阶段对应的 API 与数据库文档

### 子任务

1. 收敛移动端需要的最小接口集合。
2. 确认登录态、文件访问、阅读进度同步方式。
3. 优先做阅读、收藏、AI Chat 三条链路。

### 完成标准

- Flutter 端可复用现有后端 API 跑通最小链路。

### 完成后同步文档

- `docs/product/flutter.md`
- `docs/implementation/mobile/flutter-integration.md`
- `study/features/flutter-integration.md`

---

## 7. 文档维护提醒

- `docs/prd/` 负责“开发前怎么设计”。
- `docs/backend/` 负责“接口和数据到底怎么约定”。
- `docs/implementation/` 负责“这次功能最后怎么落地”。
- `study/features/` 负责“为什么这样做、以后如何复用”。

如果某个阶段开发后没有同步这四类文档中的至少 2 类，说明沉淀还不完整。
