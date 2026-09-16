# 前台视觉规范（首版决策）

> 状态：✅ 已确定（2026-07-01）
> 适用范围：公开前台 `PublicLayout` 及可迁移至 Next.js 的展示组件
> 说明：无独立设计稿时，以 Ant Design Pro 体系 + 本项目 `tokens.less` / `public-theme.less` 为准。

---

## 1. 总体原则

- **不另起视觉体系**：沿用 Ant Design v6 + Pro Components 默认交互与组件形态。
- **双主题分离**：公开区 `publicSettings` + CSS 变量；工作区 Pro `SettingDrawer`（见 `apps/user-web/AGENT.md` §6）。
- **可迁移**：公开页禁止硬编码色值，组件尽量纯展示，便于阶段 7 迁 Next.js。

---

## 2. 布局

| 项 | 决策 |
|---|---|
| 公开导航位置 | **顶部**（`navigation.public_position=top`）；左/右导航留阶段 4 后台配置 |
| 顶栏高度 | `--ph-header-height: 56px` |
| 内容最大宽度 | `--ph-content-max-width: 1180px`（列表、首页等） |
| 阅读正文宽度 | `--ph-reading-width: 820px`（Markdown 详情） |
| 小册阅读 | 四栏布局，变量见 `tokens.less` `--ph-booklet-*` |
| 页面内边距 | `--ph-page-padding: 24px`；移动端可缩至 16px（阶段 4 响应式补强） |

---

## 3. 色彩与主题

| 项 | 决策 |
|---|---|
| 主色（公开默认） | `#1677ff`（`publicDefaultSettings.colorPrimary`） |
| 语义变量 | `--ph-bg-*`、`--ph-text-*`、`--ph-code-bg`（`public-theme.less`） |
| 暗色模式 | 公开区 `PublicThemeDrawer` 切换；根类 `.ph-public-dark` |
| 工作区 | ProLayout token，与公开区互不影响 |

---

## 4. 字体与排版

| 项 | 决策 |
|---|---|
| 字体栈 | 系统字体：`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif` |
| 正文字号 | 14px（Ant Design 默认 `fontSize`） |
| 阅读标题 | 遵循 `typography.less`；Markdown `h1–h3` 与目录 slug 对齐 |
| 代码 | `highlight.js` + `MarkdownCodeBlock`；等宽字体走 antd code token |

---

## 5. 间距与圆角

- 间距节奏：8px 网格（`--ph-space-sm/md/lg/xl`）。
- 圆角：`--ph-radius: 8px`，卡片与按钮跟随 Ant Design token。
- 动效：`--ph-motion-fast: 160ms`、`--ph-motion-base: 240ms`（`motion.less`）。

---

## 6. 组件用法

| 场景 | 组件 |
|---|---|
| 内容卡片 | `ContentCard` |
| 列表/表格 | `ProTable`（公开内容中心、工作区） |
| 空/错/无权限 | `EmptyState` / `ErrorState` / `ForbiddenState` |
| 页面容器 | 公开区自定义布局；工作区 `PageContainer` |
| 标签/类型 | `ContentTypeTag`、`StatusBadge` |

---

## 7. 站点信息（暂用默认）

| 项 | 当前值 | 说明 |
|---|---|---|
| 站点名称 | `Personal Hub`（mock `systemConfig.siteName`） | 正式域名与品牌名**待后续确认** |
| 访问地址 | 开发 `http://localhost:8000` | 未定域名前直接用端口访问 |
| Logo | 文字站点名（顶栏 `ph-public-logo`） | 图片 Logo 留后台配置（阶段 4） |

---

## 8. 后续扩展（已规划，非阻塞）

- 后台可配：`theme-navigation-config-prd.md` 中左/右导航、Logo、SEO、Hero 风格等 → 阶段 4 运营台 + 阶段 6 API。
- 独立视觉稿 / 品牌手册：有稿后覆盖本节默认值即可。
