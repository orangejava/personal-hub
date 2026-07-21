# 阶段 4 收尾与阶段 4.5 体验底座

> 状态：已完成本轮实现
> 最后更新：2026-07-05
> 对应 PRD：[../../prd/react-first/phase-4-admin-preview-prd.md](../../prd/react-first/phase-4-admin-preview-prd.md)

## 1. 目标与范围

本轮目标是把阶段 4 后台运营台从“可体验骨架”收口到“可验收 mock 闭环”，并启动阶段 4.5 的全站体验底座。

已完成：

- 首页配置、菜单配置、内容状态、分类树、文件引用校验、操作日志等阶段 4 P0/P1 缺口。
- 页面切换动画、页面级 loading、区块级 skeleton、结果态组件等阶段 4.5 基础能力。

未纳入：

- 权限契约统一。
- 阶段 5 AI 工具页面。
- NestJS 真实后端和持久化数据库。

## 2. 页面与入口

后台收尾入口：

- `/admin/homepage`：首页 Hero、精选内容、AI 推荐、技术栈、模块排序和显隐。
- `/admin/menus`：公开前台、工作区、后台、AI 工作台预留菜单。
- `/admin/content/list`：内容发布、归档、删除。
- `/admin/content/categories`：树形分类 CRUD。
- `/admin/files`：文件筛选、引用占用提示、单个/批量删除。
- `/admin/logs`：操作日志 action/resource 筛选。

体验底座首批覆盖：

- `/`
- `/content`
- `/content/:id`
- `/content/booklets/:id/chapters/:chapterId`
- `/workspace/dashboard`
- `/admin/dashboard`
- `/admin/homepage`
- `/admin/menus`

## 3. 接口与数据流

后台 mock 数据集中在 `apps/react-web/mock/data/admin-store.ts`：

- `homepageConfig`：首页模块配置。
- `menuConfig`：公开、工作区、后台、AI 预留菜单。
- `categories`：支持父子分类、引用数量计算。
- `adminFiles`：支持引用占用校验。
- `auditLogs`：关键操作追加日志。

`apps/react-web/mock/admin.ts` 提供对应 mock API：

- `GET/PUT /api/admin/homepage`
- `GET/PUT /api/admin/menus`
- `PUT /api/admin/contents/:id/status`
- `DELETE /api/admin/contents/:id`
- `GET/POST/PUT/DELETE /api/admin/categories`
- `GET/DELETE /api/admin/files`
- `POST /api/admin/files/batch-delete`
- `GET /api/admin/logs`

内容状态和工作区列表共享 `apps/react-web/mock/data/contents.ts`，后台发布、归档、删除后，工作区与后台刷新都能看到同一份 mock 状态。

## 4. 关键实现

阶段 4 收尾：

- `packages/shared-types/src/admin.ts` 扩展首页配置、菜单配置、分类变更、文件查询等共享类型。
- `apps/react-web/src/services/admin/index.ts` 补齐后台 service 契约，页面层只依赖 service，不直接读 mock。
- `/admin/homepage` 使用表单维护首页配置，模块排序和显隐写回统一 mock 配置。
- `/admin/menus` 使用树形展示菜单，编辑后保存并同步 `@@initialState.menu`。
- `/admin/content/categories` 使用树形 ProTable，删除前由 mock API 检查子级和内容引用。
- `/admin/files` 支持 mime 分组筛选、引用占用禁选、批量删除。

阶段 4.5 体验底座：

- `PageTransition` 只包页面主体，顶栏和侧栏不参与切换动画，避免 ProLayout 抖动。
- `SectionSkeleton` 统一卡片、列表、表格、正文骨架尺寸，减少加载前后跳动。
- `ResultState` 统一 error/empty/success/warning/info 的动作区，旧 `EmptyState` 和 `ErrorState` 保持兼容入口。
- `tokens.less` 与 `motion.less` 统一维护 motion token，并通过 `prefers-reduced-motion` 降级。

## 5. 权限与异常

当前仍沿用阶段 1 的简化权限：

- `/admin/*` 由 `access.ts` 限制 admin。
- `/workspace/*` 由 `canWorkspace` 限制登录用户。
- 角色权限点仍是 mock 配置，尚未统一到长期 RBAC 权限契约。

异常处理：

- 首页配置、菜单配置、公开内容详情等页面已接入重试入口。
- ProTable 页面继续使用 ProComponents 自带 loading/error/empty 机制。
- 文件删除、分类删除由 mock API 返回明确失败原因，页面用 `message` 展示。

## 6. 验证方式

自动验证：

- `corepack pnpm --filter react-web biome:lint`
- `corepack pnpm typecheck`

手动验证：

1. 使用 admin mock 账号进入 `/admin/homepage`，修改模块显隐或排序并保存，再查看操作日志。
2. 进入 `/admin/content/list` 发布/归档内容，刷新后状态仍保持；再到 `/workspace/content` 核对同一内容状态。
3. 进入 `/admin/files`，尝试删除被引用文件应失败，批量删除未引用文件应成功。
4. 在公开页、工作区、后台之间切换路由，确认页面主体有统一淡入上移动画，顶栏/侧栏不抖动。

## 7. 已知限制与后续扩展

- 首页配置当前写入 mock 内存态，刷新 dev server 会恢复种子数据；阶段 6 接 NestJS 后迁移到配置表。
- AI 菜单只做阶段 5 预留，尚未接入独立 AI Layout。
- 权限契约暂未统一，后续应以 `docs/product/auth-rbac.md` 为准重整权限点。
- 阶段 4.5 已完成本轮体验底座和主要页面覆盖，后续新增页面必须复用 shared 体验组件。
- 阶段 4.5 深化记录见 [phase-4-5-experience-deepening.md](./phase-4-5-experience-deepening.md)。
