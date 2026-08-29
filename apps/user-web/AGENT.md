# apps/user-web 开发规范

> 适用范围：`apps/user-web` 下所有代码。本文件是总规范，分模块细则见 `.agent/` 子目录。
> 本应用是 personal-hub 的 React-first 首版 Web 实现，**不替代**后续 Next.js 与 NestJS 长期架构。

## 1. 定位与技术栈

- 框架：React 19 + Umi Max（`@umijs/max`）+ Ant Design Pro 模板改造
- UI：Ant Design v6 + `@ant-design/pro-components`；后续 AI 功能优先用 `@ant-design/x`
- 构建：Umi 内置（utoo/pack）
- Lint：Biome（模板自带，不引入 ESLint）
- 状态：优先使用 Umi `@@initialState`、`src/models`、`useModel`；**不引入 Zustand**
- 样式：Less + CSS Modules + Ant Design token；**不以 Tailwind 作为主样式体系**（模板虽带 Tailwind，但本项目公共样式走 `src/styles/*`）
- 包管理：根目录 pnpm workspace，包名 `user-web`
- Node：>=22（见根目录 `.nvmrc`）

## 2. 数据获取铁律

- 页面/组件**必须通过 `src/services/*` 取数**，禁止直接 import mock 数据。
- 调用链：`page → services/module.ts → request → mock 接口 → mock/data`。
- mock 响应统一使用 `ApiResponse<T>`（来自 `@personal-hub/shared-types`）。
- 后续接 NestJS API 时只改 service 层 baseURL/代理，页面不动。

## 3. 共享类型

- 业务类型、枚举、分页、响应结构**优先放 `packages/shared-types`**。
- 仅 React 应用内部、与后端无关的纯 UI 类型可放 `src/types`。
- 引用方式：`import { ContentType } from '@personal-hub/shared-types'`。

## 4. 状态管理

- 跨页面共享状态放 `src/models`（auth / layout / theme / system / content / workspace）。
- 启动期全局数据（当前用户、权限、菜单、系统配置、主题）放 `@@initialState`。
- 页面局部一次性状态用 `useState`；表单状态交 Ant Design Form / ProForm。
- 不在 model 中塞大段静态 mock 数据，mock 数据归 `mock/data`。

## 5. 路由与布局

- 三类布局：PublicLayout（`/`、`/content`、`/projects`、`/about`）、WorkspaceLayout（`/workspace/*`）。后台在独立应用 `apps/admin-web`（`:8001`）。
- 路由配置在 `config/routes.ts`。
- 登录页沿用 Ant Design Pro `/user/login` 改造，不另起。
- 公开前台组件尽量写成**可迁移的纯展示组件**，减少 Umi 运行时绑定，便于后续迁 Next.js。

## 6. 样式规范

- 全局样式分层在 `src/styles/`：tokens / globals / layout / typography / motion / utilities / **public-theme**。
- `src/global.less` 只做入口 `@import`，不堆业务样式。
- 页面局部样式用 CSS Modules（`index.module.less`）。
- **禁止在公开前台页面硬编码** `rgba(0,0,0,...)`、`#fff` 等前景/背景色；统一用 `public-theme.less` 中的 CSS 变量。
- 阅读排版进 `typography.less`，颜色绑定 `--ph-text-*` / `--ph-code-bg` 等变量。

### 6.1 公开区 vs 工作区主题（两套独立）

| 区域 | 状态字段 | 设置入口 | 技术实现 |
|---|---|---|---|
| 公开前台 | `initialState.publicSettings` | `PublicThemeDrawer` | `PublicLayout` 根节点 `.ph-public-layout` / `.ph-public-dark` + `ConfigProvider` |
| 工作区 | `initialState.settings` | Pro `SettingDrawer` | ProLayout 内置 token |

**新增公开页 checklist**：

1. 根布局必须在 `PublicLayout` 内，自动获得主题变量。
2. 文案/次要信息用 class：`ph-text-secondary` 对应变量 `--ph-text-secondary`，或用语义 class（如 `ph-content-card-summary`）。
3. 自定义区块背景用 `--ph-bg-container` / `--ph-bg-spotlight`，勿写死 `#fff`。
4. 需要感知暗色时用 `usePublicTheme()` 的 `isDark` / `menuTheme`（如侧栏 `Menu theme`）。
5. Ant Design 组件优先用 `Typography type="secondary"` 等 token 化 API，避免 inline `color`。
6. 主色同步：`PublicLayout` 会把 `colorPrimary` 写入 `--ph-color-primary`。

### 6.2 工作区主题

- 工作区沿用 ProLayout `SettingDrawer`，与公开区互不影响。

## 7. 权限与菜单

- 权限点沿用 `@personal-hub/shared-types` 的 `PermissionCode`。
- 权限判断三层：路由可访问 → 菜单可见 → 按钮可用。
- mock 用户：见 [../../docs/engineering/dev-credentials.md](../../docs/engineering/dev-credentials.md)（单一数据源 `src/config/devCredentials.ts`）。
- 前端只做体验层显隐，真实校验由后续 NestJS Guard 完成。

## 8. 模块边界

| 模块 | 页面目录 | 组件目录 | 细则 |
|---|---|---|---|
| 公开前台 | `src/pages/public` | `src/components/public` | `.agent/public.md` |
| 工作区 | `src/pages/workspace` | `src/components/workspace` | `.agent/workspace.md` |
| AI 工具 | `src/pages/ai` | `src/components/ai` | 阶段 5 |
| 认证 | `src/pages/user` | — | `.agent/auth.md` |
| mock 与 service | `mock/`、`src/services` | — | `.agent/mock-services.md` |
| 本地小册脚本 | `src/scripts` | — | `.agent/local-booklets.md` |
| 样式与主题 | `src/styles` | — | `.agent/styles-theme.md` |

## 9. 注释约定

- 关键方法、复杂逻辑、核心状态变量补中文注释，说明「为什么」与业务含义。
- 关键方法优先写 JSDoc（中文），说明用途、参数、返回值、副作用。
- 简单自解释代码无需为注释而注释。

## 10. 安全增量

- 只改与当前需求直接相关文件，不顺手重构无关代码。
- 改共享组件、工具函数、全局 store、请求封装、路由前先确认调用方。
- 不通过直接操作 DOM 等脆弱方式实现功能。

## 11. 验收

- 完成前端页面/组件/样式/交互改动后，用 Cursor 内置浏览器验收：页面可打开、DOM 符合预期、关键流程可执行、控制台无新增 error。
- 阶段完成前执行：`pnpm install`、`pnpm dev:react`、`pnpm --filter user-web lint`、`pnpm --filter user-web tsc`。
