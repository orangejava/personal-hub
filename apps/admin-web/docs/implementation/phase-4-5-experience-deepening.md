# 阶段 4.5 体验深化

> 状态：已完成本轮收尾
> 最后更新：2026-07-05
> 对应 PRD：[../../prd/react-first/phase-4-admin-preview-prd.md](../../prd/react-first/phase-4-admin-preview-prd.md)

## 1. 目标与范围

本轮目标是把阶段 4.5 从“已有基础组件”推进到“主要页面真实复用体验底座”，解决页面切换僵硬、骨架屏覆盖不足、空态/错误态分散和操作反馈不一致的问题。

不包含：

- 阶段 5 AI 功能开发。
- 后端真实接口。
- 权限契约统一。
- Next.js 抽离。

## 2. 页面与入口

本轮覆盖：

- 公开页：`/`、`/content`、`/content/:id`、小册章节、`/projects`、`/about`、`/ai`。
- 工作区：Dashboard、内容列表、小册、收藏、用量、个人设置。
- 后台：Dashboard、用户、角色、内容、分类、标签、文件、首页配置、菜单、系统配置、主题配置、日志。
- 文档预览：PDF、Word、RichText、Markdown 图片卡片占位。

## 3. 关键实现

体验组件：

- `MotionSurface`：区块级轻量进入动效。
- `AnimatedList`：少量列表/卡片的统一 stagger 进入动画。
- `SectionSkeleton`：扩展 `stats`、`form`、`media`、`dashboard` 等变体。
- `ResultState`：扩展 `filtered-empty`、`forbidden`、`offline` 等状态和清除筛选动作。
- `scrollPageToTop`：阅读类页面统一滚顶，后台筛选不调用。

样式：

- 拆分页面、内容、hover 和 stagger motion token。
- 页面切换位移降低到更轻的距离，保留 reduced motion 降级。
- 内容卡片封面统一 16:9 占位，避免图片加载导致卡片跳动。
- PDF/Word 预览区域固定最小高度。

页面：

- 公开项目页从原生 `Skeleton/Empty` 改为 `SectionSkeleton/ResultState`。
- 工作区小册、收藏、用量、个人设置补统一骨架、空态和保存中反馈。
- 后台用户、角色、内容、分类、标签、文件、系统配置等页面补空态和操作中状态。
- 首页配置、菜单配置补保存 loading，避免重复提交。
- 富文本公开阅读页从复用 Textbus 编辑器改为受控只读 HTML 节点渲染，避免工具栏文案污染阅读页。
- 工作台继续阅读从已废弃的 Ant Design `List` 收敛到 `AnimatedList` + `ResultState`。
- mock 业务失败统一返回 HTTP 200 + 业务 `code`，页面仍显示失败提示，但不再把可预期校验打印成开发态控制台异常。
- 修复 `AnimatedList` 与 Ant Design `Row/Col` 栅格的兼容问题：栅格场景不再额外包裹列表项，避免公开项目页和工作区小册页卡片被压窄；内容中心恢复响应式卡片网格，避免 16:9 封面在全宽列表中被拉成超高占位块。

## 4. 数据流与状态流

页面请求仍使用现有 service，不改变接口契约：

- 读请求：页面使用 `useRequest` 或 ProTable `request`。
- 局部操作：按钮点击进入 `operatingId` / `saving` / `batchDeleting` 状态。
- 成功：`message.success` + reload 或局部状态更新。
- 失败：`message.error` 或 `ResultState`。

## 5. 验证方式

自动验证：

- `corepack pnpm --filter user-web biome:lint`
- `corepack pnpm typecheck`
- `corepack pnpm --filter user-web test`

浏览器验收：

1. 公开页、工作区、后台核心页面可打开，无开发态 overlay。
2. 路由切换时页面主体轻量淡入，顶栏和侧栏不抖动。
3. PDF/Word 加载时显示稳定媒体骨架。
4. 保存配置、发布/归档、删除、批量删除、角色权限保存有操作反馈。
5. 深色主题和窄屏下页面无明显重叠和不可读。

本轮实际验收结果：

- 已通过 `corepack pnpm --filter user-web biome:lint`。
- 已通过 `corepack pnpm typecheck`。
- 已通过 `corepack pnpm --filter user-web test`。
- 已启动 `user-web` dev server，清理 MFSU 生成缓存后未再复现 core-js 空白页错误。
- 已检查公开页、工作区、后台核心页面，无开发态 overlay。
- 已检查 PDF、Word、小册、富文本详情页，富文本只读页不再显示编辑器工具栏。
- 已验证被引用文件删除失败会显示业务提示，且不再产生应用控制台错误。
- 已使用 Chrome DevTools Protocol 以 390px 宽度抽样验收首页、PDF 详情、工作台、后台文件页，页面级无横向溢出；后台表格和 PDF 预览在局部容器内滚动。
- 已通过后台主题配置保存暗色模式并刷新公开首页，验证 `.ph-public-dark`、深色背景和浅色文字生效；验收后已恢复亮色配置。
- 已补充验收 `/content`、`/projects`、`/workspace/booklets` 卡片尺寸和 DOM 结构：内容中心恢复三列卡片网格，项目页和小册页 `Row` 的直接子级恢复为 `Col`，未发现开发态 overlay。

## 6. 已知限制与后续扩展

- ProTable 的内部 loading 仍沿用 ProComponents 默认能力，本轮主要统一空态和操作反馈。
- AI 专属流式输出、图片生成任务态会在阶段 5 基于本轮组件继续扩展。
- 真实接口缓存、乐观更新、错误重试策略等留到阶段 6 接后端后再系统化。
- 浏览器插件的 Statsig 网络日志属于 Codex 内置浏览器自身请求，不是项目运行错误。
- 移动端当前以 390px 抽样验收为准；后续阶段 5 新增 AI 工作台时还需要重新做 AI 专属布局的窄屏验收。
- 工作区/后台暗色主体仍沿用 Ant Design Pro 设置入口，当前重点验证公开页主题生效；后台完整深色视觉可作为后续主题专项继续完善。
