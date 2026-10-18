# 主题、性能与 UI 优化 PRD

> 状态：阶段 A `theme-config`、阶段 B `perf-dashboard`、阶段 C 首页 `home-showcase` 均已完成并验收；新增体验优化需求另立 PRD 排期
> 最后更新：2026-10-16
> Worktree：原拆为 `theme-config`（阶段 A）、`perf-dashboard`（阶段 B 基线与面板）、`home-showcase`（阶段 C 首页）；三个 worktree 已完成并清理。见 [README.md](./README.md)
> 计划评分（plan-review，百分制，2026-10-02）：阶段 A（`theme-config`）92，可以开工。阶段 B 的 Loading / Skeleton 与阶段 C 的其余页面后置，不计入本期。性能面板与首页改版的分数见各自 PRD。
> 关系：承接 `apps/user-web/docs/prd/theme-navigation-config-prd.md` 的后置项，并新增加载速度、Loading 和页面交互优化范围。

## 1. 目标

首版已上线，下一步需要提升面试展示质量和日常使用体验。

本 PRD 覆盖：

- 主题剩余 UI
- 导航布局配置
- Logo / favicon / SEO / 功能开关
- 网站加载速度
- Loading 与 Skeleton 体验
- 公开页、阅读页、AI 工作台和关键表单交互优化

## 2. 不做

- 全站重设计
- 更换 UI 框架
- Next.js 迁移
- Flutter
- 可视化页面搭建器
- 多租户主题市场

## 3. 阶段 A：主题剩余 UI

### 3.1 后台表单

> 由 `theme-config` worktree 落地。Logo、favicon 上传复用骨架里的 `ImageFileField`，用途固定为已有的 `COVER`。允许 `image/jpeg`、`image/png`、`image/webp`、`image/gif`，单文件不超过 5 MB，与 `apps/server/src/modules/file/file-policy.ts` 的 COVER 默认一致。不接受 `.ico` 和 `image/svg+xml`（SVG 在 MIME 拒绝列表里）。favicon 用 png 或 webp，经签名 URL 放进 `rel=icon`。格式不对时走现有上传错误，不新增文件用途。不实现首屏透明顶栏，也不把 `publicBlur` 做成「滚动后毛玻璃」。该字段保持现有存储，首页顶栏维持不透明。见 [home-showcase-prd.md](../../../apps/user-web/docs/prd/home-showcase-prd.md)。

配置组已经拆开，表单跟着组走，避免一个保存按钮写错组：

| 页面 | 配置组 | 本阶段补什么 |
| --- | --- | --- |
| `apps/admin-web/src/pages/admin/SystemSite/index.tsx` | `site.general` | 已有站点名、描述。补关键词、Logo、favicon。站点名就是 SEO 标题，描述就是 SEO 描述，不再另造一套标题字段 |
| `apps/admin-web/src/pages/admin/SystemTheme/index.tsx` | `site.theme` | 已有主色、圆角、模式。补 `colorSecondary`、`colorAccent`、`allowUserSwitch`（主题切换器）和一栏预览 |
| 同上，第二张卡片单独保存 | `site.navigation` | 只改 `publicPosition`：`top` / `left` / `right`。不在这次改 `publicBlur` |
| `apps/admin-web/src/pages/admin/AiConfig/index.tsx` 品牌设置 | `ai.branding` | 补已有字段 `aiEnabled`。这是 AI 入口开关，不在主题页再做一份 |

项目入口不新增开关。公开菜单里「项目」的 `visible` 已经能关掉入口，主题页不再复制一份。

不新建 `site.feature`。旧主题 PRD 里的三项分别落到上表已有字段。

### 3.2 前台应用配置

视口用现有 `useViewportBand`，不另起断点。

| 条件 | 导航 |
| --- | --- |
| 桌面（≥ 992）且不是矮屏，`publicPosition=top` | 保持现在的顶栏 |
| 桌面且不是矮屏，`left` / `right` | 侧栏宽 240px，内容区让出这段宽度。菜单超出视口时只在侧栏内部滚动。`PublicHeaderActions` 整块移到侧栏底部，内部不改 |
| 手机（≤ 767）、平板（768–991）或矮屏（高度 ≤ 499） | 不论配置是顶还是侧，都用现在的 Drawer。侧栏不占内容宽度 |
| Markdown / 小册阅读页 | 公共导航收成现有 Drawer，避免和章节目录并排 |

Logo 继续用已经签名的 `logoUrl`。favicon 现在只在服务端存 `faviconFileId`，公开配置还没签名。本阶段按 Logo 的做法补 `faviconUrl`，并在 `packages/api-client` 的 `mapPublicSiteConfig` 里带上 `keywords` 和 `faviconUrl`。

SEO 只走运行时 Helmet，不在构建期写死。`app.tsx` 的 `rootContainer` 放一份：`title` 用 `siteName`，`meta description` 用 `siteDescription`，`meta keywords` 用 `keywords`，`link rel=icon` 用 `faviconUrl`。登录等页面自己的 Helmet 仍可覆盖标题。空 Logo、空 favicon 时不渲染对应节点，沿用现有站点名文字。

主题 token 继续从 `getInitialState` 里的公开配置注入。本阶段把辅助色和强调色一并写入，不另开主题接口。

`PublicLayout` 在 `aiEnabled === false` 时去掉路径以 `/ai` 开头的菜单项。直接打开 `/ai` 仍然可以进入，避免收藏地址变成 404。`allowUserSwitch === false` 时，`PublicHeaderActions` 不渲染主题按钮，账号入口不动。项目入口只跟随菜单 `visible`，本 worktree 不改菜单管理页。favicon 签名加在 `apps/server/src/modules/system/system.service.ts`，和现有 `logoUrl` 同一处。

路径含 `/content/booklets/` 或匹配内容详情 `/content/:id`（不是列表 `/content`）时，强制沿用现在的 Drawer。这些页已经有 `TocPanel` 或章节目录，桌面侧栏不再出现。

`colorSecondary`、`colorAccent` 交给现有主题运行时注入 ConfigProvider，不另写一套主题状态。

**预览**：主题页第一张卡片下方，用表单里尚未保存的主色、辅助色、强调色和圆角画一条假顶栏：站点名、文字「首页 / 内容 / 关于」、一个圆形按钮。第二张卡片若选了左或右，预览改成 240px 侧栏加内容条，不再只画顶栏。不请求公开站点，不嵌 iframe。管理端宽度小于 768px 时，预览落到表单下面。

### 3.2.1 阶段 A 文件

| 文件 | 改什么 |
| --- | --- |
| `apps/admin-web/src/pages/admin/SystemSite/index.tsx` | 补关键词、Logo、favicon。保存仍只写 `site.general` |
| `apps/admin-web/src/pages/admin/SystemTheme/index.tsx` | 第一张卡片补辅助色、强调色、`allowUserSwitch` 和预览，只写 `site.theme`。第二张卡片只写 `publicPosition`，保留 `site.navigation` 的其他字段 |
| `apps/admin-web/src/services/admin/index.ts` | `updateAdminSystemConfig` 带上关键词和两个文件 ID。新增导航保存，不把导航字段塞进主题保存 |
| `apps/admin-web/src/pages/admin/AiConfig/index.tsx` | 品牌设置增加 `aiEnabled` 开关 |
| `apps/server/src/modules/system/system.service.ts` | `faviconFileId` 签成 `faviconUrl` |
| `packages/shared-types/src/system.ts`、`packages/api-client/src/system.ts` | 公开对象增加 `keywords`、`faviconUrl`。这是冲突表里的唯一例外，其它 worktree 不改这两处 |
| `apps/user-web/src/app.tsx` | `rootContainer` 放 Helmet |
| `apps/user-web/src/layouts/PublicLayout.tsx` | 顶 / 左 / 右，以及阅读页强制 Drawer |
| `apps/user-web/src/layouts/PublicHeaderActions.tsx` | 按 `allowUserSwitch` 隐藏主题按钮 |

页面拿到的是解包后的配置对象。写失败走全局 toast。加载失败用现有 `ErrorState`，不写入半份配置。

### 3.3 验收

1. 打开管理端「站点配置」`/admin/system/site`，填写关键词，用 `ImageFileField` 上传 png Logo 和 png favicon，保存。再试一个 `.svg`，应看到现有上传错误，配置不被改写。
2. 刷新用户端首页。浏览器标题是站点名；元素面板里有 description、keywords；favicon 的地址是签名 URL。空 favicon 时不输出 icon 节点。
3. 打开 `/admin/system/theme`，第二张卡片把导航改成左侧。保存前，预览应变成 240px 侧栏而不是顶栏。保存后在桌面 1440×900 的首页：侧栏宽 240px，正文从侧栏右侧开始，账号入口在侧栏底部。再改成右侧，正文改到侧栏左侧。顶栏仍然不透明。
4. 同一套左侧配置下，把窗口调到 390×844、820×1180、1280×480。只有菜单按钮和 Drawer，没有固定侧栏，页面不横向滚动。
5. 打开 `/content/booklets/<id>/chapters/<chapterId>` 和一篇 `/content/<id>`。章节目录或 `TocPanel` 还在，公共导航是 Drawer。
6. 关掉「允许用户切换」并保存第一张卡片，刷新首页：主题按钮消失，账号入口还在。主色改成一个明显颜色后，首页跟着变，导航位置不被这次保存冲掉。
7. AI 配置里关掉 AI 入口，刷新首页后 `/ai` 菜单消失；地址栏直接进入 `/ai` 仍能打开。
8. 配置接口失败时，主题页是 `ErrorState`，没有成功 toast。

## 4. 阶段 B：加载速度与 Loading 优化

加载速度优先级高于普通视觉微调。目标是让面试官打开网站时首屏更快、更稳定。

### 4.1 性能检查

> 由 `perf-dashboard` worktree 落地，见 [performance-dashboard-prd.md](./performance-dashboard-prd.md)。2026-09-29 实测：入口 `umi.js` gzip 后 1.16 MB，里面含 PDF 预览和图表库代码，这是首屏慢的主要原因。

先建立当前基线：

- 首页首屏加载时间
- 内容中心加载时间
- 小册阅读页加载时间
- AI 工作台加载时间
- 主 bundle 和路由 chunk 体积
- 图片、字体、图标加载情况

### 4.2 首屏优化

优先处理：

- 首页首屏资源体积
- 不必要的同步依赖
- 图片尺寸与懒加载
- 字体加载策略
- 图标和大型组件按需加载
- 路由级分包

不为了小幅指标牺牲代码可维护性。

### 4.3 Loading 页面

优化：

- 应用初始 Loading
- 路由切换 Loading
- 内容列表 Skeleton
- 小册阅读 Skeleton
- AI 生成中的等待态
- 后台表格和表单加载态

加载态要遵循实际内容结构，避免闪烁和布局跳动。

### 4.4 验收

- 首页、内容中心、小册阅读、AI 工作台有可接受的加载态。
- 慢网速下页面不出现大片空白。
- 控制台无本次新增错误。
- 性能优化前后有可对比记录。
- 加载态不遮挡固定导航、底部操作栏和表单按钮。

## 5. 阶段 C：页面 UI 与交互优化

### 5.1 优先页面

第一优先级：

- 首页
- 内容中心
- 小册阅读
- AI 工作台

第二优先级：

- 登录 / 注册 / 改密
- 工作区 Dashboard
- 后台首页

### 5.2 首页

> 由 `home-showcase` worktree 落地，并包含项目页改版，见 [home-showcase-prd.md](../../../apps/user-web/docs/prd/home-showcase-prd.md)。

优化方向：

- 更清楚表达「个人知识平台 + AI 工具中台」
- 强化内容、AI、项目能力入口
- 首屏行动按钮更明确
- 移动端排版稳定

### 5.3 内容中心

优化方向：

- 筛选区在手机端更易用
- 卡片信息层级更清楚
- 空状态和错误态更友好
- 分页和加载状态不跳动

### 5.4 小册阅读

优化方向：

- 章节切换更顺手
- 阅读进度更明显
- 大纲和章节入口在移动端更稳定
- 图片、代码块和表格不撑破视口

### 5.5 AI 工作台

优化方向：

- 模型选择更清楚
- 额度信息更易理解
- 生成中、失败、停止、重试状态更稳定
- 移动端输入区不挤压按钮

### 5.6 登录与表单

优化方向：

- 错误提示更明确
- 验证码、邮箱验证、忘记密码流程更顺
- 表单提交状态不重复触发

## 6. 影响范围

### 用户端

- `apps/user-web/src/layouts/PublicLayout.tsx`
- `apps/user-web/src/app.tsx`
- 公开首页、内容中心、小册阅读、AI 页面、登录页面
- `apps/user-web/src/styles/**`
- 共享 Loading / Skeleton / ErrorState 组件

### 管理端

- 主题配置页面
- 后台首页
- 与主题配置相关的表单和预览

### 后端

- 系统配置字段
- Logo / favicon 文件引用
- SEO 配置读取接口

## 7. 风险与控制

- UI 优化容易发散：按页面优先级推进，先处理第一优先级。
- 样式覆盖风险：优先使用语义 class，不依赖 Ant Design 内部 DOM。
- 性能优化误伤功能：每次优化后跑核心流程。
- 移动端布局风险：必须验收 390px 和桌面宽度。

## 8. 验收总清单

- [x] 后台主题配置可保存并应用到前台
- [x] Logo / favicon / SEO 配置可用
- [x] 公开导航支持顶部 / 左侧 / 右侧
- [x] 首页首屏加载有明显 Loading 或 Skeleton
- [x] 内容中心加载和筛选体验稳定
- [x] 小册阅读移动端不横向溢出
- [x] AI 工作台移动端输入区可用
- [x] 登录注册表单错误态清晰
- [x] 桌面和移动端浏览器验收通过
- [x] 控制台无本次新增错误
- [x] 性能优化前后有记录
