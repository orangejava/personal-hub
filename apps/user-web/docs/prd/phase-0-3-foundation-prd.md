# React-first 阶段 0-3 一次性实施 PRD

> 状态：✅ 已实施
> 最后更新：2026-06-28
> 最后更新：2026-06-27
> 优先级：P0
> 目标：一次性完成 React-first 工程骨架、基础底座、公开前台与内容阅读、工作区内容生产的首版闭环。

---

## 1. 本 PRD 解决什么问题

本 PRD 用来指导后续 AI 一次性执行 React-first 阶段 0 到阶段 3，避免每一步都临时做默认决策。

实施范围来自 [../../../../docs/history/react-first-roadmap.md](../../../../docs/history/react-first-roadmap.md)：

- 阶段 0：React-first 工程骨架。
- 阶段 1：主题、布局、权限、mock 底座。
- 阶段 2：公开前台与内容阅读。
- 阶段 3：工作区与内容生产。

明确不包含：

- 完整后台管理台 CRUD。
- AI Chat / 文本生成 / 图片生成等具体功能。
- NestJS 后端实现。
- Next.js 应用创建。
- PDF 在线阅读。
- Word 在线编辑。
- 富文本协作。

---

## 2. 已确认决策

| 事项 | 结论 |
|---|---|
| 首版工程 | `apps/user-web` |
| 初始化方式 | 完整 clone `ant-design/ant-design-pro` 后改造 |
| Monorepo | pnpm + Turborepo |
| 共享类型 | `packages/shared-types` |
| 登录页 | 使用 Ant Design Pro 自带登录页改造 |
| 首版视觉 | 沿用 Ant Design Pro / Ant Design 视觉基调 |
| 样式策略 | 不强推 Tailwind；以 Ant Design token、Less、CSS Modules、`global.less` 和 `src/styles/*` 为主 |
| Umi 数据共享 | 使用 Umi `@@initialState`、`src/models`、`useModel` |
| AI 组件库 | 后续 AI 功能优先使用 `@ant-design/x`，本阶段只明确依赖策略和预留结构 |
| Markdown 编辑器 | 使用成熟开源组件，不自研编辑器 |
| PDF | 内容卡片和详情占位，不做 PDF.js 在线阅读 |
| 本地小册 | 阶段 3 必须能读取本地文件夹下的 Markdown 小册 |
| 后台管理 | 本阶段不做完整 admin CRUD，只保留基础入口或占位 |
| 网络权限 | 后续执行 clone / install 时可直接申请网络权限 |

---

## 3. 总体完成效果

阶段 0-3 完成后，项目应该具备：

1. `pnpm dev:react` 可以启动 `apps/user-web`。
2. `apps/user-web` 沿用 Ant Design Pro 的整体视觉和布局能力。
3. 公开前台、内容中心、内容阅读、小册阅读、工作区内容管理、Markdown 编辑器、小册管理可访问。
4. 登录页支持 mock 登录和角色切换。
5. 权限、菜单、主题、系统配置来自 mock / model，不散落在页面中。
6. 页面数据通过 `services` 访问，不直接 import mock 数据。
7. 内容中心能展示 mock 内容，并能读取本地 Markdown 小册目录生成小册数据。
8. 工作区能管理内容草稿、Markdown 文档和本地小册。
9. 共享类型包能被 React 工程引用。
10. 后续接 NestJS API 时，页面层不需要大改。

---

## 4. 阶段边界

### 4.1 阶段 0：工程骨架

必须完成：

- 根目录 Monorepo。
- `apps/user-web`。
- `packages/shared-types`。
- React 工程启动。
- Ant Design Pro 基础能力保留。
- 项目代码初步梳理记录。

不做：

- 业务页面完整开发。
- 后端工程。
- 数据库和 Redis。

### 4.2 阶段 1：基础底座

必须完成：

- 三类布局。
- mock 登录。
- Umi model。
- 权限和菜单。
- 样式规范。
- service 层。
- mock 数据层。

不做：

- 完整后台 CRUD。
- AI 具体功能。

### 4.3 阶段 2：公开前台与内容阅读

必须完成：

- 首页。
- 内容中心。
- Markdown 阅读。
- 小册阅读。
- 项目页。
- 关于我。
- PDF 卡片和详情占位。

不做：

- PDF.js 在线阅读。
- Word 在线预览。
- AI 工具具体页面。

### 4.4 阶段 3：工作区与内容生产

必须完成：

- 工作台。
- 文档管理。
- 新建内容向导。
- Markdown 编辑器。
- 本地小册读取与管理。
- 收藏。
- 用量页占位 / mock。
- 个人设置。

不做：

- Word 在线编辑。
- 富文本协作。
- 小册 ZIP 上传到后端。
- 真实文件上传服务。

---

## 5. 阶段 0 详细计划：工程骨架

### 5.1 根目录 Monorepo

创建或更新：

```txt
package.json
pnpm-workspace.yaml
turbo.json
tsconfig.base.json
.editorconfig
.prettierrc
```

根目录脚本：

```json
{
  "scripts": {
    "dev": "turbo dev",
    "dev:react": "pnpm --filter user-web dev",
    "build": "turbo build",
    "build:react": "pnpm --filter user-web build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "format": "prettier --write ."
  }
}
```

### 5.2 克隆 Ant Design Pro

执行目标：

```bash
git clone --depth=1 https://github.com/ant-design/ant-design-pro.git apps/user-web
```

克隆后处理：

- 删除 `apps/user-web/.git`。
- 修改 `apps/user-web/package.json` 的 `name` 为 `user-web`。
- 保留 Ant Design Pro 的基础结构。
- 不在第一步大删模板能力，先跑起来再清理。
- 记录 clone 后的目录结构和关键文件职责。

必须优先识别这些文件：

| 文件 / 目录 | 处理方式 |
|---|---|
| `config/config.ts` | 保留，后续改路由、布局、主题 |
| `src/app.tsx` | 保留，用于 `getInitialState`、layout、request |
| `src/access.ts` | 保留，用于权限判断 |
| `src/models` | 保留并改造为共享 model 目录 |
| `src/services` | 保留并按模块重建 service |
| `mock` | 保留并按模块重建 mock |
| `src/global.less` | 保留，作为全局样式入口 |

### 5.3 共享类型包

创建：

```txt
packages/shared-types/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── common.ts
    ├── auth.ts
    ├── user.ts
    ├── permission.ts
    ├── content.ts
    ├── booklet.ts
    ├── workspace.ts
    ├── system.ts
    └── pagination.ts
```

首批类型：

- `ApiResponse<T>`
- `PaginationQuery`
- `PaginationResult<T>`
- `User`
- `UserRole`
- `PermissionCode`
- `MenuItem`
- `SystemPublicConfig`
- `ThemeConfig`
- `ContentItem`
- `ContentDetail`
- `ContentType`
- `ContentStatus`
- `ContentVisibility`
- `Booklet`
- `BookletChapter`
- `WorkspaceStats`

### 5.4 目录级规范

创建：

- `apps/user-web/AGENT.md`
- `packages/shared-types/AGENT.md`

`apps/user-web/AGENT.md` 必须包含：

- 页面通过 `services` 取数。
- 共享状态优先用 `src/models` / `useModel`。
- 不在页面散落 mock 数据。
- 样式优先沿用 Ant Design Pro 和公共样式层。
- 内容阅读和工作区组件优先写成可迁移的普通 React 组件。

### 5.5 阶段 0 验收

- `pnpm install` 成功。
- `pnpm dev:react` 成功启动。
- 浏览器能打开 React 应用。
- React 应用能 import `packages/shared-types`。
- 文档记录 clone 后目录梳理结果。

---

## 6. 阶段 1 详细计划：基础底座

### 6.1 Umi 数据共享模型

保留并使用 Ant Design Pro / Umi 提供的数据流能力。

建议结构：

```txt
src/models/
├── auth.ts          ← 当前用户、登录态、角色、权限
├── layout.ts        ← 当前布局区域、菜单折叠、导航状态
├── theme.ts         ← 主题 token、暗色/亮色、布局密度
├── system.ts        ← 站点名、首页配置、公开系统配置
├── content.ts       ← 内容筛选偏好、最近阅读、本地小册状态
└── workspace.ts     ← 工作区筛选、编辑草稿状态
```

`@@initialState` 负责：

- 当前用户。
- 权限点。
- 菜单。
- 系统公开配置。
- 主题配置。

`useModel` 使用规则：

- 跨页面共享状态放 `src/models`。
- 页面内部一次性状态用 `useState`。
- 表单状态交给 Ant Design Form 或编辑器组件。
- 不额外引入 Zustand，除非后续状态复杂到 Umi model 不够用。

### 6.2 布局规范

首版三套布局：

| 布局 | 路由 | 说明 |
|---|---|---|
| PublicLayout | `/`、`/content`、`/projects`、`/about` | 沿用 Ant Design Pro 视觉基调，做轻量内容站布局 |
| WorkspaceLayout | `/workspace/*` | 顶栏 + 侧栏，适合内容生产和管理 |
| AdminLayout | `/admin/*` | 仅保留入口和占位，本阶段不做完整 CRUD |

布局尺寸建议：

| 变量 | 默认值 | 说明 |
|---|---:|---|
| `--ph-header-height` | `56px` | 顶栏高度 |
| `--ph-sidebar-width` | `224px` | 工作区侧栏 |
| `--ph-content-max-width` | `1180px` | 公开页面最大内容宽 |
| `--ph-reading-width` | `820px` | 阅读正文最大宽 |
| `--ph-page-padding` | `24px` | 页面基础边距 |

### 6.3 样式规范

第一版沿用 Ant Design Pro / Ant Design 风格，不重新建立一套完全不同的视觉。

目录：

```txt
src/styles/
├── tokens.less       ← CSS 变量与 Ant Design token 对齐
├── globals.less      ← body、链接、滚动条、基础背景
├── layout.less       ← 页面布局、容器宽度、间距
├── typography.less   ← 阅读页 Markdown 排版
├── motion.less       ← 通用动画与过渡
└── utilities.less    ← 少量工具类
```

`src/global.less` 只做入口：

```less
@import './styles/tokens.less';
@import './styles/globals.less';
@import './styles/layout.less';
@import './styles/typography.less';
@import './styles/motion.less';
@import './styles/utilities.less';
```

规则：

- 不把大量页面样式塞进 `global.less`。
- 页面局部样式使用 CSS Modules。
- 公共视觉变量放 `tokens.less`。
- 阅读排版放 `typography.less`。
- 布局容器类放 `layout.less`。
- 不以 Tailwind 作为本阶段主要样式体系。

### 6.4 组件库策略

默认优先级：

1. Ant Design / Pro Components。
2. Ant Design Pro 现有布局和模板能力。
3. 成熟开源组件。
4. 自己封装薄业务组件。

本阶段建议依赖：

| 能力 | 建议 |
|---|---|
| 后台 / 工作区表格 | ProTable |
| 表单 | ProForm / Ant Design Form |
| Markdown 编辑 | 成熟开源编辑器，例如 `@uiw/react-md-editor` |
| Markdown 渲染 | `react-markdown` + `remark-gfm`，或编辑器自带预览能力 |
| 代码高亮 | 首版可用编辑器预览能力，后续再接 Shiki |
| AI 组件 | 本阶段不实现功能，后续使用 `@ant-design/x` |
| 图表 | 首版少量统计可用 Ant Design Charts 或 Recharts，非必须 |

### 6.5 权限与登录

使用 Ant Design Pro 登录页改造。

mock 用户：

| 用户 | 角色 | 用途 |
|---|---|---|
| `admin@example.com` | admin | 验证全部入口 |
| `editor@example.com` | editor | 验证内容生产 |
| `member@example.com` | member | 验证阅读和收藏 |

密码统一 mock 为：

```txt
123456
```

权限规则：

- `admin` 可看到后台入口，但后台只做占位或少量基础页面。
- `editor` 可进入工作区内容生产。
- `member` 可阅读、收藏、查看小册，不可创建内容。
- 未登录访问工作区跳转登录页。

### 6.6 阶段 1 验收

- 登录页可用。
- mock 登录能切换角色。
- 菜单根据角色变化。
- 三类布局可访问。
- `src/models` 正常被页面使用。
- `src/styles/*` 被 `global.less` 引入。
- service/mock 调用链跑通。

---

## 7. 阶段 2 详细计划：公开前台与内容阅读

### 7.1 页面范围

| 路由 | 页面 | 首版要求 |
|---|---|---|
| `/` | 首页 | Hero、最近分享、AI 工具入口占位、技术栈 |
| `/content` | 内容中心 | 筛选、搜索、类型、排序、卡片列表 |
| `/content/:id` | 内容详情 | 根据类型展示 Markdown / 小册入口 / PDF 占位等 |
| `/content/booklets/:id/chapters/:chapterId` | 小册章节阅读 | 小册列表、章节目录、正文、章节内目录 |
| `/projects` | 项目页 | 项目卡片 |
| `/about` | 关于我 | 个人介绍、技术栈、经历、联系方式 |

### 7.2 内容类型首版处理

| 类型 | 首版处理 |
|---|---|
| Markdown | 完整阅读 |
| 掘金小册 / 本地小册 | 完整章节阅读 |
| PDF | 卡片和详情占位，不做在线预览 |
| Word | 卡片和详情占位 |
| 富文本 | 卡片和详情占位 |
| 外链 | 卡片展示，点击跳转或详情页展示链接 |
| 项目 | 项目卡片展示 |

### 7.3 内容中心功能

筛选项：

- 关键字。
- 分类。
- 标签。
- 类型。
- 排序：最新 / 最多阅读。

状态：

- loading。
- empty。
- error。
- unauthorized。
- forbidden。

卡片字段：

- 封面。
- 标题。
- 类型。
- 摘要。
- 分类。
- 标签。
- 阅读数。
- 发布时间。
- 收藏按钮。

### 7.4 Markdown 阅读

功能：

- 标题、作者、时间、分类、标签。
- Markdown 正文渲染。
- 右侧目录。
- 代码块展示。
- 复制链接。
- 收藏。
- 回到顶部。

首版不强制：

- 服务端 Shiki。
- 阅读进度真实持久化。

但必须预留：

- `readingProgress` 类型。
- `saveReadingProgress` service。

### 7.5 小册阅读

功能：

- 左侧小册列表。
- 章节目录。
- 当前章节正文。
- 章节内目录。
- 上一章 / 下一章。
- 阅读进度展示。
- 返回内容中心。

数据来源：

- mock 小册。
- 本地文件夹 Markdown 小册解析结果。

### 7.6 阶段 2 验收

- 访客可打开首页和内容中心。
- 可打开 Markdown 文章阅读。
- 可打开小册章节阅读。
- PDF 内容显示占位说明，不报错。
- 收藏按钮在未登录时引导登录。
- 页面视觉沿用 Ant Design Pro / Ant Design 风格，布局稳定。

---

## 8. 阶段 3 详细计划：工作区与内容生产

### 8.1 页面范围

| 路由 | 页面 | 首版要求 |
|---|---|---|
| `/workspace` | 工作台 | 统计卡片、继续阅读、快捷入口 |
| `/workspace/content` | 文档管理 | 内容表格、筛选、状态切换 mock |
| `/workspace/content/new` | 新建内容向导 | 选择类型、基础信息、进入编辑/小册管理 |
| `/workspace/markdown` | Markdown 新建 | 编辑、预览、保存 mock |
| `/workspace/markdown/:id` | Markdown 编辑 | 编辑已有 mock 内容 |
| `/workspace/booklets` | 小册管理 | 本地小册列表、读取结果、打开阅读 |
| `/workspace/favorites` | 我的收藏 | 收藏列表 |
| `/workspace/usage` | 我的用量 | Token 用量 mock / 占位 |
| `/workspace/profile` | 个人设置 | 基础资料 mock |

### 8.2 Markdown 编辑器

使用成熟组件，不自研。

建议能力：

- 左右分栏编辑 / 预览。
- 移动端 Tabs 切换。
- 标题输入。
- 基础信息抽屉：分类、标签、可见性、摘要。
- 保存草稿 mock。
- 发布 mock。
- 离开页面未保存提醒。

### 8.3 本地小册读取

这是阶段 3 必达能力。

#### 8.3.1 支持的目录结构

推荐结构：

```txt
local-booklets/
└── react-basic/
    ├── meta.json
    ├── 01-intro.md
    ├── 02-setup.md
    └── 03-components.md
```

也支持没有 `meta.json` 的简化结构：

```txt
local-booklets/
└── react-basic/
    ├── 01-intro.md
    ├── 02-setup.md
    └── 03-components.md
```

`meta.json` 建议字段：

```json
{
  "title": "React 基础小册",
  "author": "本地文档",
  "summary": "用于学习 React 的本地小册",
  "cover": "",
  "categorySlug": "frontend",
  "tags": ["React", "Frontend"]
}
```

#### 8.3.2 读取方式

由于浏览器不能直接任意读取本地文件夹，首版采用开发期 Node 脚本扫描仓库内指定目录：

```txt
content-local/booklets/
```

脚本建议：

```txt
apps/user-web/scripts/sync-local-booklets.ts
```

输出到：

```txt
apps/user-web/mock/data/local-booklets.generated.ts
```

调用方式：

```bash
pnpm --filter user-web sync:booklets
```

根目录可加：

```bash
pnpm sync:booklets
```

#### 8.3.3 解析规则

- 每个子文件夹视为一本小册。
- 优先读取 `meta.json`。
- 如果没有 `meta.json`，用文件夹名生成标题。
- 只读取 `.md` 文件。
- 按文件名前缀数字排序，例如 `01-`、`001-`。
- 没有数字前缀时按文件名排序。
- 章节标题优先取 Markdown 第一个 `# 标题`。
- 没有一级标题时用文件名生成标题。
- 输出 `Booklet` 和 `BookletChapter` mock 数据。

#### 8.3.4 错误处理

| 场景 | 处理 |
|---|---|
| 目录不存在 | 生成空数组，并提示如何创建目录 |
| `meta.json` JSON 格式错误 | 跳过 meta，记录 warning |
| 某个 `.md` 为空 | 仍生成章节，但标记为空内容 |
| 文件名重复 | 用路径 hash 生成稳定 ID |
| 没有任何 `.md` | 不生成该小册，记录 warning |

#### 8.3.5 页面能力

`/workspace/booklets` 中提供：

- 本地小册列表。
- 章节数量。
- 最近同步时间。
- 打开阅读。
- 查看同步 warning。
- 重新同步说明。

注意：浏览器页面不直接执行本地扫描；同步由命令完成。

### 8.4 文档管理

功能：

- 表格展示 mock 内容。
- 支持类型、状态、可见性、关键字筛选。
- 编辑 Markdown。
- 打开小册管理。
- PDF / Word / 富文本显示占位。
- 发布、归档、删除只做 mock 状态切换。

### 8.5 阶段 3 验收

- editor/admin 可进入工作区。
- member 访问内容生产页面时看到无权限。
- Markdown 可新建、编辑、预览、保存 mock。
- `content-local/booklets` 下的本地 Markdown 小册可同步到 mock 数据。
- 同步后能在内容中心和小册阅读页打开。
- PDF 只显示占位，不做在线阅读。

---

## 9. 后台与 AI 的本阶段边界

### 9.1 后台管理

本阶段不做完整 admin CRUD。

允许做：

- 后台入口。
- 后台首页占位。
- 无权限校验。
- 后续模块菜单占位。

不做：

- 用户管理 CRUD。
- 角色管理 CRUD。
- 内容后台审核 CRUD。
- 分类标签后台管理。
- AI 配置后台。

### 9.2 AI

本阶段不做 AI 功能。

允许做：

- 在依赖策略中明确后续使用 `@ant-design/x`。
- 预留 `src/components/ai` 目录。
- 内容页“引用到 AI”按钮可先 disabled 或跳转到占位页。

不做：

- Chat 页面。
- 流式输出。
- 文本生成。
- 图片生成。
- AI 历史。
- Token 真实扣减。

---

## 10. 文件修改范围

预计会修改或新增：

```txt
package.json
pnpm-workspace.yaml
turbo.json
tsconfig.base.json
apps/user-web/**
packages/shared-types/**
content-local/booklets/.gitkeep
docs/implementation/react-first/phase-0-3.md
study/features/react-first-phase-0-3.md
```

说明：

- `content-local/booklets/` 用作本地小册开发期输入目录。
- 示例小册可放一个极小 demo，避免空目录无法提交。
- 真实用户本地小册可以后续复制到该目录，或在脚本中配置路径。

---

## 11. 推荐依赖

以 Ant Design Pro clone 后实际依赖为准，额外依赖需要谨慎添加。

阶段 0-3 可能需要：

| 依赖 | 用途 |
|---|---|
| `turbo` | Monorepo 任务编排 |
| `typescript` | 根目录 / shared-types |
| `@uiw/react-md-editor` | Markdown 编辑器 |
| `react-markdown` | Markdown 渲染 |
| `remark-gfm` | GFM 支持 |
| `gray-matter` | 可选：解析 Markdown frontmatter |
| `fast-glob` | 本地小册脚本扫描 |
| `tsx` | 执行 TypeScript 脚本 |
| `@ant-design/x` | 后续 AI 组件预留，可阶段 5 再安装 |

原则：

- 本阶段如果不做 AI 页面，可以不安装 `@ant-design/x`，只在文档和目录上预留。
- Markdown 编辑器依赖只选一个成熟方案，避免重复引入多个编辑器。

---

## 12. 验证命令

阶段完成前至少执行：

```bash
pnpm install
pnpm dev:react
pnpm --filter user-web sync:booklets
pnpm --filter user-web lint
pnpm --filter user-web typecheck
pnpm build:react
```

如果 Ant Design Pro 模板没有 `typecheck` 脚本，需要补齐或在交付说明中说明替代验证方式。

前端页面完成后，需要用浏览器验收：

- 首页可打开。
- 内容中心可打开。
- Markdown 阅读可打开。
- 小册章节可打开。
- 工作区可登录后打开。
- 本地小册同步后可阅读。
- 控制台无本次改动引入的新报错。

---

## 13. 手动验收路径

1. 执行 `pnpm dev:react`，访问 React 应用首页。
2. 用 `editor@example.com / 123456` 登录，进入工作区。
3. 在 `content-local/booklets/` 放入一本 Markdown 小册，执行 `pnpm --filter user-web sync:booklets`。
4. 打开 `/workspace/booklets`，确认小册和章节出现。
5. 从小册管理进入阅读页，切换上一章 / 下一章。
6. 打开 `/content`，筛选小册和 Markdown。
7. 打开 `/workspace/markdown`，新建一篇 Markdown，保存草稿并预览。

---

## 14. 交付文档要求

阶段 0-3 完成后必须补：

- `docs/implementation/react-first/phase-0-3.md`
- `study/features/react-first-phase-0-3.md`
- 更新 `docs/implementation/README.md`
- 更新 `study/features/README.md`

实现文档要说明：

- 工程结构。
- Ant Design Pro 改造点。
- Umi model 调用链。
- service/mock 调用链。
- 本地小册同步脚本。
- 内容中心数据流。
- 工作区内容生产数据流。
- 后续接 NestJS API 的替换点。

