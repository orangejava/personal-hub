# 阶段 5：AI 平台 PRD

> 状态：已完成本轮收尾
> 最后更新：2026-07-06
> 优先级：P1（阶段 4 + 阶段 4.5 体验底座后启动）
> 目标：在 `apps/react-web` 中先用 mock 跑通 AI 平台完整前端体验，形成“独立 AI 工作台 + 工具创作流 + 用量/资产/配置闭环”，为后续 NestJS 或临时 Next API 接入保留稳定 service 契约。

---

## 0. 阶段 5 启动前盘点

### 0.1 阶段 5 之前完成度

以当前台账和代码结构为准，阶段 5 之前可以视为“本轮已完成，可进入阶段 5”，但仍有少量非阻塞遗留项。

| 阶段 | 当前判断 | 依据 | 阶段 5 影响 |
|---|---|---|---|
| 阶段 0：工程骨架 | 已完成 | `docs/completed/README.md`、`apps/react-web`、`packages/shared-types` 已存在 | 可直接在 React Web 内新增 AI 模块 |
| 阶段 1：主题/布局/权限/mock 底座 | 已完成 | `app.tsx`、`access.ts`、`models`、`mock`、`services` 已形成约定 | AI 继续沿用 service + mock + `useModel` |
| 阶段 2：公开前台与内容阅读 | 已完成 | 公开页、内容详情、小册阅读、收藏、阅读进度已实现 | 内容详情可扩展“引用到 AI”入口 |
| 阶段 3：工作区与内容生产 | 已完成 | 工作区 Dashboard、内容管理、Markdown/RichText、小册、用量页已实现 | `/workspace/usage` 可与 AI Token 用量联动 |
| 阶段 4：后台运营台 | 已完成本轮收尾 | 后台用户/角色/内容/文件/首页/菜单/日志等已实现 | 可新增 `/admin/ai/config`、`/admin/ai/stats` |
| 阶段 4.5：体验底座 | 已完成本轮收尾 | `PageLoading`、`SectionSkeleton`、`ResultState`、`MotionSurface` 等已覆盖主要页面 | AI 页面必须复用这些体验组件 |

### 0.2 阶段 5 之前未完成但不阻塞的事项

| 遗留项 | 当前状态 | 处理建议 |
|---|---|---|
| 真实后端、数据库、SSE | 未做 | 阶段 5 继续使用 mock；阶段 6 接 NestJS |
| 权限契约统一 | 未完全统一 | 阶段 5 暂用 `ai:use`、`ai:manage`，代码结构预留长期权限点 |
| AI 真实厂商调用 | 未做 | 阶段 5 只做前端 mock 流和 service 契约 |
| `/ai` 当前仍是公开区占位页 | 未升级 | 阶段 5 第一批改成 AI 专属布局 |
| `/workspace/ai/history` | 尚无路由 | 阶段 5 新增入口或从工作区菜单跳转到 `/ai/chat` |
| Admin AI 配置/统计 | 尚无页面 | 阶段 5 后半段新增 mock 配置闭环 |
| PRD 索引阶段 4 状态有旧值 | 已同步修正 | 后续以 `docs/completed/README.md` 和实现记录为准 |

### 0.3 当前已有 AI 基础

- 依赖已安装：`@ant-design/x@2.8.0`、`@ant-design/x-markdown@2.8.0`、`@ant-design/x-sdk@2.8.0`。
- 当前 `/ai` 已有占位页：`apps/react-web/src/pages/ai/Home/index.tsx`。
- 当前已有 AI service 占位：`apps/react-web/src/services/ai.ts`。
- 当前已有 AI mock 占位：`apps/react-web/mock/ai.ts`。
- 后台菜单 mock 已预留 AI 工作台菜单：`apps/react-web/mock/data/admin-store.ts`。

阶段 5 不需要先引入新框架依赖，重点是把 Ant Design X 做成本地业务组件层。

## 1. 本阶段解决什么问题

阶段 5 不依赖真实后端和真实模型 Key，先解决 AI 平台的信息架构、页面布局、状态流和 mock 契约。

核心目标：

- `/ai` 从公开区占位页升级为 AI 平台入口。
- 进入 `/ai/*` 后隐藏公开前台顶部导航，使用 AI 专属左侧工作栏。
- AI 工具、会员入口、资产、创作中心、教程、API、用量、个人中心统一放进左侧栏。
- Chat、文本生成、图片生成先做完整 mock 创作流。
- 后台提供 AI 厂商、模型、工具、套餐/用量统计的 mock 配置入口。
- 保留和内容中心联动：内容可作为 AI 引用素材，生成结果后续可进入资产或内容库。

明确不包含：

- 真实 AI 厂商调用。
- 真实 SSE 服务端流。
- 支付充值。
- 视频生成真实能力。
- WebUI / ComfyUI / LoRA 训练真实后端执行。
- AI 结果一键发布到内容库的完整流程。

---

## 2. Ant Design X 本地全量封装策略

### 2.1 封装目标

本项目采用 `@ant-design/x` 作为 AI 交互底层组件，但页面层不直接散落使用第三方组件。阶段 5 先在本地建立一层完整封装，后续改 UI、改交互、替换底层实现时只改本地组件。

核心原则：

- 页面只引用 `src/components/ai-x` 和 `src/components/ai`，不直接引用 `@ant-design/x`。
- `@ant-design/x` 原包仍作为依赖保留，不复制 `node_modules` 源码。
- 本地封装要覆盖当前包导出的主要组件和 hooks，形成“全量入口”。
- 首版不追求重写所有内部实现，先做透传封装、统一 className、中文默认文案、主题 token、业务事件和空/错/加载态。
- 真正涉及业务组合的能力放到 `src/components/ai`，例如 Chat 主工作区、图片任务卡、资产卡等。

已确认决策：

- 可以在本地封装组件内部直接 import `@ant-design/x`、`@ant-design/x-markdown`、`@ant-design/x-sdk`。
- 可以在 AI Layout 或全局样式入口统一 import 第三方必要样式，例如 `@ant-design/x-markdown` 的 CSS。
- 页面层原则上不直接 import 第三方 X 组件，避免后续 UI 修改时到处找调用点。
- Ant Design X 大部分核心组件已支持 `className`、`style`、`classNames`、`styles` 等语义化样式透传；本地封装需要继续向外暴露这些能力。
- 对第三方组件没有暴露到的内部节点，通过本地 wrapper 外层结构、`rootClassName`、CSS 变量或 Less 覆盖处理。

### 2.2 本地目录建议

```txt
apps/react-web/src/components/
├── ai-x/                         # 对 Ant Design X 的本地全量封装层
│   ├── index.ts
│   ├── AiXProvider/
│   ├── AiXActions/
│   ├── AiXAttachments/
│   ├── AiXBubble/
│   ├── AiXCodeHighlighter/
│   ├── AiXConversations/
│   ├── AiXFileCard/
│   ├── AiXFolder/
│   ├── AiXMermaid/
│   ├── AiXPrompts/
│   ├── AiXSender/
│   ├── AiXSources/
│   ├── AiXSuggestion/
│   ├── AiXThink/
│   ├── AiXThoughtChain/
│   ├── AiXWelcome/
│   ├── AiXMarkdown/
│   └── hooks/
│       ├── useAiXChat.ts
│       ├── useAiXConversations.ts
│       ├── useAiXRequest.ts
│       └── useAiXStream.ts
└── ai/                           # 本项目 AI 业务组件
    ├── AiAppShell/
    ├── AiSidebar/
    ├── AiTopbar/
    ├── AiQuotaBadge/
    ├── AiModelSelect/
    ├── AiReferencePicker/
    ├── AiChatWorkspace/
    ├── AiTextGenerator/
    ├── AiImageGenerator/
    ├── AiAssetCard/
    ├── AiTaskStatus/
    └── AiPlaceholderTool/
```

### 2.3 需要封装的 Ant Design X 能力清单

| 本地组件 | 底层能力 | 用途 | 阶段 5 使用位置 |
|---|---|---|---|
| `AiXProvider` | `XProvider` | 统一 X 组件主题、国际化、样式前缀 | AI Layout 根部 |
| `AiXBubble` | `Bubble` | 用户/助手消息气泡、流式输出展示 | `/ai/chat` |
| `AiXConversations` | `Conversations` | 会话列表、新建、切换、更多操作 | `/ai/chat` |
| `AiXSender` | `Sender`、`SenderSwitch` | 底部输入框、发送、停止 | `/ai/chat` |
| `AiXActions` | `Actions` | 复制、重新生成、反馈等消息动作 | `/ai/chat`、`/ai/text` |
| `AiXPrompts` | `Prompts` | 推荐提示词、模板快捷入口 | `/ai`、`/ai/chat`、`/ai/text` |
| `AiXAttachments` | `Attachments` | 附件上传/引用文件占位 | `/ai/chat` |
| `AiXSources` | `Sources` | 引用来源展示 | `/ai/chat` |
| `AiXSuggestion` | `Suggestion` | 输入建议、Prompt 补全 | `/ai/chat`、`/ai/text` |
| `AiXThink` | `Think` | 思考过程展示占位 | `/ai/chat` |
| `AiXThoughtChain` | `ThoughtChain` | 后续 Agent/工作流步骤 | `/ai/apps` 占位 |
| `AiXCodeHighlighter` | `CodeHighlighter` | AI 回复代码块高亮 | `/ai/chat`、`/ai/text` |
| `AiXMermaid` | `Mermaid` | AI 回复 Mermaid 图渲染 | `/ai/chat` |
| `AiXFileCard` | `FileCard` | 附件/生成资产文件卡片 | `/ai/assets` |
| `AiXFolder` | `Folder` | 资产目录或知识引用树占位 | `/ai/assets` |
| `AiXWelcome` | `Welcome` | Chat 空会话欢迎区 | `/ai/chat` |
| `AiXMarkdown` | `XMarkdown` | 流式 Markdown 渲染 | `/ai/chat`、`/ai/text` |

Hooks 和 SDK 封装：

| 本地 hook | 底层能力 | 用途 |
|---|---|---|
| `useAiXChat` | `useXChat` | 管理消息发送、重新生成、mock 流 |
| `useAiXConversations` | `useXConversations` | 管理会话列表状态 |
| `useAiXRequest` | `XRequest` | 统一后续真实请求、错误码、取消 |
| `useAiXStream` | `XStream`、`useStreaming` | 统一 mock/真实 SSE 文本增量 |

### 2.4 封装层职责边界

| 层级 | 可以做 | 不应该做 |
|---|---|---|
| `components/ai-x` | 透传第三方 props、统一样式、中文文案、业务默认值、事件适配、可测试示例 | 写页面业务逻辑、直接读 mock、直接扣 Token |
| `components/ai` | 组合 AI 页面区块、处理业务状态、调用 service、展示配额/错误/资产 | 直接 import `@ant-design/x` |
| `pages/ai/*` | 编排路由页面、读取 URL 参数、调用业务组件 | 直接拼复杂组件细节 |
| `services/ai.ts` | 定义接口调用契约 | 维护 UI 状态 |
| `mock/data/ai-store.ts` | 维护 mock 内存态 | 被页面直接读取 |

### 2.5 样式与交互扩展点

每个 `ai-x` 组件至少预留：

- `className`：外部追加页面级样式。
- `style`：外部追加根节点行内样式。
- `variant`：本项目业务变体，例如 `compact`、`workspace`、`asset`。
- `styles` 或 `classNames`：覆盖关键子节点。
- `locale`：中文默认文案，允许局部覆写。
- `analyticsName`：后续埋点预留。
- `testId`：浏览器验收和组件测试定位。

样式文件建议：

```txt
apps/react-web/src/styles/
├── ai-tokens.less       # AI 工作台颜色、尺寸、阴影、层级 token
├── ai-layout.less       # 左侧栏、顶部工具条、响应式
├── ai-components.less   # ai-x 和 ai 组件统一覆盖
└── ai-motion.less       # 流式输出、生成中、任务状态动效
```

### 2.6 首批封装开发顺序

1. `AiXProvider`、`AiXBubble`、`AiXSender`、`AiXConversations`、`AiXActions`。
2. `AiXMarkdown`、`AiXCodeHighlighter`、`AiXPrompts`、`AiXSources`。
3. `AiXAttachments`、`AiXFileCard`、`AiXFolder`。
4. `AiXThink`、`AiXThoughtChain`、`AiXMermaid`、`AiXSuggestion`。
5. `useAiXChat`、`useAiXConversations`、`useAiXStream`、`useAiXRequest`。

封装完成标准：

- 页面层没有直接 import `@ant-design/x`、`@ant-design/x-markdown`、`@ant-design/x-sdk`。
- 每个本地封装都有中文 JSDoc，说明封装目的和业务默认值。
- Chat 页面能只通过本地封装完成会话、消息、输入、动作和 Markdown 渲染。
- 后续改样式时优先改 `ai-tokens.less`、`ai-components.less` 或本地封装组件。

## 3. 参考产品与借鉴边界

参考方向来自用户提供的 LibLibAI、即梦 AI，以及当前截图中的侧边栏结构。

### 3.1 LibLibAI 可借鉴点

- 左侧栏强分组：主页、创作、资产、个人中心、创作中心、发布、教程、API。
- “创作”作为一级分组，下挂图片生成、视频生成、WebUI、ComfyUI、训练 LoRA、AI 应用。
- 资产与创作中心独立，方便把生成结果、草稿、历史任务沉淀下来。
- 教程/API 入口放在同一工作台里，降低新用户理解成本。

### 3.2 即梦 AI 可借鉴点

- 工具入口强调“图片 / 视频 / 智能画布 / 灵感模板 / Agent”这类创作场景，而不是只按模型厂商划分。
- 首页适合做推荐模板、最近创作、热门工具、灵感示例。
- 生成结果区要重视大图预览、历史任务、参数复用。

### 3.3 本项目不能照搬的地方

本项目不是纯 AI 社区或纯创作站，还包含公开知识内容、工作区和后台管理。因此 AI 平台应是一个“站内独立工作台”：

- 公开首页、内容中心、项目页、关于我仍保留公开顶部导航。
- `/ai/*` 进入 AI 专属布局后隐藏顶部导航。
- 登录入口仍可在右上角保留，登录后用户信息和会员/用量入口进入左侧栏。
- 左侧栏提供返回首页能力，避免用户迷失在 AI 工作台。

### 3.4 参考信息仍需补充的细节

现有参考已经足够确定“AI 独立工作台 + 创作工具分组 + 资产/会员/教程/API 入口”的大方向，但还不足以直接锁定所有 UI 和交互细节。建议阶段 5 开发前再确认或补截图：

| 细节 | 为什么需要 | 没有时的默认方案 |
|---|---|---|
| 左侧栏展开/折叠视觉 | 已确认 | 直接复用 Ant Design / Ant Design Pro 同类侧边栏交互 |
| Chat 输入框样式 | 已确认方向 | 参考 ChatGPT / DeepSeek：底部固定、圆角大输入框、多行输入、附件/工具/发送同区 |
| 图片/视频生成结果区 | 已确认方向 | 采用对话式布局，用户输入和 AI 输出统一显示在左侧主内容流 |
| 首页模板卡片视觉 | 已确认方向 | 参考附件图：卡片 hover 顶部展示模型，底部展示“使用模板”按钮 |
| 会员中心商业化深度 | 已确认 | 阶段 5 只做 mock，不做支付和真实权益开通 |
| AI 资产分类 | 待最终确认 | 先按“全部、生成结果、上传素材、收藏、项目文件夹、回收站”组织 |
| 品牌名和 Logo | 已确认 | 暂用 `Personal Hub AI`，但必须做成系统配置项 |

### 3.5 本次新增产品决策

1. Ant Design X 作为底层依赖，不复制源码；封装层直接 import，页面层通过本地封装使用。
2. AI 侧边栏折叠/展开复用现有 Ant Design 侧边栏体验，不另起一套复杂交互。
3. Chat 输入区参考 ChatGPT / DeepSeek 的底部输入形态。
4. 图片生成和视频生成统一采用“用户输入 + AI 输出”的对话流展示，输出内容出现在左侧主内容区。
5. 图片或视频 hover 时显示快捷按钮：引用为附件、下载、查看详情。
6. AI 输出底部显示“再次编辑”和“重新生成”。
7. 再次编辑：把本次用户输入、参数和附件图重新填充到输入框。
8. 重新生成：复用当前用户输入和参数，直接再次发送给后端。
9. 首页模板卡 hover 时顶部展示模型，底部展示“使用模板”按钮。
10. 会员中心阶段 5 只做 mock。
11. AI 资产分类先采用推荐方案，后续可继续根据真实使用习惯调整。
12. `Personal Hub AI` 作为默认品牌名，并支持后台或系统配置修改。

---

## 4. AI 专属布局

### 4.1 布局结构

```txt
┌───────────────┬──────────────────────────────────────────────┐
│ AI 左侧工作栏  │ AI 当前工具页面                              │
│ 248px / 72px  │                                              │
│               │  页面顶部工具条（非公开导航）                 │
│ Logo + 折叠   │  模型/额度/任务状态/登录按钮                  │
│ 首页          │                                              │
│ 创作          │  主操作区                                    │
│  ├ AI 对话    │                                              │
│  ├ 文本生成   │                                              │
│  ├ 图片生成   │                                              │
│  ├ 视频生成   │                                              │
│  ├ WebUI      │                                              │
│  ├ ComfyUI    │                                              │
│  ├ LoRA 训练  │                                              │
│  └ AI 应用    │                                              │
│ 资产          │                                              │
│ ─────────     │                                              │
│ 个人中心      │                                              │
│ 创作中心      │                                              │
│ 会员中心      │                                              │
│ 会员超市      │                                              │
│ 邀请有礼      │                                              │
│ 发布          │                                              │
│ 教程          │                                              │
│ API           │                                              │
│               │                                              │
│ 底部：主题/返回│                                              │
└───────────────┴──────────────────────────────────────────────┘
```

### 4.2 顶部导航规则

| 场景 | 顶部公开导航 | AI 顶部工具条 | 说明 |
|---|---|---|---|
| `/`、`/content`、`/projects`、`/about` | 显示 | 不显示 | 公开站点体验 |
| `/ai`、`/ai/*` | 隐藏 | 显示 | AI 独立工作台 |
| `/workspace/*` | 不显示公开导航 | ProLayout 顶栏 | 工作区 |
| `/admin/*` | 不显示公开导航 | ProLayout 顶栏 | 后台 |

AI 工作台返回首页提供两种方式：

1. 左侧栏顶部 Logo 点击回 `/`。
2. 左侧栏底部固定“返回首页”图标按钮。

如果后续要做“鼠标 hover 到顶部显示返回栏”，可以作为增强项；首版优先用明确图标，交互更稳定。

### 4.3 响应式

| 视口 | 行为 |
|---|---|
| ≥ 1200px | 左侧栏 248px 展开，页面主体最多保留必要内边距 |
| 768px–1199px | 左侧栏可折叠为 72px 图标栏，创作子菜单用浮层展开 |
| < 768px | 左侧栏变抽屉；工具页面保留底部快捷操作区 |

侧边栏交互约定：

- 默认沿用 Ant Design Pro / ProLayout 的折叠体验和动效。
- 展开态展示图标 + 文案 + 分组标题；折叠态只展示图标，hover 展示 Tooltip。
- 当前品牌名从系统配置读取，默认 `Personal Hub AI`。
- 折叠状态可以先放在本地 model，后续可持久化到用户偏好。

---

## 5. AI 信息架构与路由

### 5.1 用户端路由

| 分组 | 路由 | 页面 | 阶段 5 状态 |
|---|---|---|---|
| 首页 | `/ai` | AI 首页 / 工具聚合 | 必做 |
| 创作 | `/ai/chat` | AI 对话 | 必做 |
| 创作 | `/ai/text` | 文本生成 | 必做 |
| 创作 | `/ai/image` | 图片生成 | 必做 |
| 创作 | `/ai/video` | 视频生成 | mock 创作流 |
| 创作 | `/ai/webui` | WebUI | 占位 |
| 创作 | `/ai/comfyui` | ComfyUI | 占位 |
| 创作 | `/ai/lora` | LoRA 训练 | 占位 |
| 创作 | `/ai/apps` | AI 应用 | 占位 + 工具卡片 |
| 资产 | `/ai/assets` | 我的 AI 资产 | mock 列表 |
| 个人 | `/ai/profile` | AI 个人中心 | mock |
| 个人 | `/ai/creation-center` | 创作中心 | mock 任务列表 |
| 商业化 | `/ai/membership` | 会员中心 | mock |
| 商业化 | `/ai/plans` | 会员超市 / 套餐 | mock |
| 商业化 | `/ai/invite` | 邀请有礼 | mock |
| 分发 | `/ai/publish` | 发布 | 占位 |
| 帮助 | `/ai/tutorials` | 教程 | mock |
| 开放能力 | `/ai/api` | API | mock |

### 5.2 工作区联动

| 路由 | 处理 |
|---|---|
| `/workspace/ai/history` | 可保留为工作区入口，但点击会跳到 `/ai/chat?sessionId=xxx` |
| `/workspace/usage` | 继续作为通用用量页，AI 工作台也有 `/ai/membership` 和 `/ai/profile` 快捷入口 |
| 内容阅读页“引用到 AI” | 跳 `/ai/chat?contentId=xxx&mode=quote` |

---

## 6. 页面布局细化

### 6.1 AI 首页 `/ai`

```txt
┌──────────────────────────────────────────────────────┐
│ 顶部工具条：搜索工具 / Token 余额 / 登录或头像        │
├──────────────────────────────────────────────────────┤
│ 快捷创作：AI 对话、文本生成、图片生成、AI 应用         │
├──────────────────────────┬───────────────────────────┤
│ 最近创作任务              │ 推荐模板 / 灵感示例         │
├──────────────────────────┴───────────────────────────┤
│ 工具卡片网格：按 对话 / 文本 / 图片 / 视频 / 工作流 分组│
└──────────────────────────────────────────────────────┘
```

关键控件：

- 工具搜索框：按工具名、标签、能力搜索。
- 最近任务：展示最近 5 条会话/文本/图片任务。
- 推荐模板：如“写周报”“生成封面图”“提炼文章摘要”。
- 禁用工具：灰态展示，按钮为“即将上线”。

模板卡片视觉：

- 首页模板区参考附件图的卡片密度和 hover 交互。
- 卡片默认展示封面图、模板标题、简短描述、热度/使用次数等辅助信息。
- hover 后顶部浮层展示模型名或模型标签，例如 `Seedream 4.5`、`Qwen-Image`。
- hover 后底部浮层展示“使用模板”主按钮。
- 点击“使用模板”进入对应工具页，并把模板 prompt、模型、尺寸、风格等参数预填入输入区。

### 6.2 AI 对话 `/ai/chat`

```txt
┌───────────────┬──────────────────────────┬───────────────┐
│ 会话列表       │ 消息区                    │ 设置面板        │
│ + 新对话       │ 顶部：模型 / 引用内容       │ System Prompt  │
│ 搜索会话       │ 消息气泡 / Markdown / 代码  │ 温度 / 上下文数 │
│ 会话分组       │ 底部输入框                 │ 引用素材列表    │
└───────────────┴──────────────────────────┴───────────────┘
```

必做交互：

- 新建、切换、重命名、删除会话。
- 发送、停止生成、重新生成。
- AI 回复支持复制、重新生成、反馈。
- 支持引用内容：从内容中心选择一篇 mock 内容，作为上下文 chip 显示。
- 模拟流式输出：逐段追加文本，支持中断。
- 错误态：Token 不足、模型禁用、网络失败。

输入区约定：

- 参考 ChatGPT / DeepSeek：底部固定输入区，圆角容器，多行输入，支持 Enter 发送、Shift + Enter 换行。
- 输入区内保留附件、引用内容、模型/工具快捷入口和发送/停止按钮。
- 附件和引用内容以 chip 或缩略卡展示在输入框上方或输入框内部顶部。
- 生成中时发送按钮切换为停止按钮，停止后保留已生成内容。

### 6.3 文本生成 `/ai/text`

```txt
┌──────────────────────────────────────────────────────┐
│ 场景 Tabs：写作 / 改写 / 摘要 / 扩写 / 翻译 / 自定义  │
├─────────────────────────────┬────────────────────────┤
│ 输入与模板区                  │ 参数区                 │
│ 原文输入                      │ 模型、语气、长度、语言 │
│ Prompt 模板变量               │ 生成按钮、Token 预估   │
├─────────────────────────────┴────────────────────────┤
│ 输出区：流式结果 / 复制 / 重新生成 / 保存到资产       │
└──────────────────────────────────────────────────────┘
```

首版模板：

| 场景 | 输入字段 | 输出目标 |
|---|---|---|
| 写作辅助 | 主题、受众、要求 | 大纲 + 开头段落 |
| 改写润色 | 原文、语气 | 改写结果 |
| 摘要提炼 | 原文、摘要长度 | 要点列表 |
| 扩写 | 原文、扩写方向 | 长文段落 |
| 翻译 | 原文、目标语言 | 翻译文本 |
| 自定义 | 指令、原文 | 自定义输出 |

### 6.4 图片生成 `/ai/image`

```txt
┌──────────────────────────────────────────────────────┐
│ 左侧主内容流：用户输入卡片 + AI 图片输出卡片           │
│                                                      │
│ 用户：Prompt / 参数 / 附件图                          │
│ AI：生成中骨架 → 图片网格 1/2/4                       │
│     hover：引用为附件 / 下载 / 查看详情                │
│     底部：再次编辑 / 重新生成                          │
├──────────────────────────────────────────────────────┤
│ 底部输入区：Prompt、附件、尺寸、风格、数量、模型、Seed  │
└──────────────────────────────────────────────────────┘
```

必做交互：

- 风格标签点击追加到 Prompt。
- 数量切换影响结果骨架数量。
- 生成失败时保留参数并允许重试。
- 图片详情预览显示 Prompt、模型、尺寸、消耗 Token。
- 用户输入和 AI 输出都进入左侧主内容流，而不是左右分栏割裂展示。
- 图片 hover 时显示“引用为附件”“下载”“查看详情”。
- AI 输出底部提供“再次编辑”和“重新生成”。
- 再次编辑会把本次用户输入内容、参数和附件图重新填充到底部输入区。
- 重新生成会把当前用户输入内容和参数再次发送给后端。

### 6.5 视频生成 `/ai/video`

阶段 5 视频生成先做 mock 创作流，交互结构与图片生成保持一致：

- 用户输入和 AI 输出统一进入左侧主内容流。
- 输出区域展示视频封面、生成状态、时长、模型、尺寸等 mock 信息。
- 视频 hover 时显示“引用为附件”“下载”“查看详情”。
- AI 输出底部提供“再次编辑”和“重新生成”。
- 再次编辑回填 prompt、参考图/视频附件、模型、比例、时长等参数。
- 重新生成复用当前输入再次发起 mock 请求。
- 暂不做真实视频生成、真实转码、真实播放器高级能力。

### 6.6 占位工具页

WebUI、ComfyUI、LoRA 训练、AI 应用先不做真实功能，但需要有统一占位模板：

- 工具说明。
- 当前能力状态。
- 预计需要的后端能力。
- “订阅上线提醒” mock 按钮。

---

## 7. Mock 数据与接口契约

建议新增：

```txt
apps/react-web/
├── mock/ai.ts
├── mock/data/ai-store.ts
├── packages/shared-types/src/ai.ts
├── src/services/ai.ts
├── src/models/ai.ts
├── src/layouts/AiLayout/
├── src/components/ai-x/
├── src/components/ai/
├── src/styles/ai-tokens.less
├── src/styles/ai-layout.less
├── src/styles/ai-components.less
├── src/styles/ai-motion.less
├── src/pages/ai/Home/
├── src/pages/ai/Chat/
├── src/pages/ai/Text/
├── src/pages/ai/Image/
├── src/pages/ai/Video/
├── src/pages/ai/PlaceholderTool/
├── src/pages/ai/Assets/
├── src/pages/ai/Membership/
├── src/pages/admin/AiConfig/
└── src/pages/admin/AiStats/
```

### 7.1 用户端接口

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/ai/tools` | 工具、分组、启用状态、侧边栏配置 |
| `GET` | `/api/ai/models` | 当前用户可见模型 |
| `GET` | `/api/ai/sessions` | 会话列表 |
| `POST` | `/api/ai/sessions` | 新建会话 |
| `PATCH` | `/api/ai/sessions/:id` | 重命名 / 更新 system prompt |
| `DELETE` | `/api/ai/sessions/:id` | 删除会话 |
| `GET` | `/api/ai/sessions/:id/messages` | 消息列表 |
| `POST` | `/api/ai/sessions/:id/messages` | 发送消息，mock 返回完整文本或模拟流 |
| `POST` | `/api/ai/text/generate` | 文本生成 |
| `POST` | `/api/ai/image/generate` | 图片生成 |
| `POST` | `/api/ai/video/generate` | 视频生成 mock |
| `GET` | `/api/ai/assets` | AI 资产列表 |
| `POST` | `/api/ai/assets` | 保存 mock 结果到资产 |
| `GET` | `/api/usage/summary` | 用量汇总 |
| `GET` | `/api/usage/logs` | 用量明细 |

### 7.2 后台接口

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/admin/ai/providers` | 厂商列表 |
| `POST` | `/api/admin/ai/providers` | 新增厂商 |
| `PATCH` | `/api/admin/ai/providers/:id` | 编辑厂商 |
| `GET` | `/api/admin/ai/models` | 模型列表 |
| `POST` | `/api/admin/ai/models` | 新增模型 |
| `PATCH` | `/api/admin/ai/models/:id` | 编辑模型 |
| `GET` | `/api/admin/ai/tools` | 工具启用与展示配置 |
| `PATCH` | `/api/admin/ai/tools/:id` | 更新工具启用、排序、默认模型 |
| `GET` | `/api/admin/ai/stats/summary` | AI 统计汇总 |
| `GET` | `/api/admin/ai/stats/trend` | AI 消耗趋势 |

---

## 8. Mock 数据要求

### 8.1 工具

至少准备：

- AI 对话：enabled。
- 文本生成：enabled。
- 图片生成：enabled。
- 视频生成：disabled / coming soon。
- WebUI：disabled。
- ComfyUI：disabled。
- LoRA 训练：disabled。
- AI 应用：enabled，占位工具集合。

### 8.2 模型

- `qwen-turbo`：chat/text 默认启用。
- `qwen-plus`：chat/text 启用，非默认。
- `gpt-4o-mini`：chat/text 启用，模拟备用厂商。
- `dall-e-3`：image 默认启用。
- `disabled-demo-model`：禁用，用于验证前台不可选。

### 8.3 会话

至少准备 6 条：

- 正常多轮会话。
- 带引用内容的会话。
- 最后一条生成失败的会话。
- 空会话。
- 消耗 Token 较高的会话。
- 从内容阅读页引用进入的会话。

### 8.4 用量与会员

至少准备：

- Token 余额：正常、低余额、不足三种。
- 近 30 天趋势。
- chat/text/image 三类明细。
- 访客超限计数。
- 会员套餐 mock：免费、基础、专业。
- 邀请记录 mock：待领取、已领取。

### 8.5 图片与资产

至少准备：

- 1 张、2 张、4 张结果。
- 生成中任务。
- 生成失败任务。
- 资产类型：图片、文本、对话摘要。
- 资产状态：草稿、已保存、已发布占位。

### 8.6 视频

至少准备：

- 生成中任务。
- 生成成功任务：封面、视频 URL mock、时长、比例、模型。
- 生成失败任务。
- 带参考图的任务。
- 带再次编辑 / 重新生成链路的任务。

### 8.7 资产分类建议

结合常见 AI 创作平台做法，资产首版建议采用“来源 + 类型 + 使用状态”的混合组织，不要一开始做太复杂：

| 分类 | 说明 |
|---|---|
| 全部 | 所有资产统一入口 |
| 生成结果 | AI 生成的图片、视频、文本、对话摘要 |
| 上传素材 | 用户上传的参考图、参考视频、附件文件 |
| 收藏 | 用户手动标记的重要结果 |
| 项目文件夹 | 用户按项目或主题自建文件夹 |
| 最近使用 | 最近被引用、编辑、下载的资产 |
| 已分享 | 后续公开分享或发布过的资产 |
| 回收站 | 删除后的短期保留区 |

首版页面筛选维度：

- 类型：图片、视频、文本、对话、附件。
- 来源：生成、上传、内容引用。
- 状态：草稿、已保存、已发布占位、失败。
- 模型：按模型筛选，便于复用同类风格。

---

## 9. 前端状态流

### 9.1 Chat

1. 页面进入：拉模型列表、会话列表、当前 Token。
2. 新建会话：创建临时选中态。
3. 发送消息：追加 user 消息，创建 assistant streaming 消息。
4. mock 流：逐段追加 assistant content。
5. 完成：assistant 状态改为 `done`，刷新用量。
6. 停止：状态改为 `stopped`，保留已生成内容。
7. 失败：状态改为 `error`，允许重新生成。
8. 删除会话：二次确认，删除后选中下一条。

### 9.2 Text

1. 选择场景。
2. 填输入和参数。
3. 校验字数、登录态、Token。
4. 生成输出，支持停止、复制、重新生成。
5. 保存到资产：生成一条 text asset mock。

### 9.3 Image

1. 填 Prompt、尺寸、数量、风格。
2. 登录态和 Token 校验。
3. 发送后在左侧主内容流追加用户输入卡片。
4. 展示 AI 生成中骨架。
5. 成功后在 AI 输出卡片中显示图片网格。
6. hover 单图支持引用为附件、下载、查看详情。
7. “再次编辑”回填输入和附件；“重新生成”复用输入再次请求。
8. 失败显示错误态，允许重试。

### 9.4 Video

1. 填 Prompt、参考图/视频、比例、时长、模型。
2. 登录态和 Token 校验。
3. 发送后在左侧主内容流追加用户输入卡片。
4. 展示 AI 视频生成中状态。
5. 成功后显示视频输出卡片。
6. hover 视频支持引用为附件、下载、查看详情。
7. “再次编辑”回填输入、附件和参数；“重新生成”复用输入再次请求。
8. 失败显示错误态，允许重试。

---

## 10. 权限和限制

阶段 5 暂沿用当前简化权限：

- `ai:use`：允许使用 AI 工具。
- `ai:manage`：允许后台 AI 配置。

长期权限会细化为：

- `ai:chat`
- `ai:text`
- `ai:image`
- `ai:asset:manage`
- `system:ai:config`
- `system:ai:stats`

如果阶段 5 启动前已完成权限契约统一，页面应直接使用长期权限点。

---

## 11. 实施顺序

1. AI Layout：左侧栏、顶部工具条、返回首页、响应式。
2. AI 首页：工具聚合、最近任务、推荐模板。
3. Chat：会话与 mock 流式输出。
4. Text：模板、参数、输出。
5. Image / Video：对话式生成流、结果 hover 操作、资产保存。
6. Assets / Membership / Tutorials / API：mock 页面。
7. Admin AI Config / Stats：后台配置影响用户端。
8. 用量联动：Token 余额与明细刷新。

---

## 12. 分批开发建议

为降低阶段 5 一次性开发风险，建议拆成 5 个可验收批次：

| 批次 | 目标 | 主要文件 | 完成标准 |
|---|---|---|---|
| 5.1 AI 壳层与本地封装 | 建立 `AiLayout`、`ai-x` 全量封装、AI 样式 token | `src/layouts/AiLayout`、`src/components/ai-x`、`src/styles/ai-*.less`、`config/routes.ts` | `/ai` 进入独立工作台；页面层不直接引用 Ant Design X |
| 5.2 AI mock 契约 | 补共享类型、mock store、service、model | `packages/shared-types/src/ai.ts`、`mock/ai.ts`、`mock/data/ai-store.ts`、`src/services/ai.ts`、`src/models/ai.ts` | 工具、模型、用量、会话、资产接口可用 |
| 5.3 Chat 创作流 | 多会话、流式、停止、重新生成、引用内容 | `src/pages/ai/Chat`、`src/components/ai/AiChatWorkspace` | Chat 核心交互闭环 |
| 5.4 Text/Image/Video 创作流 | 文本模板、图片/视频对话式生成、结果 hover 操作、资产保存 | `src/pages/ai/Text`、`src/pages/ai/Image`、`src/pages/ai/Video`、`src/components/ai/AiTextGenerator`、`AiImageGenerator` | 文本/图片/视频生成具备完整状态 |
| 5.5 资产/会员/后台配置 | 资产、会员、教程/API、后台配置和统计 | `src/pages/ai/Assets`、`Membership`、`Tutorials`、`Api`、`src/pages/admin/AiConfig`、`AiStats` | 禁用模型/工具能影响用户端 |

每批完成后补一条实现记录到 `docs/implementation/react-first/`；如果 Chat 或本地封装有明显学习价值，再补 `study/features/ai-ant-design-x-wrapper.md`。

---

## 13. 验收标准

1. 访客打开 `/ai` 后进入 AI 专属布局，公开顶部导航隐藏，登录按钮仍可见。
2. 左侧栏包含首页、创作分组、资产、个人中心、创作中心、会员中心、会员超市、邀请有礼、发布、教程、API、返回首页。
3. Chat 可创建、切换、重命名、删除会话；发送后模拟流式输出；可停止和重新生成。
4. 文本生成至少 6 个场景可模拟生成。
5. 图片生成可按 1/2/4 张展示 mock 图片，支持失败、引用为附件、下载、查看详情、再次编辑、重新生成。
6. 视频生成具备 mock 创作流，支持失败、引用为附件、下载、查看详情、再次编辑、重新生成。
7. `/ai/assets` 可看到保存过的 mock 结果，并支持推荐分类筛选。
8. `/workspace/ai/history` 可跳转到 `/ai/chat?sessionId=xxx` 继续对话。
9. `/workspace/usage` 与 AI 工具内 Token 余额保持一致。
10. `/admin/ai/config` 禁用模型后，用户端模型下拉不再展示该模型。
11. TypeScript、Biome、测试命令通过；浏览器无新增 error overlay。
12. `src/pages/ai/*` 不直接 import `@ant-design/x`、`@ant-design/x-markdown`、`@ant-design/x-sdk`。
13. 390px、768px、1440px 三档视口下，AI 侧栏/抽屉、输入区、图片/视频结果区不重叠。
14. Token 不足、访客超限、模型禁用、生成失败、停止生成都有明确反馈和恢复路径。
15. 内容详情页带 `contentId` 跳转 `/ai/chat?contentId=xxx&mode=quote` 后，Chat 能展示引用 chip。
16. AI 品牌名从系统配置读取，默认 `Personal Hub AI`。

---

## 14. 需要用户后续确认

- 首版默认模型厂商：继续用阿里云百炼 Qwen，还是以 OpenAI mock 命名为主。
- 未登录试用额度：是否保持 Chat 3 轮、文本 3 次。
- 图片生成的 Token 折算：是否保持 1 张 500 Token。
- 阶段 5 是否要把“引用当前内容到 AI”做成详情页固定按钮，还是只在 Chat 内选择内容。
- 图片/视频生成的具体参数项是否先按通用版实现，后续再补高级参数。
- AI 资产分类是否采用本文推荐方案。
