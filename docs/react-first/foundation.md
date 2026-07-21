# React-first 基础设施规划

> 状态：✅ 当前基础设施已实施；真实 API 接入时继续沿用其分层原则
> 最后更新：2026-06-27
> 目标：在正式写业务页面前，先把会影响后续扩展成本的基础能力想清楚。

---

## 1. 基础设施清单

React-first 阶段不只是“先把页面写出来”，还需要提前搭好这些基础：

| 基础能力 | 作用 |
|---|---|
| Monorepo | 为 React、Next、NestJS、共享包留出长期结构 |
| 共享 types | 避免 React mock、Next 页面、NestJS DTO 各写一套类型 |
| 请求封装 | 后续从 mock 切真实 API 时少改页面 |
| mock 数据层 | 后端未完成前支撑完整页面开发 |
| 权限模型 | 角色、菜单、按钮显隐与未来后端 RBAC 对齐 |
| 主题系统 | 统一颜色、暗色模式、布局密度、圆角和品牌变量 |
| 全局样式 | 统一 reset、字体、页面背景、滚动条、内容排版 |
| 动画系统 | 统一页面切换、弹窗、列表状态；AI 流式输出过渡后续阶段再补 |
| 布局系统 | 公开前台、工作区、后台三类布局边界清楚 |
| 基础组件 | 避免页面中重复写空状态、错误态、权限态、操作栏 |
| 内容渲染 | Markdown、小册、代码块、目录、复制等能力可复用 |
| 错误处理 | 请求错误、权限错误、mock 异常、空状态有统一体验 |
| 启动脚本 | 根目录和单应用启动方式清楚 |

---

## 1.1 阶段 0-3 边界补充

阶段 0-3 的详细执行计划见 [../prd/react-first/phase-0-3-foundation-prd.md](../prd/react-first/phase-0-3-foundation-prd.md)。

本阶段确认：

- 沿用 Ant Design Pro / Ant Design 的首版视觉。
- 不以 Tailwind 作为主要样式体系。
- 使用 Umi 内置数据流：`@@initialState`、`src/models`、`useModel`。
- AI 功能后置；后续优先使用 `@ant-design/x`。
- PDF 只做卡片和详情占位。
- 本地小册通过开发期脚本读取仓库内 Markdown 文件夹。

---

## 2. 主题系统

### 2.1 主题目标

主题系统需要同时服务三类区域。第一版不追求重做一套完全独立视觉，而是在 Ant Design Pro 现有观感基础上抽取可复用变量，方便后续逐步品牌化：

- 公开前台：更有个人品牌感。
- 工作区：清晰、高效、适合长期使用。
- 后台：信息密度高、操作稳定、优先使用 Ant Design 体系。

### 2.2 主题 token

建议从这些 token 开始：

| Token | 含义 |
|---|---|
| `colorPrimary` | 品牌主色 |
| `colorSuccess` | 成功状态 |
| `colorWarning` | 警告状态 |
| `colorError` | 错误状态 |
| `colorInfo` | 信息状态 |
| `borderRadius` | 全局圆角 |
| `fontFamily` | 全局字体 |
| `layoutHeaderHeight` | 顶栏高度 |
| `layoutSidebarWidth` | 侧栏宽度 |
| `motionDurationFast` | 快速动画 |
| `motionDurationBase` | 常规动画 |

### 2.3 配置来源

首版：

- mock 系统配置返回主题 token。
- React 启动时读取配置并注入 Ant Design ConfigProvider。

后续：

- NestJS `system_configs` 表存储配置。
- React / Next 启动或页面加载时读取公开配置。

---

## 3. 全局样式

第一版样式策略：

- 沿用 Ant Design Pro 的整体视觉节奏。
- 公共样式沉淀到 Less 分层文件。
- 页面局部样式使用 CSS Modules。
- 不把所有样式都写成 Tailwind utility。
- 不把大量业务页面样式塞进 `global.less`。

建议全局样式分层：

```txt
src/styles/
├── tokens.less       ← 设计变量与 Ant Design token 映射
├── globals.less      ← reset、body、链接、滚动条
├── layout.less       ← 基础布局变量
├── motion.less       ← 动画变量和通用 keyframes
├── typography.less   ← 内容阅读排版
└── utilities.less    ← 少量通用工具类
```

`src/global.less` 只作为入口：

```less
@import './styles/tokens.less';
@import './styles/globals.less';
@import './styles/layout.less';
@import './styles/typography.less';
@import './styles/motion.less';
@import './styles/utilities.less';
```

规则：

- 简单页面不要散落大量硬编码色值。
- 内容阅读页单独维护排版样式，避免被后台表格样式影响。
- 后台页面以 Ant Design token 为主，不强行覆盖成前台风格。
- 页面级样式优先使用 `index.module.less`。
- 可复用布局类、阅读排版类、动画类才进入 `src/styles`。

---

## 4. 全局动画

动画要服务体验，不抢业务注意力。

首版建议统一这些动画：

| 场景 | 建议 |
|---|---|
| 页面切换 | 轻微 fade / slide，时长 160ms～240ms |
| 弹窗打开 | 使用 Ant Design 默认动效或轻微调整 |
| 列表加载 | skeleton 或 spin，不做复杂动画 |
| AI 流式输出 | 阶段 5 再补，优先使用 `@ant-design/x` 相关能力 |
| 菜单折叠 | 使用 ProLayout 默认能力 |
| 卡片 hover | 轻微阴影和位移，不影响布局 |

---

## 5. 布局系统

### 5.1 公开前台布局

特点：

- 顶部导航。
- 内容宽度有上限。
- 首页可有更强视觉表达。
- 内容阅读页强调长文可读性。

后续迁移到 Next.js 的概率最高，因此组件要尽量减少 Umi 专属依赖。

### 5.2 工作区布局

特点：

- 顶部栏 + 侧边栏。
- 有快捷入口、表格、编辑器、统计卡片。
- 登录后访问。

### 5.3 后台布局

特点：

- ProLayout。
- 菜单根据权限生成。
- ProTable / ProForm 为主。
- 面向管理员操作。

---

## 6. 权限与菜单

权限点沿用 [../product/auth-rbac.md](../product/auth-rbac.md)。

首版 mock 中至少准备三类用户：

| 角色 | 标识 | 用途 |
|---|---|---|
| 管理员 | `admin` | 验证后台全部能力 |
| 编辑者 | `editor` | 验证内容生产与发布 |
| 普通会员 | `member` | 验证阅读、收藏、AI 基础使用 |

权限判断分三层：

1. 路由是否可访问。
2. 菜单是否可见。
3. 按钮或操作是否可用。

首版可以只在前端 mock 判断；真实接入后由 NestJS Guard 做最终校验，前端只负责体验层显隐。

---

## 6.1 Umi 数据共享模型

React-first 阶段优先使用 Umi / Ant Design Pro 已有的数据流能力，不额外引入 Zustand。

建议目录：

```txt
src/models/
├── auth.ts
├── layout.ts
├── theme.ts
├── system.ts
├── content.ts
└── workspace.ts
```

职责：

| Model | 职责 |
|---|---|
| `auth` | 当前用户、登录态、角色、权限 |
| `layout` | 当前布局区域、菜单折叠、导航状态 |
| `theme` | 主题 token、暗色/亮色、布局密度 |
| `system` | 站点名、首页配置、公开系统配置 |
| `content` | 内容筛选偏好、最近阅读、本地小册状态 |
| `workspace` | 工作区筛选、编辑草稿状态 |

使用规则：

- 跨页面共享状态放 `src/models`。
- 启动期全局数据放 `@@initialState`。
- 页面局部状态使用 `useState` 或组件内部状态。
- 表单状态交给 Ant Design Form / ProForm。
- 不在 model 中塞大量静态 mock 数据；mock 数据仍归 `mock/data` 管。

---

## 7. 请求封装

请求封装目标：

- 统一 baseURL。
- 统一 `ApiResponse<T>`。
- 统一错误提示。
- 统一登录过期处理。
- 统一分页参数和分页响应。
- mock 和真实 API 切换时页面不改或少改。

建议响应结构：

```ts
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  requestId?: string;
}
```

分页结构：

```ts
export interface PaginationResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

---

## 8. 基础组件

建议首批封装：

| 组件 | 用途 |
|---|---|
| `PageContainer` | 页面标题、面包屑、操作区 |
| `EmptyState` | 空数据引导 |
| `ErrorState` | 请求失败或异常 |
| `ForbiddenState` | 无权限 |
| `LoginRequired` | 未登录引导 |
| `ContentCard` | 内容卡片 |
| `ContentTypeTag` | 内容类型标签 |
| `StatusBadge` | 草稿/发布/归档等状态 |
| `PermissionGate` | 根据权限控制局部渲染 |
| `MarkdownViewer` | Markdown 渲染 |
| `TocPanel` | 目录导航 |

规则：

- 跨模块复用组件放 `components/shared`。
- 某模块专属组件不要过早抽成全局组件。
- 复杂组件要补中文 JSDoc，说明业务含义和边界。

AI 相关组件阶段 0-3 暂不实现。后续阶段优先使用 `@ant-design/x`，例如 Bubble、Conversations、Sender、Prompts、Attachments、ThoughtChain 等，不自研完整 AI 聊天基础组件。

---

## 9. 内容渲染基础

内容阅读是项目核心之一，首版需要提前考虑：

- Markdown 渲染。
- 代码块高亮。
- 代码复制。
- 目录提取。
- 小册章节切换。
- 阅读进度。
- 收藏。
- 引用到 AI 的入口占位。

首版可以先用前端渲染 Markdown；后续 NestJS 或 Next.js 可承担服务端渲染与缓存。

---

## 9.1 本地小册读取基础

阶段 3 必须支持读取仓库内本地 Markdown 小册目录。

约定输入目录：

```txt
content-local/booklets/
```

约定同步脚本：

```txt
apps/react-web/scripts/sync-local-booklets.ts
```

约定输出：

```txt
apps/react-web/mock/data/local-booklets.generated.ts
```

规则：

- 浏览器页面不直接读取任意本地文件夹。
- 开发期通过 Node 脚本扫描仓库内目录。
- 每个子文件夹视为一本小册。
- `.md` 文件按数字前缀或文件名排序。
- `meta.json` 可选。
- 同步结果进入 mock 数据，再由 service 提供给页面。

---

## 10. 启动与环境

首版建议：

```bash
pnpm install
pnpm dev:react
```

后续接入 API 后：

```bash
pnpm dev
```

分别启动：

- React Web。
- NestJS API。
- PostgreSQL。
- Redis。

---

## 11. 后续扩展原则

- 能放共享包的类型，不只放在 React 工程里。
- 能从 mock service 切真实 API 的调用，不写死在组件里。
- 能作为长期主题 token 的样式，不在页面里随手写。
- 能通过权限配置控制的菜单，不在多个地方重复硬编码。
- 能用现有 Pro Components 完成的后台能力，不重新造复杂表格和表单。
