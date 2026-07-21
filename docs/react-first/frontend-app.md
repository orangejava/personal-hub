# `apps/react-web` 前端应用设计

> 状态：✅ `apps/react-web` 当前实现说明；后续调整需以实际目录为准
> 最后更新：2026-06-27
> 目标：定义基于 Ant Design Pro 改造后的 React 首版应用结构、路由、模块和开发边界。

---

## 1. 应用定位

`apps/react-web` 是首版 React Web 应用，用于快速完成当前产品文档中描述的主要功能：

- 公开前台。
- 登录后工作区。
- 后台管理台。
- AI 工具平台。
- 内容阅读与内容生产流程。

它不替代后续的 NestJS API，也不阻止部分页面迁移到 Next.js。它的核心价值是让产品和业务链路先完整跑起来。

阶段 0-3 优先完成工程、基础底座、内容中心、本地小册读取和工作区内容生产；后台完整 CRUD 与 AI 工具具体功能后续阶段再做。

---

## 2. 初始化来源

确认使用 Ant Design Pro 官方仓库完整克隆后改造：

```bash
git clone --depth=1 https://github.com/ant-design/ant-design-pro.git apps/react-web
```

克隆后需要做的第一批清理：

- 删除与 personal-hub 无关的示例页面。
- 保留 Layout、权限、菜单、请求、mock、登录等可复用基础能力。
- 保留 Umi / Ant Design Pro 的 `src/models`、`useModel`、`@@initialState` 数据共享能力。
- 将包名改为 `react-web`。
- 接入根目录 pnpm workspace。
- 确认可以引用 `packages/shared-types`。

---

## 3. 路由结构

建议首版路由：

```txt
/
├── /content
├── /content/:id
├── /content/booklets/:id/chapters/:chapterId
├── /ai                         ← 阶段 0-3 可占位，阶段 5 完整实现
├── /ai/chat                    ← 阶段 5
├── /ai/text                    ← 阶段 5
├── /ai/image                   ← 阶段 5
├── /projects
├── /about
├── /auth/login
├── /workspace
├── /workspace/content
├── /workspace/booklets
├── /workspace/markdown
├── /workspace/word
├── /workspace/richtext
├── /workspace/favorites
├── /workspace/ai/history
├── /workspace/usage
├── /workspace/profile
└── /admin
    ├── /admin/users
    ├── /admin/roles
    ├── /admin/content/list
    ├── /admin/content/booklets
    ├── /admin/content/categories
    ├── /admin/content/tags
    ├── /admin/files
    ├── /admin/ai/config
    ├── /admin/ai/stats
    ├── /admin/homepage
    ├── /admin/menus
    ├── /admin/system/config
    └── /admin/logs
```

---

## 4. 目录结构建议

Ant Design Pro 的真实目录以模板为准，改造后建议保持类似结构：

```txt
apps/react-web/
├── config/                    ← Umi 配置、路由、代理、主题变量
├── mock/                      ← Umi mock 接口
├── public/                    ← 静态资源
├── src/
│   ├── app.tsx                ← Umi 运行时配置
│   ├── access.ts              ← 权限判断
│   ├── global.tsx             ← 全局初始化
│   ├── global.less            ← 全局样式入口
│   ├── layouts/               ← 全局布局与分区布局
│   ├── pages/
│   │   ├── public/            ← 公开前台页面
│   │   ├── workspace/         ← 登录后工作区页面
│   │   ├── admin/             ← 后台管理台页面
│   │   ├── ai/                ← AI 工具页面，阶段 0-3 仅占位
│   │   └── auth/              ← 登录注册页面
│   ├── components/
│   │   ├── base/              ← 基础组件封装
│   │   ├── public/            ← 前台专属组件
│   │   ├── workspace/         ← 工作区专属组件
│   │   ├── admin/             ← 后台专属组件
│   │   ├── ai/                ← AI 专属组件，后续优先基于 @ant-design/x
│   │   └── shared/            ← 跨模块通用组件
│   ├── services/              ← 接口请求函数
│   ├── models/                ← Umi 数据共享 model
│   ├── hooks/                 ← 自定义 hooks
│   ├── constants/             ← 本应用常量
│   ├── scripts/               ← 本地小册同步等开发期脚本
│   ├── utils/                 ← 工具函数
│   ├── styles/                ← 主题、动画、布局样式
│   └── types/                 ← React 应用本地类型
└── package.json
```

---

## 5. 模块划分规则

### 5.1 公开前台

位置：`src/pages/public`、`src/components/public`

包含：

- 首页。
- 内容中心。
- 内容阅读。
- AI 工具中心入口占位。
- 项目 / 作品。
- 关于我。

约束：

- 第一版可以沿用 Ant Design Pro / Ant Design 的视觉基调，但公开前台需要通过布局和内容排版避免做成后台表格风格。
- 和未来 Next.js 重写强相关的组件，应尽量写成纯展示组件，减少 Umi 运行时依赖。
- 数据从 `services` 获取，不在页面写死。

### 5.2 工作区

位置：`src/pages/workspace`、`src/components/workspace`

包含：

- 工作台。
- 文档管理。
- 小册管理。
- Markdown / Word / 富文本工具。
- 收藏。
- AI 历史后续实现，本阶段可在菜单中隐藏或占位。
- 用量。
- 个人设置。

约束：

- 优先使用 Ant Design / Pro Components 提升开发效率。
- 工作区布局与后台布局可以相似，但菜单和权限语义必须区分。

### 5.3 后台管理台

位置：`src/pages/admin`、`src/components/admin`

包含：

- 用户、角色、权限。
- 内容、分类、标签、文件。
- AI 配置与统计。
- 首页、菜单、系统配置、日志。

约束：

- 优先使用 ProTable、ProForm、ModalForm、DrawerForm。
- 后台页面必须走权限判断。
- 表格列、筛选项、表单字段应尽量贴近已有 PRD 和未来 API 字段。

### 5.4 AI 工具

位置：`src/pages/ai`、`src/components/ai`

包含：

- 工具广场。
- Chat。
- 文本生成。
- 图片生成。

约束：

- 阶段 0-3 暂不实现 AI 功能。
- 后续 AI 功能优先使用 `@ant-design/x`，不自研完整 AI 聊天基础组件。
- 消息、会话、模型、用量等类型后续必须沉淀到共享类型或稳定本地类型。
- 不在前端写真实厂商 Key。

---

## 6. 请求与状态约定

页面调用顺序：

```txt
page/component
  → services/module.service.ts
  → request 封装
  → mock 接口
  → mock data
```

不推荐：

- 页面里直接 import mock JSON。
- 页面里直接拼接大量临时数据。
- 每个页面自己处理一套响应结构。

推荐：

- `services/content.ts`
- `services/auth.ts`
- `services/workspace.ts`
- `services/admin.ts`
- `services/ai.ts`
- `services/system.ts`

---

## 7. 样式边界

第一版沿用 Ant Design Pro 现有观感，但需要提前做好可扩展样式规范：

- 公共变量放 `src/styles/tokens.less`。
- 全局基础样式放 `src/styles/globals.less`。
- 页面布局规范放 `src/styles/layout.less`。
- 阅读页排版放 `src/styles/typography.less`。
- 页面局部样式使用 CSS Modules。
- `src/global.less` 只作为样式入口，不堆业务样式。
- 不要在每个页面随意写独立色值。
- 动画以克制的过渡为主，避免影响阅读和后台操作效率。

---

## 8. 本地小册读取

阶段 3 必须支持读取本地文件夹下的 Markdown 小册。

约定：

- 输入目录：`content-local/booklets/`
- 同步脚本：`apps/react-web/scripts/sync-local-booklets.ts`
- 输出数据：`apps/react-web/mock/data/local-booklets.generated.ts`
- 页面入口：`/workspace/booklets`
- 阅读入口：`/content/booklets/:id/chapters/:chapterId`

浏览器不能直接扫描任意本地文件夹，所以首版通过 Node 脚本把仓库内小册目录转成 mock 数据。

---

## 9. 首版验收标准

- `apps/react-web` 能在 Monorepo 中启动。
- 首页、内容中心、工作区、后台占位至少有可访问页面。
- mock 登录后能切换用户角色。
- 菜单能根据角色展示不同入口。
- 内容列表、内容详情、小册章节、工作区表格都来自 service/mock。
- `packages/shared-types` 至少被 React 工程成功引用一次。
- `content-local/booklets` 下的小册能同步并在页面中阅读。
