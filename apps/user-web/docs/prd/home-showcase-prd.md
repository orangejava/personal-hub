# 首页滚动改版与项目作品矩阵 PRD

> 状态：本期已落地（含首页性能摘要）
> 最后更新：2026-10-10
> Worktree：`home-showcase`
> 计划评分（plan-review，百分制，2026-10-02）：不含首页性能区块为 91，可以开工。首页性能区块等 `perf-dashboard` 合并并变基后再做，不计入本期。
> 关系：落实 [theme-ui-performance-prd.md](../../../../docs/prd/post-launch/theme-ui-performance-prd.md) §5.2「首页」，并重做 `/projects`。性能数据来自 [performance-dashboard-prd.md](../../../../docs/prd/post-launch/performance-dashboard-prd.md)。开工前依赖 `main` 上的「启动前骨架」，见 [post-launch/README.md](../../../../docs/prd/post-launch/README.md)。

## 1. 目标

- 首页改成按滚动逐块出现、逐块加载数据的展示页，清楚表达「个人知识平台 + AI 工具中台」
- 项目页改成「作品矩阵」：展示这个平台由哪些端组成、各自做到哪一步，并给 Flutter 和桌面端预留位置
- 项目截图先用占位图，后台可以替换成真实截图
- 改版后首页不能变慢；用性能面板记录改版前后数据

参考：

- [haoqi.design](https://haoqi.design/)：满屏大字介绍、作品按「名称 + 年份」逐行排列、克制的配色
- [codexradar](https://deng.codexradar.com/)：数据卡片和档位着色，用在首页的性能区块

## 2. 不做

- 不做整页吸附滚动（一次滚一屏），不接管浏览器原生滚动
- 首版不引入平滑滚动库（如 Lenis）
- 顶栏采用现有非透明方案；Hero 高度扣除顶栏高度。`theme-config` 不新增首屏透明顶栏效果
- 项目的名称、介绍、技术栈暂不做后台管理，只有图片可以后台替换

## 3. 动效方案

### 3.1 选型结论

- **Motion（原 framer-motion）作为基础库**：声明式写法，和 React 契合。进入视口浮现、错落进入、视差、固定一屏配合滚动进度、布局动画都能覆盖。
- **GSAP 作为个别区块的备选**：只有遇到 Motion 做起来明显吃力的效果（逐字拆分、SVG 形变、多段精确编排的滚动时间线）才引入，并且只在那个区块进入视口前用 `import()` 动态加载，配合官方的 `@gsap/react` 的 `useGSAP` 做清理。
- 两个库可以同时存在，但必须遵守下面的体积预算。

选型依据：当前入口 JS 已有 1.16 MB（gzip），首页慢的主因在入口和 Nginx 未压缩，不在动效库。两个库合计约 50–60 KB，放在首页分包里、不进入口，对首屏影响有限。

### 3.2 封装

页面不直接调用 Motion 或 GSAP，只使用项目自己的组件，放在 `src/components/motion/`：

| 组件 | 用途 |
| --- | --- |
| `Reveal` | 进入视口时淡入、上移 |
| `Stagger` | 子元素依次错落进入 |
| `ScrollScene` | 固定一段区域，按滚动进度驱动内部动画 |
| `useInView` | 进入视口（含提前量）时返回 true，用于延迟渲染和请求数据 |

以后换库或叠加 GSAP，只改这几个组件的内部实现。

### 3.3 和现有 CSS 动效的分工

- `PageTransition`、`MotionSurface` 和 `motion.less` 保持不变，继续负责路由进入动画和悬停这类小动效。
- 滚动、视口进入、布局动画统一用 `src/components/motion/`。
- 不把 `PageTransition` 改成 Motion 的退出动画，避免和 Umi 路由出口的时序冲突。

### 3.4 体积与性能预算

- 动效库合计 gzip ≤ 60 KB，且不得出现在入口 `umi.js` 里
- Motion 使用 `LazyMotion` 加 `m` 的写法，动画功能包异步加载
- 改版后首页的 LCP、CLS 和首屏 JS 传输量不得差于改版前（以性能面板记录为准）
- 动画只改 `transform` 和 `opacity`
- 单个进入动画时长：桌面 ≤ 600 ms，手机 ≤ 300 ms
- 用 `MotionConfig reducedMotion="user"`：系统开启「减少动态效果」时关闭位移动画，只保留淡入

## 4. 首页 `/`

### 4.1 区块与后台配置

后台已有首页区块配置 `site.homepage.modules`（`key`、`visible`、`sort`），首页按它决定显示哪些区块、按什么顺序。现有 4 个 key 保留，新增 3 个：

| key | 区块 | 数据 | 说明 |
| --- | --- | --- | --- |
| `hero` | Hero（首屏） | `homepage.hero` | 已有 |
| `capabilities` | 平台能力 | 静态文案 | 新增 |
| `featured` | 精选内容与分类入口 | `fetchFeatured`、`fetchContentMeta` | 已有，合并原「分类入口」 |
| `aiTools` | AI 工具推荐 | `homepage.aiTools` 中 `enabled` 的项 | 已有；`aiEnabled` 为 false 时整块隐藏 |
| `showcase` | 作品矩阵预告 | `projectVisualAssets` 配置 + 静态作品文案 | 新增 |
| `techStack` | 技术栈 | `homepage.techStack` | 已有 |
| `performance` | 性能数据 | 性能面板采集数据 | 新增 |

结尾的行动按钮不单独配置，固定显示在最后。

**旧数据兼容**：线上数据库里保存的 `modules` 只有 4 个旧 key。合并规则是：以代码里的默认列表为底，数据库里同 key 的 `visible`、`sort` 覆盖默认值；数据库里没有的新 key 按默认值显示。这个合并放在 Nest 拼装配置时做，公开接口和后台表单拿到的都是完整列表。

### 4.2 各区块

1. **Hero**
   - 满屏大字，高度为「视口高度减顶栏高度」（`calc(100svh - 顶栏高度)`），不需要透明顶栏
   - 文案用 `homepage.hero.title`、`subtitle`；两个按钮用 `primaryAction`、`secondaryAction` 的文字和跳转地址，不再写死「浏览内容」
   - 底部有向下滚动提示；标题按行错落进入
   - 沿用 `site.layout.homeHeroStyle`：`split` 为左侧大字加右侧抽象视觉；`center` 为居中大字；`minimal` 为无装饰、只保留淡入
2. **平台能力**：内容、AI、项目三块。桌面端左侧标题固定，右侧三张卡片随滚动依次切换（`ScrollScene`）；其他档见 §4.4
3. **精选内容与分类入口**：上方为分类标签，下方为精选卡片；进入视口前 200px 才请求，请求中显示骨架屏
4. **AI 工具推荐**：横向卡片，点击进入对应工具页
5. **作品矩阵预告**：参考 haoqi，一行一个作品，显示「名称 —— 状态 —— 年份」；桌面端悬停时显示封面图；点击跳到 `/projects`
6. **技术栈**：按分类分组展示
7. **性能数据**：大分数计入下面八项，权重为 LCP 25、TTFB 15、CLS 15、INP 15、FCP 10、接口 p95 20、路由切换 15、首屏 JS 10。没有样本的项不计入，其余按剩余权重归一。八项都有数时分母是 125。这一分和 `/status` 的首页卡片不同，卡片仍只看 LCP、TTFB 和路由切换。格子按良好、待改进、差使用和性能面板相同的状态色。没有样本时显示「数据不足」，保持中性底色。链接到 `/status`。不放图表、接口列表和页面筛选。由 `perf-dashboard` 落地
8. **结尾**：一句话加行动按钮

删除现有的「AI 工具（即将上线）」占位卡片。

### 4.3 滚动加载

- 首屏只渲染 Hero，不发业务请求（系统配置已经在启动时拉取）
- 其他区块用 `useInView` 延迟渲染和请求数据，提前量 200px
- 区块未加载时先占住大致高度，避免滚动条跳动和布局偏移

### 4.4 各视口档的行为

视口数字来自 `src/config/viewport-bands.json`。

| 档 | 行为 |
| --- | --- |
| 桌面（≥ 992）且不是矮屏 | 使用 `ScrollScene`、悬停预览 |
| 平板（768–991） | 不用 `ScrollScene`，改为纵向排列加 `Reveal`；不做悬停预览 |
| 手机（≤ 767） | 与平板相同的紧凑方案，卡片单列，动画时长缩短 |
| 矮屏（高度 ≤ 499） | 不用 `ScrollScene`；Hero 不强制满屏 |

- 标题在 390px 宽度下不溢出，必要时换行
- 首页的点击热区在触屏上不小于 44px

## 5. 项目页 `/projects`：作品矩阵

### 5.1 区块

1. **页头**：标题和简介沿用 `site.layout.projectsTitle`、`projectsIntro`
2. **平台概览**：personal-hub 一句话介绍，加一张架构图：用户端 / 管理端 / Flutter / 桌面端 → Nest → PostgreSQL / Redis / COS。规划中的端用虚线
3. **端卡片**

| key | 端 | 状态 | 说明 |
| --- | --- | --- | --- |
| `user-web` | 用户端 Web | 已上线 | 公开前台、工作区、AI 工具 |
| `admin-web` | 管理端 Web | 已上线 | 菜单、角色、权限、内容、配置；不给公开链接，只展示截图和能力 |
| `server` | Nest 服务端 | 已上线 | Canonical API、鉴权、内容、文件、AI |
| `flutter` | Flutter App | 规划中 | 范围见 `docs/product/flutter.md` |
| `desktop` | 桌面端 | 规划中 | 技术对比见 `docs/product/phase-2/desktop-app.md` |

每张卡片包含：封面图、名称、状态标签、一句话介绍、技术栈、3 条以内的亮点、链接。只有 `user-web` 带「查看性能」，跳到 `/status`。性能面板只采集用户端，管理端和 Nest 没有对应页面样本，不放这条链接。`flutter`、`desktop` 是规划中：不显示外链，封面仍可点开预览。点击封面打开截图预览（多张时可以左右切换）。

4. **项目进度**：标题为「项目进度」。静态四条，新的在前，字段按 GitHub Releases 预留（标题、状态、变更说明、可选日期）。页面不请求 GitHub。顺序：上线后优化（进行中）、首版公网上线、Nest M0–M6、React-first 阶段 0–5
5. **更多作品**：标题保留，正文固定「敬请期待」。不请求内容中心，不展示项目文章，不分页

### 5.2 数据来源

- **文字内容**（名称、状态、介绍、技术栈、亮点、链接、时间线）放在本 worktree 新建的 `src/config/projectShowcase.ts`。`main` 没有这个文件。原因：内容模型里没有这些结构化字段，做成后台可编辑需要额外的表单，等端数量变多再做。文案用下表，不要在实现时另写一套：

| key | 名称 | 状态 | 一句话 | 技术栈 | 亮点 | 链接 |
| --- | --- | --- | --- | --- | --- | --- |
| `user-web` | 用户端 Web | 已上线 | 公开前台、工作区和 AI 工具 | React、Umi、Ant Design | 内容阅读；AI 对话；登录后工作区 | `/` |
| `admin-web` | 管理端 Web | 已上线 | 菜单、角色、权限、内容和配置 | React、Umi、Ant Design Pro | 内容审核；系统配置；AI 目录 | 无 |
| `server` | Nest 服务端 | 已上线 | Canonical API、鉴权、内容、文件和 AI | NestJS、Prisma、PostgreSQL、Redis | 会话与权限；内容与文件；额度账本 | 无 |
| `flutter` | Flutter App | 规划中 | 移动端阅读和 AI 对话，不含后台 | Flutter、Riverpod、Dio | 与 Web 共用账号；章节与 Markdown；对话与文本 | 无 |
| `desktop` | 桌面端 | 规划中 | 复用用户端界面，技术方向为 Tauri 2 | Tauri 2、React | 先做 Windows 和 macOS；托盘与更新后置；Linux 最后 | 无 |

项目进度四条，新的在前：上线后优化（进行中）；首版公网上线；Nest M0–M6；React-first 阶段 0–5。
- **图片**：
  - 每个端在 `public/images/showcase/<key>.svg` 放一张占位封面，随代码提交
  - 后台可以为每个端上传封面图和最多 6 张截图，上传后前台用真实图片替换占位图
  - 没有上传时显示占位图；图片加载失败时也回落到占位图
- 新端上线时，把静态配置里的状态改为「已上线」并补链接，再到后台上传截图

### 5.3 前台读取已有截图

契约和后台界面已在骨架落地（`SystemProjects`、`ImageFileField`、公开签名 URL）。本 worktree 不再改 `SystemProjects` 或 `SystemContent`。前台只读公开配置里的 `coverUrl`、`screenshotUrls`。页面拿到的是解包后的对象，不检查 `code`。没有 URL、图片加载失败，都显示 `public/images/showcase/<key>.svg`，不弹错误。

### 5.4 各视口档的行为

- 端卡片：手机单列，平板两列，桌面三列
- 架构图在手机和平板上改为纵向排列，不横向滚动
- 截图预览在手机上全屏显示，左右滑动切换

## 6. 分阶段

1. **动效封装**：`src/components/motion/` 四个组件。开发环境注册 `/__motion` 用来验收，不进公开菜单；生产构建不注册这条路由
2. **首页**：按 §4 完成除「性能数据」外的区块
3. **项目页**：按 §5.1、§5.2 完成，图片先全部用占位图，并读已有公开资产 URL
4. **性能数据区块**：已由 `perf-dashboard` 落地，只做首页摘要

## 7. 影响范围

| 文件 | 改动 |
| --- | --- |
| `apps/user-web/package.json` | 新增 `motion`；GSAP 用到时再加 |
| `apps/user-web/src/components/motion/*` | 新增：`Reveal`、`Stagger`、`ScrollScene`、`useInView` |
| `apps/user-web/src/pages/public/Home/index.tsx` | 重写：按 `modules` 顺序渲染区块 |
| `apps/user-web/src/pages/public/Home/sections/*` | 新增：各区块组件 |
| `apps/user-web/src/pages/public/Home/index.less` | 新增：首页样式，不改全局 `motion.less` |
| `apps/user-web/src/pages/public/Projects/index.tsx` | 重写为作品矩阵 |
| `apps/user-web/src/config/projectShowcase.ts` | 本 worktree 新建，内容用 §5.2 的表和时间线 |
| `apps/user-web/public/images/showcase/*.svg` | 新增：占位封面 |

不改：`PublicLayout.tsx`、`PublicHeaderActions.tsx`、`config/routes.ts`、全局样式。

## 8. 验收

- 桌面（1440 × 900）、平板（820 × 1180）、手机（390 × 844）、矮屏（1280 × 480）四种视口在浏览器验收：无横向溢出，标题不被遮挡，截图预览不越界
- 首屏只有 Hero；向下滚动时各区块依次出现，网络面板里能看到数据请求在滚到附近时才发出
- 后台关闭某个区块或调整排序后，刷新首页生效；线上旧数据（只有 4 个旧 key）下，新区块仍按默认显示
- Hero 两个按钮的文字和跳转与后台配置一致
- 关闭 AI（`aiEnabled` 为 false）后，AI 工具推荐区块不显示
- 开启系统「减少动态效果」后，没有位移动画，内容完整可读
- 动效库不在入口 `umi.js` 里；首页分包增量在预算内
- 性能面板记录改版前后首页的 LCP、CLS 和首屏 JS 传输量，改版后不差于改版前
- 项目页五张端卡片与 §5.2 文案一致。`flutter`、`desktop` 没有外链。只有用户端有「查看性能」。没有上传图片时显示占位图；在已有的项目配置页上传后，刷新项目页显示真实截图
- 「更多作品」标题下固定「敬请期待」，不请求内容列表，不因接口有没有数据改文案
- 后台把 AI 工具全部关掉，或技术栈为空时，对应首页区块不占高度
- 顶栏导航、主题切换、登录入口等原有交互正常；内容中心、关于页不受影响
- 控制台无新增错误

## 9. 待确认

- [x] 顶栏：采用非透明方案，Hero 高度扣掉顶栏；不实现首屏透明顶栏（2026-09-30 确认）
- [x] 项目截图：占位图先行，后台可替换为真实截图（2026-09-30 确认）
- [x] 桌面端：后续以 Tauri 2 为技术方向，只影响当前卡片文案；进入开发前仍需单独写 PRD，见 `docs/product/phase-2/desktop-app.md`（2026-09-30 确认）
