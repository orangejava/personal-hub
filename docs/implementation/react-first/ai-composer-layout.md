# AI 三页统一布局与输入框

> 状态：已完成 LibLib 风格细化
> 最后更新：2026-07-08
> 对应 PRD：[../../prd/react-first/ai-composer-layout-prd.md](../../prd/react-first/ai-composer-layout-prd.md)

## 1. 目标与范围

本轮在阶段 5 AI 工作台基础上，统一 `/ai/chat`、`/ai/image`、`/ai/video` 三个创作页的主布局和底部输入区：

- 抽象 `AiWorkspaceFrame`，统一 1080px 主内容宽度、消息区、底部输入区和 Welcome 空态。
- 抽象 `AiComposer`，承载模型下拉、动态按钮、清空、语音占位、优化提示词、撤销优化、发送和停止。
- 抽象 `AiConfigPopover`，用“分组数组 + 选项数组”驱动图片/视频生成配置。
- 增强 `AiXBubble`，支持 Chat 思考过程、思维链、Markdown 正文和来源展示。

本轮不接真实 SSE、真实语音识别和真实提示词优化接口。

## 2. 页面与入口

- `/ai/chat`：使用统一工作区框架，保留左侧会话历史列表；高级设置仍在输入区上方，模型选择迁入底部输入区。
- `/ai/image`：生成结果流和输入区进入统一框架，图片质量、清晰度、尺寸、数量、风格进入配置弹窗。
- `/ai/video`：生成结果流和输入区进入统一框架，视频比例、时长、镜头风格进入配置弹窗。

三页进入后由 `AiLayout` 根据路径默认折叠 AI 主侧边栏，用户仍可通过侧边栏按钮重新展开。

## 3. 核心调用链

Chat：

```txt
Chat 页面
  ↓
AiWorkspaceFrame
  ↓
AiComposer / AiChatAdvancedSettings
  ↓
useAiChatMock
  ↓
AiXBubble
  ↓
AiXThink / AiXThoughtChain / AiXMarkdown
```

图片/视频：

```txt
Image / Video 页面
  ↓
AiWorkspaceFrame
  ↓
AiGenerationStream + AiComposer
  ↓
AiConfigPopover
  ↓
useAiGenerationMock
  ↓
generateAiImage / generateAiVideo mock service
```

## 4. 关键实现

- `AiWorkspaceFrame` 负责布局，不读任何业务状态，页面只传 `sidePanel`、`messageArea`、`composer` 和 Welcome 文案。
- `AiComposer` 只负责输入体验和按钮编排，附件、引用、模型和生成状态仍由页面或 hook 管理。
- `AiConfigPopover` 以 schema 驱动配置项，点击选项立即调用 `onChange` 写回 draft。
- `AiChatAdvancedSettings` 增加 `showModelSelect`，让模型选择从高级设置迁出，但保留 System Prompt、上下文窗口和知识引用开关。
- `AiMessage` 增加可选 `parts`，保持旧 `content` 字段兼容复制、持久化和历史消息。
- `useAiChatMock` 模拟 `reasoning`、`thought_chain`、`content`、`source`、`done` 五类片段，后续真实 SSE 可沿用同类结构。
- `AiXBubble` 在收到 assistant `message` 时统一渲染思考过程、思维链、Markdown 正文和来源，页面层不再手写 Markdown 组合。

## 5. 验证方式

已执行：

- `apps/react-web/node_modules/.bin/tsc -p apps/react-web/tsconfig.json --noEmit`
- `PATH=/Users/wangchaocheng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH node_modules/.bin/biome lint src/components/ai src/components/ai-x src/pages/ai ../../packages/shared-types/src/ai.ts ../../docs/prd/react-first/ai-composer-layout-prd.md ../../docs/implementation/react-first/ai-composer-layout.md ../../study/features/ai-composer-layout.md`
- 本地 dev server：`http://localhost:8002`

浏览器验收：

- `/ai/chat`：AI Layout 可见、主侧边栏自动折叠、会话列表可见、统一输入框和模型下拉可见，页面外层无滚动。
- `/ai/chat`：输入内容按 `Enter` 发送后清空输入框，助手消息展示思考过程、思维链、Markdown 正文和来源，控制台无 error。
- `/ai/image`：统一输入框、模型下拉、生成配置摘要和右侧筛选工具可见；配置弹窗展示图像质量、清晰度、图片尺寸、生成数量、图像风格，控制台无 error。
- `/ai/video`：统一输入框、模型下拉、生成配置摘要和右侧筛选工具存在，页面外层无滚动，控制台无 error。

## 6. 二次布局优化落地

本轮继续补齐三页在真实使用时更容易暴露的问题：页面外层滚动、标题卡片占位、媒体记录筛选和历史分页。

关键调整：

- `/ai/chat`、`/ai/image`、`/ai/video` 移除页面内 `AiPageHeader`，保留 AI Layout 顶部工具条和页面内 Welcome。
- `AiLayout` 在三页增加 focused 布局类，配合 `AiWorkspaceFrame` 让内容区高度锁定到当前可视区，页面外层不滚动。
- `AiWorkspaceFrame` 统一承担消息区滚动、自动滚到底部和向上滚动加载更早记录的触发入口。
- Chat 左侧会话历史抽成 `AiConversationHistoryPanel`，顶部新建和搜索固定，列表区域内部滚动，默认 20 条并支持 mock 加载更多。
- 图片/视频底部输入区去掉“科技感”“写实摄影”等快捷风格按钮，生成配置按钮改为反显 `比例 | 数量/时长 | 质量/风格`。
- 图片/视频消息流改成连续记录样式，不再用明显分离的用户卡片和 AI 卡片背景；媒体 hover 时分别展示顶部和底部操作按钮。
- 图片/视频右侧新增 `AiMediaListToolbar`，支持搜索框向左展开、回车/失焦后提交搜索、时间预设和自定义日期范围。

分页边界：

- 当前没有真实图片/视频历史分页接口，所以 `AiGenerationStream` 基于当前 mock task/assets 派生 18 条历史记录。
- 页面默认展示最新 10 条；滚动到消息容器顶部时，`AiWorkspaceFrame.onLoadMoreBefore` 将展示数量继续增加。
- 搜索范围覆盖 prompt、标题、模型、参数、资产标题；时间筛选优先使用任务 `createdAt`，资产时间作为兜底。

## 7. 已知限制与后续扩展

- 移动端底部输入区本轮不做专项适配，后续需要按移动端 AI 应用重新设计按钮折叠规则。
- 语音输入当前只是 UI 占位，后续可接 Web Speech API 或服务端语音转文本。
- 优化提示词当前为前端 mock 覆盖文本，后续可接真实模型优化接口。
- Chat 多类型 `parts` 目前由前端 mock 生成，真实 SSE 接入时需要在 service 层补事件解析。
- 图片/视频历史分页当前是前端 mock，接后端后应由接口返回分页记录、筛选结果和总数。

## 8. LibLib 风格细化实现

本轮在二次布局基础上继续补 UI 细节，主要落点是“更窄的创作工作区、更像 LibLib 的 AI 导航、更明确的登录态入口和媒体筛选”。

实现记录：

- `AiWorkspaceFrame` 的主内容宽度从 `1080px` 收窄为 `918px`，消息列表和输入框共用这条宽度约束。
- `AiComposer` 默认高度提高到更适合图片/视频提示词输入的尺寸，并将底部按钮调整为灰底胶囊按钮、深色发送按钮。
- `AiGenerationStream` 将生成时间移动到左侧独立展示，并调大加粗；“再次编辑 / 重新生成”改为左对齐。
- `AiMediaListToolbar` 改为右上角工具条，搜索框高度提高；时间筛选改用 `RangePicker`，快捷选项纵向排列。
- `AiLayout` 导航去掉小字分组标题，“创作”改为父级并缩进展示子页面；创作子项点击后折叠侧边栏。
- 会员中心和会员超市在导航中合并为“会员中心”，底部“返回首页”移除，品牌名点击返回公开首页。
- `AiLayout` 顶部根据 `@@initialState.currentUser` 展示登录态用户入口，hover 时展示用户卡片。
- 图片/视频生成数量做双层兜底：前端 hook 发送前规范化参数，mock store 再限制图片最多 4 张、视频固定 1 条。

后续接真实接口时需要注意：

- 用户卡片里的 UUID、训练加速余额、存储空间当前仍是 mock 展示位，需要后端用户资产接口补齐后替换。
- 创作父级当前是导航结构，不单独提供 `/ai/create` 页面。
- 图片/视频数量限制后续应同步到后台模型能力配置，避免只靠前端约束。
