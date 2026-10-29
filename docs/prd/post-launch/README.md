# 上线后优化 PRD

> 状态：当前开发主线
> 最后更新：2026-10-29
> 关系：首版已上线后，本目录承接跨端优化 PRD；标为细化稿的文档需按各自列出的端点实测、容量压测和实施门槛收口，不能把已确认的产品规则重新列为待决。历史 React-first 阶段 PRD 仍在 `apps/*/docs/prd/` 与 `docs/prd/react-first/`；长期后端契约仍在 `docs/prd/long-term/`。

## 放置边界

本目录放上线后跨多个应用或需要统一验收的 PRD；是否进入下一批开发由各文档的状态和待决事项决定。

不放：

- 服务器上线命令、域名、备案、HTTPS、备份：放 `docs/deploy/`
- 单个应用内部的小修小补：放对应 `apps/<name>/docs/prd/`
- 已落地实现说明：放 `apps/<name>/docs/implementation/` 或 `apps/server/docs/implementation/`
- 远期想法：放 `docs/product/phase-2/`

## 当前与已完成 Worktree

`perf-dashboard`、`home-showcase`、`theme-config` 已完成生产验收，关联 worktree 已清理；当前只保留
`ai-admin` 继续开发。

| 文档 | Worktree | 内容 | 当前状态 |
| --- | --- | --- | --- |
| [ai-admin-operations-prd.md](./ai-admin-operations-prd.md) | `ai-admin` | Provider、模型、用户自备 Key、用量、额度、发放和签到 | 阶段 A–E 代码完成；优化、HTTP 集成测试、浏览器联调与验收中 |
| [ai-media-generation-prd.md](./ai-media-generation-prd.md) | `ai-admin` | 五个首版生图/生视频模型、参考输入、任务、结果和实收计费 | F–G 细化稿；OpenRouter 已定，端点能力待实测 |
| [ai-tool-experience-prd.md](./ai-tool-experience-prd.md) | 后续 worktree | 顶栏独立工具、目录/卡片模式、文本对比和 Cesium 展示入口 | 产品范围已定；历史不自动过期，容量待压测 |
| [ai-asset-library-prd.md](./ai-asset-library-prd.md) | 后续 worktree | 工作区统一素材库、AI 生产 Tab、目录与回收站；后台站点素材及超级管理员私有视图 | 产品范围已定；完成回答自动显示引用，主动保存生成快照 |
| [workspace-content-lifecycle-optimization-prd.md](./workspace-content-lifecycle-optimization-prd.md) | `main` 后续实施 | ZIP 资料包与混合章节、COS 图片、清理、全站回收站、草稿/阅读与两端表格 | 产品核心规则已定；纯文件资料包首版仅私有；未改业务代码 |
| [performance-dashboard-prd.md](./performance-dashboard-prd.md) | `perf-dashboard` | 性能与接口响应面板、性能基线、入口体积优化、Nest 汇总 | ✅ 已完成并验收 |
| [home-showcase-prd.md](../../../apps/user-web/docs/prd/home-showcase-prd.md) | `home-showcase` | 首页滚动改版、项目作品矩阵 | ✅ 已完成并验收 |
| [theme-ui-performance-prd.md](./theme-ui-performance-prd.md) §3–§6 | `theme-config` | 主题、Loading / Skeleton、内容中心、小册阅读、AI 工作台、登录表单 | ✅ 已完成并验收 |

总纲当前范围已完成验收；后续新增体验优化需求另立 PRD 并排期。

## 启动前骨架（在 main 上先做，状态：已落地，提交 `a70ab11`）

几个 worktree 会同时改到同一批文件。为了避免各自改出差异、合并时大面积冲突，先在 `main` 上把**共用的文件拆分、共享配置和前后端契约**落地，再从 `main` 建 worktree。

原则：只处理多条 worktree 都会碰到的共享边界，或必须先完成的项目截图纵向链路；不提前实现只属于单一 worktree 的页面功能。每一项都要能单独验证。

| # | 内容 | 文件 | 谁会用 |
| --- | --- | --- | --- |
| 1 | 把顶栏右侧操作区（主题按钮、账号入口）从 `PublicLayout` 拆成独立组件，界面不变 | `apps/user-web/src/layouts/PublicHeaderActions.tsx`、`PublicLayout.tsx` | `perf-dashboard` 在这里加图标；`theme-config` 调整导航位置时整体移动它 |
| 2 | 补齐已经存在的主题 / 导航配置映射：`colorSecondary`、`colorAccent`、`allowUserSwitch` 及导航字段进入用户端业务对象 | `packages/shared-types/src/system.ts`、`packages/api-client/src/system.ts`、对应单测 | `perf-dashboard` 跟随主题配色；`theme-config` 编辑并应用主题 |
| 3 | 定义「项目视觉资产」的共享类型与 `site.layout.projectVisualAssets` 配置契约；只允许 5 个固定端 key、每端 1 张封面和最多 6 张截图 | `packages/shared-types/src/system.ts`、`apps/server/src/modules/system/config-registry.ts` | `home-showcase` 前台读取；`SystemProjects` 后台编辑 |
| 4 | Nest 公开配置将资产文件 ID 转为短期签名 URL；旧配置自动补为空资产；校验 key、数量、文件状态与权限 | `apps/server/src/modules/system/system.service.ts`、`config-registry.ts`、`apps/server/test/system-config.spec.ts` | `home-showcase`；避免在前台暴露内部文件 ID |
| 5 | 管理端共享 `ImageFileField`：复用已有 `/api/v1/app/uploads` 的幂等上传 / 完成链路，支持 `COVER`、预览、替换、删除和 READY 错误态 | `apps/admin-web/src/components/ImageFileField/*`、`apps/admin-web/src/services/files.ts` | `home-showcase` 的截图；后续 `theme-config` 的 Logo / favicon |
| 6 | 项目配置页完成资产读取与保存：保留标题 / 简介，新增 5 个端的封面和截图编辑器 | `apps/admin-web/src/pages/admin/SystemProjects/index.tsx`、`apps/admin-web/src/services/admin/index.ts` | `home-showcase` |
| 7 | 补齐跨端回归：服务端配置解析、公开 URL 签名、后台上传 / 保存、用户端读取占位回退 | `apps/server/test/system-config.spec.ts`、相关前端测试 | 所有后续 worktree 以此为回归底线 |

第 2–7 项涉及前后端契约或上传链路，动手前必须按 [`fullstack-impact`](../../../.agents/skills/fullstack-impact/SKILL.md) 贴出文件级计划并确认。

**不放进骨架**：

- 页面清单 `pageRegistry.ts`、性能采集、路由 `/status`：只由 `perf-dashboard` 使用，放在该 worktree
- 作品文字、端状态、技术栈和时间线的 `projectShowcase.ts`：只由 `home-showcase` 使用，放在该 worktree
- 首页区块的新 key 与默认排序：只由 `home-showcase` 使用，放在该 worktree
- 入口体积优化（汇总导出改为直接引入）：留给 `perf-dashboard`，用面板记录优化前后
- Prisma 新表：`perf-dashboard` 二期和 `ai-admin` 各自建

**main 上的顺序**：手机端 AI 两项和 HTTPS 生产验收已完成；下一批按[工作区内容生命周期优化](./workspace-content-lifecycle-optimization-prd.md)分阶段实施。AI 媒体协议仍在 `ai-admin` worktree，公开 AI 登记确认暂缓。

## 开发顺序

以下为已完成 worktree 的合并顺序记录，当前不再创建或复用这三个 worktree：

1. `perf-dashboard` 一期最先合并，留下改版前的性能基线。
2. `home-showcase` 在它之后合并，这样面板能显示改版前后对比。
3. `theme-config` 与 `ai-admin` 按各自进度合并。

各 worktree 内部顺序：

- `ai-admin`：先做配置中心，再做用量额度，最后做发放与签到；随后按 [ai-media-generation-prd.md](./ai-media-generation-prd.md) 先接真实文生视频，再接真实生图。
- `perf-dashboard`：先做一期前端面板，再做首轮入口体积优化，最后做二期 Nest 汇总。
- `home-showcase`：先做动效封装组件，再做首页，最后做项目页。
- `theme-config`：先做后台主题表单，再做前台按配置渲染。

## 并行冲突约定

| 冲突点 | 约定 |
| --- | --- |
| `apps/user-web/src/layouts/PublicLayout.tsx` | `theme-config` 只改导航位置（顶 / 左 / 右），顶栏保持不透明，不实现首屏透明或滚动毛玻璃。`perf-dashboard` 只把 `PageTransition` 改为直接引入，并在 `{children}` 外加路由耗时标记。`home-showcase` 不改 |
| `apps/user-web/src/layouts/PublicHeaderActions.tsx` | 只有 `perf-dashboard` 在里面加图标；`theme-config` 只移动它的位置，不改内部 |
| `apps/user-web/config/routes.ts` | 只有 `perf-dashboard` 新增 `/status` |
| `packages/shared-types`、`packages/api-client` 的系统配置 | 骨架已有字段各 worktree 只读。例外只有 `keywords`、`faviconUrl`：由 `theme-config` 加到公开配置对象，其它 worktree 不改这两处。再有新字段仍先回 `main` 加 |
| `apps/admin-web/src/pages/admin/SystemProjects/index.tsx` | 骨架独占项目图片字段；后续 `home-showcase` 只消费公开配置，不再改本页 |
| `apps/admin-web/src/pages/admin/SystemContent/index.tsx` | `theme-config` 独占内容卡片、阅读宽度与 Hero 排版字段；`home-showcase` 不改本页 |
| `apps/server/prisma/schema.prisma` 与迁移 | `perf-dashboard` 二期和 `ai-admin` 都会加表；后合并的一方先变基，再重新生成迁移，不手工合并迁移 SQL |
| 全局样式 `motion.less`、`global.less` | `home-showcase` 不改，首页样式放在首页目录内 |
| `apps/user-web/src/app.tsx` | `theme-config` 只在 `rootContainer` 加 Helmet（标题、description、keywords、favicon）。`perf-dashboard` 只加采集初始化和 `onRouteChange`，并把汇总导出改为直接引入。两边不改对方那一段 |

## 共同验收原则

- 不破坏首版已上线能力：登录、内容阅读、小册阅读、AI 基础能力、后台入口。
- 涉及 Nest / API / Prisma / `api-client` 时，同步更新接口、类型、调用方和测试。
- 涉及前端页面、样式或交互时，完成后必须做浏览器验收。
- 实现完成后，补充实现说明；若形成可复用学习点，再补 `study/features/`。
