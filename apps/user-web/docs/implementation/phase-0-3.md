# React-first 阶段 0–3 合并实现说明

> 状态：✅ 已完成（含阶段 4 前补强项）
> 最后更新：2026-06-28
> 对应 PRD：[../../prd/react-first/phase-0-3-foundation-prd.md](../../prd/react-first/phase-0-3-foundation-prd.md)

本文件汇总阶段 0–3 的交付、调用链与阶段 4 前补强，分阶段细节仍见：

- [phase-0-structure.md](./phase-0-structure.md)
- [phase-1-foundation.md](./phase-1-foundation.md)
- [phase-2-public-reading.md](./phase-2-public-reading.md)
- [phase-3-workspace.md](./phase-3-workspace.md)

---

## 1. 总体交付

| 阶段 | 核心能力 | 状态 |
|---|---|---|
| 0 | Monorepo、`apps/user-web`（Ant Design Pro v6）、`shared-types`、`content-local` 示例 | ✅ |
| 1 | 登录/权限、`@@initialState`、`access.ts`、三类布局、mock 分层、样式规范 | ✅ |
| 2 | 公开前台、内容中心、Markdown/小册阅读、收藏/进度 mock | ✅ |
| 3 | 工作区 CRUD mock、Markdown 编辑、本地小册同步、用量/收藏/设置 | ✅ |

启动：`nvm use 22 && pnpm install && pnpm dev:react` → http://localhost:8000

---

## 2. 权限与 `@@initialState`（无需单独 `auth.ts`）

**Ant Design Pro / Umi Max 的标准做法**：

- `getInitialState`（`src/app.tsx`）在启动期拉取 `currentUser`、`permissions`、`menu`、`systemConfig`。
- `src/access.ts` 基于 `initialState.currentUser.permissions` 生成 `canWorkspace`、`canAdmin` 等。
- 路由 `access: 'canWorkspace'` 控制工作区入口。

PRD 曾建议 `src/models/auth.ts`，在本项目中**不必再拆一层**：登录态与权限已落在 `@@initialState`，与 Pro 模板一致。若后续需要跨页面封装「登出 / 刷新权限」等动作，可再抽 `models/auth.ts` 作为**薄封装**，而不是迁移权限数据源。

---

## 3. 布局与主题（公开 / 工作区分离）

| 区域 | 布局 | 主题状态 | 设置入口 |
|---|---|---|---|
| 公开前台 | `PublicLayout`（`layout: false` 路由） | `initialState.publicSettings` | 顶栏设置 → `PublicThemeDrawer`（亮色/暗色 + 主题色） |
| 工作区/后台 | ProLayout（`mix`） | `initialState.settings` | 顶栏设置 → `SettingDrawer` |

实现要点：

- `publicSettings` 经 `ConfigProvider` 作用于公开区；`settings` 经 ProLayout 作用于工作区。
- 公开区**暂不展示多语言按钮**（公开页文案未做 i18n）；工作区保留中英文切换（`LangDropdown` 仅 `zh-CN` / `en-US`）。

---

## 4. 工作区菜单与 i18n

- **菜单选中修复**：工作台路径由 `/workspace` 改为 `/workspace/dashboard`，避免前缀匹配导致始终高亮。
- **菜单 i18n**：`mock/data/menus.ts` 的 `name` 存 locale id（如 `workspace.dashboard`），`localizeMenu()` 在 `app.tsx` 的 `menuDataRender` 中翻译。
- **页面固定文案**：`src/locales/{zh-CN,en-US}/workspace.ts`，工作区各页 `useIntl` 引用。

---

## 5. 内容阅读补强

### 5.1 小册四栏布局

- 路由：`/content/booklets/:id/chapters/:chapterId`
- 全宽 `PublicLayout fullWidth` + `booklet-reader.less`
- 小册列表 / 章节目录可折叠；进入章节时默认收起列表、展开目录
- 正文 `min-width: 666px`；侧栏高度 `100vh - header`，内部滚动

### 5.2 目录滚动高亮

- `TocPanel` 使用 `IntersectionObserver` 跟踪当前可见标题
- `MarkdownViewer` 为 `h2`/`h3` 注入 `id`，与目录 `anchor` 对齐

### 5.3 内容类型与阶段 4 预览选型

| 类型 | 阶段 0–3 | 计划组件（见 `src/config/documentViewers.ts`） |
|---|---|---|
| Markdown | `react-markdown` + `remark-gfm` + `highlight.js` | 图床代理 `mock/dev.ts` → `/api/dev/proxy-image` |
| 小册 | 章节 Markdown | 同上 |
| PDF | 占位说明 | **react-pdf** |
| Word | 占位说明 | **docx-preview** |
| 富文本 | 占位说明 | **Textbus** |

### 5.4 公开区主题（`public-theme.less`）

- 根节点：`.ph-public-layout` / `.ph-public-dark`，语义变量 `--ph-bg-*`、`--ph-text-*`
- 状态：`initialState.publicSettings`，与工作区 `settings` 分离
- 新增公开页规范见 `apps/user-web/AGENT.md` §6.1

---

## 6. 关键文件索引

| 模块 | 路径 |
|---|---|
| 运行时 / 布局 | `src/app.tsx`、`src/access.ts`、`src/layouts/PublicLayout.tsx` |
| 主题 | `src/config/publicDefaultSettings.ts`、`src/components/PublicThemeDrawer/` |
| 菜单 i18n | `src/utils/localizeMenu.ts`、`mock/data/menus.ts`、`src/locales/*/workspace.ts` |
| 小册阅读 | `src/pages/public/BookletChapter/`、`src/styles/booklet-reader.less` |
| 目录 | `src/components/shared/TocPanel/`、`MarkdownViewer/` |
| Mock | `mock/content.ts`、`mock/workspace.ts`、`mock/data/contents.ts` |
| 本地小册 | `src/scripts/sync-local-booklets.ts`、`content-local/` |

---

## 7. 验证方式

1. **工作区菜单**：登录 admin → 打开「文档管理」，侧栏仅「文档管理」高亮，「工作台」不高亮。
2. **工作区 i18n**：顶栏切 English → 菜单与 Dashboard 卡片标题变为英文。
3. **公开主题**：公开页设置 → 切换暗色/主题色 → 仅公开区变化；工作区 SettingDrawer 切换不影响公开区。
4. **目录高亮**：打开 `/content/c-md-01`，滚动正文，右侧目录当前项高亮。
5. **mock 类型**：内容中心筛选或列表可见 PDF / Word / 富文本 / 项目示例。
6. **构建**：`pnpm exec tsc --noEmit`、`pnpm build:react`。

---

## 8. 阶段 0–3 后补丁（进入阶段 4 前）

| 项 | 实现 |
|---|---|
| 工作区暗色混合主题 | 根级 `ThemeProvider`（`history` + `themeRuntime`，**不可**在 rootContainer 用 `useLocation`/`useModel`）+ `ThemeRuntimeSync` + `app.tsx` `navTheme` |
| 公开暗色顶栏 | `public-theme.less` 导航 flex 布局 + 暗色链接对比度 |
| 目录 `**` / 点击失效 | `utils/markdown.ts` slug 规则；`TocPanel` 归一化；`sync:booklets` 同步 TOC |
| 代码块 | `MarkdownCodeBlock`：折叠、语言、复制（`copyToClipboard`） |
| 章节切换滚顶 | `BookletChapter` 切换 `chapterId` 时 `scrollTo(0)` |

---

## 9. 已知限制（阶段 4+）

- 阅读进度、工作区 CRUD 仍为 mock，无持久化。
- Markdown 编辑器移动端 Tabs 未做（PRD 可选）。
- 公开区业务文案、mock 动态内容未做 i18n。
- PDF/Word/Textbus 仅选型与占位，未安装依赖。

- PDF/Word/Textbus 仅选型与占位，未安装依赖（阶段 4 PRD 见 [../../prd/react-first/phase-4-admin-preview-prd.md](../../prd/react-first/phase-4-admin-preview-prd.md)）。

---

## 10. 学习文档

见 [../../../study/features/react-first-phase-0-3.md](../../../study/features/react-first-phase-0-3.md)。
