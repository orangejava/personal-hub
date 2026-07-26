# React-first 开发路线图

> 状态：阶段 0-5 已完成；**阶段 5 AI 平台 mock 闭环已完成本轮收尾**
> 最后更新：2026-07-06
> 目标：把 React-first 阶段拆成可执行的开发顺序，先交付完整体验，再逐步接入后端和 Next.js。

> 说明：阶段 0-5 的最终完成状态以 [../completed/README.md](../completed/README.md) 与 `docs/implementation/react-first/` 为准。本文早期任务清单中的未勾选项保留为历史拆解，不代表当前未完成。

---

## 1. 阶段总览

```txt
阶段 0：React-first 工程骨架
→ 阶段 1：主题、布局、权限、mock 底座
→ 阶段 2：公开前台与内容阅读
→ 阶段 3：工作区与内容生产
→ 阶段 4：后台运营台
→ 阶段 4.5：全站体验底座
→ 阶段 5：AI 平台独立工作台
→ 阶段 5.5：Next API Bridge（可选）
→ 阶段 6：接入 NestJS API
→ 阶段 7：抽离 Next.js 公开页面
```

---

## 2. 当前一次性执行范围

当前确认先一次性推进阶段 0 到阶段 3，详细执行标准见 [../prd/react-first/phase-0-3-foundation-prd.md](../prd/react-first/phase-0-3-foundation-prd.md)。

本轮明确边界：

- 不做完整后台管理台 CRUD。
- 不做 AI Chat / 文本生成 / 图片生成。
- AI 后续优先使用 `@ant-design/x`，本轮只保留框架选型和目录预留。
- PDF 只做卡片和详情占位，不做 PDF.js 在线阅读。
- Markdown 编辑器使用成熟开源组件，不自研。
- 登录页使用 Ant Design Pro 自带登录页改造。
- 首版视觉沿用 Ant Design Pro / Ant Design，公共样式通过 Less、CSS Modules、Ant Design token 和 `global.less` 管理。
- 阶段 3 必须能读取仓库内本地文件夹下的 Markdown 小册。

---

## 阶段 0：React-first 工程骨架

### 目标

- 建立 pnpm + Turborepo Monorepo。
- 克隆 Ant Design Pro 到 `apps/react-web`。
- 创建 `packages/shared-types`。
- React 工程能启动并引用共享类型。
- 梳理 clone 后项目结构和关键文件职责。

### 关键任务

- [ ] 创建根目录 `package.json`、`pnpm-workspace.yaml`、`turbo.json`、`tsconfig.base.json`。
- [ ] 克隆 `ant-design/ant-design-pro` 到 `apps/react-web`。
- [ ] 修改 `apps/react-web/package.json` 包名。
- [ ] 接入 workspace 依赖。
- [ ] 创建共享类型包。
- [ ] 补 `apps/react-web/AGENT.md`。
- [ ] 保留并识别 Ant Design Pro 的 `app.tsx`、`access.ts`、`models`、`services`、`mock`、`global.less` 等关键能力。
- [ ] 输出项目结构梳理记录。

### 完成标准

- [ ] `pnpm install` 成功。
- [ ] `pnpm dev:react` 成功启动。
- [ ] React 页面能引用 `packages/shared-types`。
- [ ] clone 后目录职责已记录。

---

## 阶段 1：主题、布局、权限、mock 底座

### 目标

- 建立三大区域布局。
- 建立 mock 登录、角色、菜单和权限。
- 建立主题和全局基础样式。
- 使用 Umi `@@initialState`、`src/models`、`useModel` 管理共享状态。

### 关键任务

- [ ] 清理 Ant Design Pro 示例页面。
- [ ] 搭建公开前台、工作区、后台三套布局。
- [ ] 准备 admin / editor / member 三类 mock 用户。
- [ ] 建立权限点和菜单配置。
- [ ] 建立系统配置 mock。
- [ ] 接入 Ant Design ConfigProvider 主题 token。
- [ ] 封装基础空状态、错误态、无权限态。
- [ ] 建立 `src/models/auth.ts`、`theme.ts`、`layout.ts`、`system.ts`、`content.ts` 等基础 model。
- [ ] 建立 `src/styles/tokens.less`、`globals.less`、`layout.less`、`typography.less`、`motion.less`。
- [ ] 登录页基于 Ant Design Pro 现有登录页改造。

### 完成标准

- [ ] 不同角色登录后菜单不同。
- [ ] 无权限路由有明确反馈。
- [ ] 主题配置能影响基础视觉。
- [ ] 页面统一通过 service 获取 mock 数据。
- [ ] `useModel` 能读取当前用户、权限和系统配置。

---

## 阶段 2：公开前台与内容阅读

### 目标

- 完成公开访问链路。
- 跑通内容列表、内容详情、Markdown 阅读、小册章节阅读。
- PDF / Word / 富文本首版只做卡片和详情占位。

### 关键任务

- [ ] 首页。
- [ ] 内容中心列表。
- [ ] Markdown 阅读页。
- [ ] 小册阅读页。
- [ ] 项目 / 作品页。
- [ ] 关于我。
- [ ] 收藏与阅读进度 mock。
- [ ] 引用到 AI 的跳转参数约定。
- [ ] PDF 内容详情占位。

### 完成标准

- [ ] 访客可浏览公开内容。
- [ ] 登录用户可收藏内容。
- [ ] 小册可切换章节。
- [ ] 阅读页目录和代码块体验可用。
- [ ] PDF 占位页面不报错。

---

## 阶段 3：工作区与内容生产

### 目标

- 完成登录用户的内容管理和创作工具。
- 能读取仓库内本地文件夹下的 Markdown 小册。

### 关键任务

- [ ] 工作台。
- [ ] 文档管理列表。
- [ ] 新建内容向导。
- [ ] Markdown 编辑器。
- [ ] 小册管理与导入结果。
- [ ] 本地小册文件夹扫描脚本与同步结果。
- [ ] Word / 富文本入口占位。
- [ ] 我的收藏。
- [ ] 用量页。
- [ ] 个人设置。

### 完成标准

- [ ] editor/admin 可创建和管理内容。
- [ ] member 权限边界可见。
- [ ] 内容状态可在 mock 中切换。
- [ ] 工作区核心页面具备 loading、empty、error 状态。
- [ ] `content-local/booklets` 下的小册能同步到 mock 数据并打开阅读。

---

## 阶段 4：后台运营台

> 详细 PRD：[../prd/react-first/phase-4-admin-preview-prd.md](../prd/react-first/phase-4-admin-preview-prd.md)

### 目标

- 完成管理员后台的主要运营能力。
- 注意：阶段 0-3 不做完整后台 CRUD，阶段 4 再开始。

### 关键任务

- [ ] 用户管理。
- [ ] 角色管理。
- [ ] 内容管理。
- [ ] 小册管理。
- [ ] 分类和标签管理。
- [ ] 文件管理。
- [ ] 首页配置。
- [ ] 菜单管理。
- [ ] 系统配置。
- [ ] PDF / Word 在线预览（react-pdf、docx-preview）。
- [ ] 富文本只读预览评估（Textbus，可选）。

### 完成标准

- [ ] ProTable / ProForm 支撑主要 CRUD 操作。
- [ ] admin 可访问后台全部页面。
- [ ] 非 admin 访问后台有权限反馈。
- [ ] 操作日志。
- [ ] 公开区 PDF/Word 详情可预览 mock 文件。

---

## 阶段 4.5：全站体验底座

> 详细要求见 [../prd/react-first/phase-4-admin-preview-prd.md](../prd/react-first/phase-4-admin-preview-prd.md) 的“阶段 4.5：体验优化底座”。

### 目标

- 在阶段 5 前建立统一的 loading、骨架屏、空状态、错误态和基础动效。
- 先做基础体验规范，避免 AI 页面开发时每个页面临时处理加载和反馈。

### 关键任务

- [x] 新增页面级 loading 与区块级 skeleton 组件。
- [x] 统一空状态、错误态、重试和返回动作。
- [x] 内容中心、内容详情、工作区内容列表、后台 Dashboard 先接入。
- [x] 文档预览和图片封面使用稳定尺寸，减少加载跳动。
- [x] 为阶段 5 AI 流式输出、图片生成骨架和任务状态提供复用样式。
- [x] 深化页面切换动画 token、局部动效组件和主要页面体验覆盖。
- [x] 修复开发态 MFSU/cache 导致的空白页风险，完成浏览器路由验收。
- [x] 富文本只读页去除编辑器工具栏污染，PDF/Word/小册路由回归通过。
- [x] mock 业务失败收敛为业务 code，避免预期校验失败污染控制台。
- [x] 阶段 5 开发时持续复用体验组件并扩展 AI 专属状态。

### 完成标准

- [x] 高频页面加载时不白屏、不跳动。
- [x] 请求失败有明确重试或返回路径。
- [x] AI 阶段页面可直接复用体验组件。

---

## 阶段 5：AI 工具平台

> 详细 PRD：[../prd/react-first/phase-5-ai-platform-prd.md](../prd/react-first/phase-5-ai-platform-prd.md)

### 目标

- 完成 AI 独立工作台、Chat、文本生成、图片生成、资产和会员入口的前端体验。
- 注意：阶段 0-3 不做 AI 功能。阶段 5 优先使用 `@ant-design/x`，并先建立 `src/components/ai-x` 本地全量封装层，页面层不直接依赖第三方组件。

### 关键任务

- [x] AI 专属布局：左侧工作栏、顶部工具条、返回首页。
- [x] Ant Design X 本地全量封装：`AiXProvider`、`AiXBubble`、`AiXSender`、`AiXConversations`、`AiXActions`、`AiXMarkdown`、hooks 等。
- [x] AI 样式 token：`ai-tokens.less`、`ai-layout.less`、`ai-components.less`、`ai-motion.less`。
- [x] AI 首页：工具聚合、最近创作、推荐模板。
- [x] Chat 会话列表、消息区、模型选择。
- [x] 模拟流式输出。
- [x] 文本生成场景与参数面板。
- [x] 图片/视频生成对话式内容流、hover 操作、再次编辑和重新生成。
- [x] AI 资产、创作中心、会员中心、会员超市、邀请有礼、教程、API mock 页面。
- [x] AI 历史从工作区跳转到 AI 工作台。
- [x] Token 用量 mock。

### 完成标准

- [x] 进入 `/ai/*` 后公开顶部导航隐藏，显示 AI 左侧工作栏。
- [x] Chat 可创建、切换、重命名、删除会话。
- [x] 文本生成、图片生成、视频生成有完整状态。
- [x] Token 不足和未登录限制可模拟。
- [x] 内容阅读页可跳转 AI 并携带引用上下文。
- [x] AI 页面只引用本地 `components/ai-x` / `components/ai`，不直接 import `@ant-design/x`。

---

## 阶段 5.5：Next API Bridge（可选）

> 详细 PRD：[../prd/react-first/phase-5-5-next-api-bridge-prd.md](../prd/react-first/phase-5-5-next-api-bridge-prd.md)

### 目标

- 在 NestJS 未启动前，可选用 `apps/next-api` 作为过渡 API 层。
- 先把认证、内容、后台配置、AI 代理等接口从 mock 推向真实数据库或真实第三方 API。
- 保持 API 路径、响应结构和共享类型与后续 NestJS 对齐，降低迁移成本。

### 关键任务

- [ ] 确认是否创建独立 `apps/next-api`，不要与后续 `apps/next-web` 混用。
- [ ] 建立 Next Route Handlers + Prisma 基础骨架。
- [ ] 抽 `modules/*/service.ts`，避免业务逻辑散落在 route handler。
- [ ] 复用 `packages/shared-types`。
- [ ] 先接认证、内容、系统配置，再接 AI 代理。

### 完成标准

- [ ] `apps/react-web` 可通过 `baseURL` 切到 Next API。
- [ ] mock service 方法名尽量不变。
- [ ] 后续迁移 NestJS 时只搬模块逻辑和 Prisma 访问，不改前端页面。

---

## 阶段 6：接入 NestJS API

### 目标

- 将稳定模块从 mock 逐步切到真实后端。

### 建议顺序

1. 认证与当前用户。
2. 系统配置与菜单。
3. 内容列表与详情。
4. 工作区内容生产。
5. 后台管理。
6. AI 代理与 SSE。

### 完成标准

- [ ] service 方法名尽量不变。
- [ ] mock 可作为开发兜底保留。
- [ ] Swagger / OpenAPI 与共享类型对齐。

---

## 阶段 7：抽离 Next.js 公开页面

### 目标

- 把更适合 SEO 和服务端渲染的页面迁移到 Next.js 15。

### 建议顺序

1. 首页。
2. 关于我。
3. 项目 / 作品。
4. 内容中心。
5. 内容阅读页。

### 完成标准

- [ ] Next.js 页面复用共享 types。
- [ ] React 版对应页面可逐步下线或保留为内部预览。
- [ ] 登录、收藏、引用到 AI 等跨应用交互有统一跳转约定。
