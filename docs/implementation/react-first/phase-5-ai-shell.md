# 阶段 5 AI 工作台基础壳层

> 状态：已完成首批骨架与 mock 交互补强
> 最后更新：2026-07-06
> 对应 PRD：[../../prd/react-first/phase-5-ai-platform-prd.md](../../prd/react-first/phase-5-ai-platform-prd.md)

## 1. 目标与范围

本轮目标是在不影响公开前台、工作区和后台页面的前提下，为阶段 5 建立 AI 专属工作台基础：

- 新增 AI 独立布局、侧边栏和顶部工具条。
- 建立 `components/ai-x` 本地封装层，页面不直接依赖 Ant Design X。
- 建立 `components/ai` 业务组件层。
- 补齐 AI mock 数据、service 契约和共享类型。
- 将 `/ai/*` 路由切到 AI 专属布局。
- 补齐 AI Layout 移动端抽屉导航，`<768px` 下通过顶部菜单打开侧栏。
- 补强 Chat mock 发送、停止生成、重新生成，以及会话新建、切换、重命名、删除。
- 补强 Chat AI 回复消息操作，支持复制、重新生成和点踩反馈 mock 持久化。
- 补强文本生成的场景参数、Token 预估、mock 流式输出、停止、复制、重新生成和保存到资产动作。
- 补强图片/视频再次编辑、重新生成和引用为附件。
- 补强图片/视频 mock 参数面板、1/2/4 结果数量、失败态和详情预览。
- 补强图片/视频 mock 生成结果保存到 AI 资产库，生成后可在 `/ai/assets` 中继续管理。
- 补强用户端模型下拉与后台 AI 模型配置的 mock 联动，禁用或隐藏模型不再展示给用户端。
- 补强 AI 资产来源分类、项目文件夹、最近使用、已分享和回收站筛选。
- 补齐后台 AI 配置和 AI 统计 mock 页面，形成阶段 5 首版配置/用量闭环。
- 补齐 `/workspace/ai/history` 工作区 AI 历史入口，支持继续对话、重命名、删除和批量删除。
- 补齐内容详情页“引用到 AI”入口，支持跳转 Chat 并展示引用 chip。
- 补强 AI 资产详情、移入回收站、恢复、永久删除和批量操作。
- 补强 AI Layout 运行时配置读取，品牌名和 Token 余额统一从 `src/models/ai.ts` 的 mock 首页配置派生。
- 补强用户端工具启停与后台 AI 工具配置的 mock 联动，AI 首页和侧边栏入口统一展示可用、即将上线和暂不可用状态。
- 补强后台 AI 工具状态 mock 保存，管理员可在 `/admin/ai/config` 修改工具状态并同步影响用户端 `/api/ai/tools`、AI 首页和侧边栏。
- 补强 AI 资产移动到项目文件夹能力，支持单个资产、批量资产移动到已有文件夹或取消归档。
- 补强 Chat 会话级模型选择与 System Prompt 高级设置，支持上下文窗口和知识引用开关的 mock 状态流。
- 补强 Chat 输入区内容引用选择器，可从内容中心 mock 列表选择引用内容并作为上下文发送。
- 补强 Chat 输入区 mock 附件选择器，可添加样例图片、文档、视频附件并作为上下文发送。
- 补强文本、图片、视频生成的访客试用提示和超限 mock 拦截，可通过 `guestMode=1&guestLimit=exceeded` 验证超限分支。
- 补强 AI 资产项目文件夹 mock 管理，支持新建文件夹、重命名文件夹和删除空文件夹。
- 补强后台 AI 模型基础配置保存，管理员可编辑展示名、启用、用户可见、默认模型、上下文和计费字段，并同步影响用户端模型下拉。
- 补强后台 AI 工具完整配置保存，管理员可编辑工具状态、默认模型、计费说明和访客试用开关，并同步影响用户端 AI 首页和侧边栏。
- 补强后台 AI 厂商基础配置保存，管理员可编辑展示名、Base URL、启用状态和只写 API Key mock 脱敏值，并同步同厂商模型展示名。
- 补强后台 AI 品牌配置保存，管理员可编辑 AI 品牌名和 Logo 文案，并同步影响用户端 AI Layout 和首页展示。
- 补强后台 AI 工具排序 mock 保存，管理员可上移/下移工具或手动编辑展示顺序，并同步影响用户端 AI 首页工具卡片顺序。
- 补强后台 AI 模型新增/删除 mock 保存，管理员可新增模型、删除模型，并同步影响用户端模型下拉和工具默认模型回落。
- 补强文本、图片、视频生成的 Token 余额不足提示和前端 mock 拦截，引导用户进入会员中心查看额度。
- 补强文本、图片、视频生成成功后的 mock Token 扣减，并让 AI 工作台余额、会员中心和 `/workspace/usage` 使用同一份 quota 数据。

本轮不包含：

- 真实 AI 厂商调用。
- 真实 SSE 流式接口。
- 后台 AI 配置的真实新增、编辑、保存。
- 图片/视频真实生成、真实下载和真实资产持久化。

## 2. 页面与入口

新增或升级入口：

- `/ai`：AI 工作台首页，展示工具、Token 摘要和推荐模板。
- `/ai/chat`：AI 对话 mock 页面，包含会话列表、会话搜索、消息气泡和底部输入区。
- `/ai/chat`：AI 对话 mock 页面，包含会话列表、新建对话、搜索、重命名、删除、消息气泡和底部输入区。
- `/ai/chat`：底部输入区新增高级设置，支持模型选择、System Prompt、上下文窗口和知识内容引用开关。
- `/ai/text`：文本生成 mock 页面，包含 6 个场景、参数面板、Token 预估、流式输出区和保存到资产。
- `/ai/image`：图片生成 mock 对话流，包含参数面板、1/2/4 结果、失败态、详情预览、再次编辑和重新生成。
- `/ai/video`：视频生成 mock 对话流，包含比例、时长、模型、失败态、详情预览、再次编辑和重新生成。
- `/ai/assets`：AI 资产 mock 列表，包含分类侧栏、项目文件夹、统计摘要和资产卡片。
- `/ai/membership`、`/ai/plans`：会员中心 mock。
- `/ai/profile`、`/ai/creation-center`、`/ai/invite`、`/ai/publish`、`/ai/tutorials`、`/ai/api`、`/ai/webui`、`/ai/comfyui`、`/ai/lora`、`/ai/apps` 等：路由感知的 mock 占位页。
- `/admin/ai/config`：后台 AI 配置 mock，展示厂商、模型和工具启停。
- `/admin/ai/stats`：后台 AI 统计 mock，展示 Token、调用次数、费用、用户排行和模型分布。
- `/workspace/ai/history`：工作区 AI 历史入口，复用 AI 会话 mock 数据并跳转 AI Chat 继续对话。
- `/content/:id`：内容详情页新增“引用到 AI”入口，跳转 `/ai/chat?contentId=xxx&mode=quote`。

公开页面 `/content` 仍使用 `PublicLayout`，未被 AI Layout 影响。

## 3. 接口与数据流

共享类型：

- `packages/shared-types/src/ai.ts`
- `packages/shared-types/src/admin.ts`
- `packages/shared-types/src/index.ts`
- `AiAsset` 已预留 `folderId`、`folderName`、`lastUsedAt`、`shared`、`content`，`AiAssetStatus` 已包含 `trashed`，用于资产分类、最近使用、分享、文本内容详情和回收站。
- `AiAssetCreateInput` 用于把文本、图片、视频等生成结果保存到 AI 资产库；阶段 5 先由 mock store 补齐 id、时间、默认文件夹和状态。
- `AiQuotaConsumeInput`、`AiUsageLogItem` 用于阶段 5 mock Token 扣减和用量明细，后续可映射到真实 `token_transactions`。
- `AiAssetFolderMutationInput` 用于资产移动到项目文件夹；`folderId` 为空表示取消归档。
- `AiAssetFolder` 用于独立维护项目文件夹，支持空文件夹存在；`AiAssetFolderNameInput` 用于新建和重命名文件夹。
- `AiGenerationParams` 已补充 `count?: 1 | 2 | 4`，用于图片/视频生成结果数量和后续真实接口契约。
- `AiTextGenerateInput`、`AiTextGenerateResult`、`AiMediaGenerateInput`、`AiMediaGenerateResult` 已补齐，用于把文本、图片、视频生成动作从页面本地拼装推进到稳定 service/mock 契约。
- `AdminAiBrandingConfig`、`AdminAiBrandingMutationInput` 已补齐，用于后台配置 AI 品牌名和 Logo 文案。
- `AdminAiConfigData`、`AdminAiStatsData` 已补齐，用于后台 AI 配置和统计页。
- `AdminAiProviderMutationInput` 用于后台 AI 厂商基础配置保存，`apiKey` 按只写字段处理，响应只回传脱敏后的 `apiKeyMasked`。
- `AdminAiModelCreateInput` 用于后台 AI 模型新增，包含模型 ID、厂商、支持工具、可见性、默认标记、上下文和计费字段。
- `AdminAiModelMutationInput` 用于后台 AI 模型基础配置保存，阶段 5 暂不开放厂商和模型 ID 迁移。
- `AdminAiToolMutationInput` 用于后台 AI 工具完整配置保存，阶段 5 暂不开放工具级权限。

mock 数据：

- `apps/react-web/mock/data/ai-store.ts`
- `apps/react-web/mock/ai.ts`
- `apps/react-web/mock/data/admin-store.ts`
- `apps/react-web/mock/admin.ts`
- `/api/ai/models` 当前从 `adminAiConfigData.models` 派生，只返回 `enabled && visibleToUser` 的模型，保证后台模型启停和用户端下拉保持同一份 mock 契约。
- `/api/ai/tools` 当前从 `adminAiConfigData.tools` 派生工具状态、默认模型、计费文案、游客试用开关和展示顺序，并合并 `ai-store.ts` 中的展示文案、图标、路径和分组信息。
- `/api/ai/home` 复用同一份派生后的工具和模型数据，避免首页、Layout 和独立工具接口状态不一致；首页工具卡片按后台工具 `sort` 展示。
- `/api/ai/home` 的 `brandName` 当前从后台 AI 品牌配置派生，默认 `Personal Hub AI`，用于 AI Layout 和首页统一展示。
- `/api/ai/home` 新增 `recentActivities`，从最近 Chat 会话和文本/图片/视频生成任务派生，供 AI 首页“最近创作”统一展示和跳转。
- `POST /api/ai/text/generate` 当前返回完整 Markdown、预计 Token 和生成任务；页面继续把完整文本拆分为本地流式播放，后续可替换为真实 SSE。
- `POST /api/ai/image/generate`、`POST /api/ai/video/generate` 当前统一生成 mock task，并在成功时通过 mock store 写入 AI 资产库；失败分支返回 `status=failed` 的 task，不写入资产。
- `POST /api/ai/assets` 当前支持把生成结果保存到 `aiAssets` 内存态；文本生成默认保存为 `type=text`、`source=generated`、`status=saved`，并归档到“写作素材”。
- `POST /api/ai/quota/consume` 当前支持 mock 扣减 Token 并写入 `aiUsageLogs`；余额不足时返回 `reason=insufficient` 且不扣减。
- `/api/workspace/usage` 当前从 `aiQuota` 和 `aiUsageLogs` 派生，保证工作区“我的用量”和 AI 工作台顶部余额一致。
- `PUT /api/admin/ai/providers/:code` 当前支持 mock 更新厂商展示名、Base URL、启用状态和 API Key 脱敏值；厂商名称变更会同步同厂商模型的 `providerName`，用户端 `/api/ai/models` 会在下一次请求时读取最新名称。
- `PUT /api/admin/ai/tools/:code/status` 当前支持 mock 更新工具状态，并直接写入 `adminAiConfigData.tools` 内存态；用户端工具接口会在下一次请求时读取最新状态。
- `PUT /api/admin/ai/tools/:code` 当前支持 mock 更新工具状态、默认模型、计费说明和访客试用开关；用户端 `/api/ai/tools`、`/api/ai/home` 会在下一次请求时读取最新状态。
- `POST /api/admin/ai/tools/:code/move` 当前支持 mock 上移/下移工具排序；用户端 `/api/ai/tools`、`/api/ai/home` 会在下一次请求时读取最新顺序。
- `POST /api/admin/ai/models` 当前支持 mock 新增模型；新增后 `/api/ai/models` 会按 `enabled && visibleToUser` 派生给用户端。
- `PUT /api/admin/ai/models/:id` 当前支持 mock 更新模型展示名、启用、用户可见、默认标记、上下文和价格；用户端 `/api/ai/models` 会在下一次请求时读取最新状态。
- `DELETE /api/admin/ai/models/:id` 当前支持 mock 删除模型；删除后会清理工具默认模型引用，并尝试回落到同工具类型的其它可用模型。

service：

- `apps/react-web/src/services/ai.ts`
- `apps/react-web/src/services/ai.ts` 中新增 `generateAiText`、`generateAiImage`、`generateAiVideo`，用于文本、图片、视频生成 mock 契约。
- `apps/react-web/src/services/admin/index.ts` 中新增 `fetchAdminAiConfig`、`fetchAdminAiStats`。
- `apps/react-web/src/services/admin/index.ts` 中新增 `updateAdminAiBrandingConfig`，用于后台 AI 品牌配置 mock 保存。
- `apps/react-web/src/services/admin/index.ts` 中新增 `updateAdminAiProviderConfig`，用于后台 AI 厂商基础配置 mock 保存。
- `apps/react-web/src/services/admin/index.ts` 中新增 `updateAdminAiToolStatus`，用于后台 AI 工具状态 mock 保存。
- `apps/react-web/src/services/admin/index.ts` 中新增 `updateAdminAiToolConfig`，用于后台 AI 工具完整配置 mock 保存。
- `apps/react-web/src/services/admin/index.ts` 中新增 `moveAdminAiToolSort`，用于后台 AI 工具上移/下移 mock 保存。
- `apps/react-web/src/services/admin/index.ts` 中新增 `updateAdminAiModelConfig`，用于后台 AI 模型基础配置 mock 保存。
- `apps/react-web/src/services/admin/index.ts` 中新增 `createAdminAiModelConfig`、`deleteAdminAiModelConfig`，用于后台 AI 模型新增/删除 mock 保存。
- `apps/react-web/src/services/workspace.ts` 中新增 `fetchWorkspaceAiHistory`、`renameWorkspaceAiHistory`、`deleteWorkspaceAiHistory`、`batchDeleteWorkspaceAiHistory`。
- `apps/react-web/src/services/ai.ts` 中新增 AI 资产移入回收站、恢复、永久删除和批量操作接口。
- `apps/react-web/src/services/ai.ts` 中新增 `createAiAsset`，用于保存 AI 生成结果到资产库。
- `apps/react-web/src/services/ai.ts` 中新增 `consumeAiQuota`，用于生成成功后的 mock Token 扣减和余额刷新。
- `apps/react-web/src/services/ai.ts` 中新增 `moveAiAssetToFolder`、`batchMoveAiAssetsToFolder`，用于单个和批量移动资产到项目文件夹。
- `apps/react-web/src/services/ai.ts` 中新增 `fetchAiAssetFolders`、`createAiAssetFolder`、`renameAiAssetFolder`、`deleteAiAssetFolder`，用于阶段 5 项目文件夹 mock 管理。
- `apps/react-web/src/services/ai.ts` 中新增 `createAiSession`、`updateAiSession`、`deleteAiSession`、`persistAiChatMessages`，用于 Chat 会话、会话级设置和完成消息写入统一 mock store。
- `apps/react-web/src/services/ai.ts` 中新增 `updateAiMessageFeedback`，用于保存或取消 AI 回复点踩反馈。

当前页面数据流：

```txt
页面 useRequest
  ↓
src/services/ai.ts
  ↓
mock/ai.ts
  ↓
mock/data/ai-store.ts
```

注意：项目内 `useRequest` 已自动解包 `ApiResponse.data`，页面拿到的 `data` 就是业务数据，不需要再访问 `data.data`。

后台 AI 管理数据流：

```txt
admin/AiConfig、admin/AiStats
  ↓
src/services/admin/index.ts
  ↓
mock/admin.ts
  ↓
mock/data/admin-store.ts
```

工作区 AI 历史数据流：

```txt
workspace/AiHistory
  ↓
src/services/workspace.ts
  ↓
mock/workspace.ts
  ↓
mock/data/ai-store.ts 中的 aiConversations
```

AI 资产操作数据流：

```txt
ai/Assets
  ↓
src/services/ai.ts
  ↓
mock/ai.ts
  ↓
mock/data/ai-store.ts 中的 aiAssets
```

内容引用到 AI 数据流：

```txt
public/ContentDetail
  ↓
/ai/chat?contentId=xxx&mode=quote
  ↓
ai/Chat 读取 URL 参数
  ↓
src/services/content.ts 获取内容详情
  ↓
展示引用 chip 并预填输入区
```

## 4. 关键实现

AI Layout：

- `apps/react-web/src/layouts/AiLayout/index.tsx`
- 使用独立 `.ph-ai-*` class，避免污染既有公开页、工作区和后台。
- 侧边栏折叠/展开复用 Ant Design Pro 类似交互。
- 侧边栏导航抽为 `AiNavigation`，桌面侧栏和移动端抽屉共用同一份菜单数据，避免新增 AI 工具入口时两端不一致。
- 侧边栏已补齐 PRD 中的创作中心、发布、教程、API、邀请等入口，路由仍集中在 `/ai/*` 下。
- `<768px` 下隐藏桌面侧栏，顶部工具条显示菜单按钮；点击后打开 Ant Design `Drawer`，选择导航或返回首页后自动关闭抽屉。
- 品牌名默认 `Personal Hub AI`，也可从 mock 首页数据传入。
- 品牌名已由后台 AI 品牌配置驱动，`/admin/ai/config` 保存后下一次 `/api/ai/home` 会返回最新品牌名。
- Layout 内部通过 `useModel('ai')` 读取 `runtimeConfig`，在缺少配额时自动调用 `loadHomeConfig()`，保证 `/ai/chat`、`/ai/assets` 等没有显式传参的页面也能展示统一品牌名和 Token 余额。
- Layout 同时读取 `runtimeConfig.tools`，为 Chat、文本、图片、视频、WebUI、ComfyUI、LoRA、AI 应用入口展示后台派生的启停状态；`comingSoon` 和 `disabled` 工具在侧边栏中显示状态标签并阻止跳转。
- 页面级 `brandName`、`quotaText` props 仍保留更高优先级，用于首页、会员中心等需要局部覆盖展示文案的场景。

Ant Design X 本地封装：

- `apps/react-web/src/components/ai-x/`
- 当前封装入口已覆盖阶段 5 PRD 中列出的主要 Ant Design X 能力：
  - 基础组件：`AiXProvider`、`AiXBubble`、`AiXSender`、`AiXSenderSwitch`、`AiXConversations`、`AiXPrompts`、`AiXMarkdown`。
  - 消息与引用：`AiXActions`、`AiXAttachments`、`AiXSources`、`AiXSuggestion`。
  - 内容渲染：`AiXCodeHighlighter`、`AiXMermaid`、`AiXThink`、`AiXThoughtChain`、`AiXWelcome`。
  - 资产与文件：`AiXFileCard`、`AiXFolder`。
  - SDK hooks：`useAiXChat`、`useAiXConversations`、`useAiXRequest`、`useAiXStream`。
- 只有该目录直接 import `@ant-design/x`、`@ant-design/x-markdown` 和 `@ant-design/x-sdk`；页面层与业务组件统一从本地封装入口使用。
- `apps/react-web/src/pages/Welcome.tsx` 已改为使用 `AiXMarkdown`，消除页面层直接依赖 Ant Design X Markdown 的例外。

AI 业务组件：

- `apps/react-web/src/components/ai/AiAttachmentPicker`
- `apps/react-web/src/components/ai/AiGuestLimitAlert`
- `apps/react-web/src/components/ai/AiPageHeader`
- `apps/react-web/src/components/ai/AiTemplateCard`
- `apps/react-web/src/components/ai/AiGenerationStream`
- `apps/react-web/src/components/ai/AiQuotaAlert`

AI 占位工具页：

- `apps/react-web/src/pages/ai/PlaceholderTool/index.tsx`
  - 根据当前路由展示不同 mock 内容，覆盖个人中心、创作中心、邀请有礼、发布、教程、API、WebUI、ComfyUI、LoRA 训练和 AI 应用。
  - 每个占位页都包含能力状态、当前可预期能力、后续后端依赖、相关跳转入口和“订阅上线提醒”mock 按钮。
  - 该页仍只使用 AI Layout 和 `.ph-ai-*` 样式，不影响公开前台、工作区或后台布局。

AI 首页：

- `apps/react-web/src/pages/ai/Home/index.tsx`
  - 展示剩余额度、可用工具、最近创作统计。
  - 顶部新增搜索框，可按工具名、能力描述、模型、状态、模板标题、模板标签和 Prompt 搜索工具与推荐模板。
  - 工具卡片继续从 `/api/ai/home` 的后台派生工具配置读取状态、默认模型和计费文案。
  - 新增“最近创作”区块，统一展示最近 Chat 会话和文本/图片/视频生成任务。
  - Chat 最近项跳转 `/ai/chat?sessionId=xxx` 继续对话；生成任务优先跳转 `/ai/assets` 查看保存结果，没有资产时回到对应工具页。
  - 推荐模板卡片通过 `templateId` 跳转到对应工具页；文本、图片、视频页读取首页模板配置并预填 Prompt、模型和参数。
- `apps/react-web/src/components/ai/AiReferencePicker`
- `apps/react-web/src/components/ai/hooks/useAiAvailableModels`
- `apps/react-web/src/components/ai/hooks/useAiChatMock`
- `apps/react-web/src/components/ai/hooks/useAiGenerationMock`

mock 状态流：

- `useAiChatMock`：模拟“发送 → 助手消息分段追加 → 停止 / 重新生成”。
- `useAiChatMock`：自然完成后通过 `persistAiChatMessages` 保存本轮消息，停止生成不落正式历史也不扣 Token；重新生成会替换最后一条助手回复，保持刷新和工作区历史一致。
- `useAiChatMock`：接收当前会话的模型、System Prompt、上下文窗口和知识引用开关，并在完成时随消息一起保存会话设置，便于阶段 5 验证后续真实请求参数边界。
- `useAiChatSessionsMock`：管理 Chat 会话状态，提供新建、切换、重命名、删除，以及按会话保存 mock 消息快照；新建、重命名和删除已通过 `services/ai.ts` 写入 mock store。
- `apps/react-web/src/pages/ai/Chat/index.tsx`
  - Assistant 消息下方展示轻量动作条：复制、重新生成、点踩反馈。
  - 复制使用浏览器 Clipboard API，失败时给出手动复制提示；点踩反馈通过 `updateAiMessageFeedback` 写入 mock store，刷新当前 dev server 会话后仍可回填。
  - 支持读取 `/ai/chat?sessionId=xxx`，从工作区 AI 历史进入时加载指定会话消息。
  - Chat mock 回复自然完成后通过 `useModel('ai').consumeQuota()` 扣减 Token，并同步 AI Layout 顶部余额。
  - 会话高级设置从当前 `AiConversation` 派生，修改模型、System Prompt、上下文窗口和知识引用开关后通过 `updateAiSession` 写回 mock store。
  - 会话侧栏支持按标题、模型、消息数或 Token 搜索；无匹配结果时展示空状态，不改变当前会话。
- `useAiAvailableModels`：读取 `/api/ai/models`，按工具类型过滤当前用户可见模型，并在当前选中模型不可用时自动回落到默认模型。
- `useAiTextGenerationMock`：管理文本生成草稿、场景参数、Token 预估、mock 流式输出、停止和重新生成；生成内容先走 `generateAiText` service，再由前端拆分为流式片段播放。
- `useAiGenerationMock`：统一图片和视频的“再次编辑、重新生成、引用为附件、模拟失败和 mock 资产生成”。
- `useAiGenerationMock`：图片/视频重新生成成功后通过 `generateAiImage` / `generateAiVideo` 写入 mock 资产库；页面即时预览使用服务端返回资产，避免 `/ai/assets` 与当前输出卡片 id 不一致。
- `apps/react-web/src/components/ai/AiGenerationStream/index.tsx`
  - 展示用户输入和 AI 输出内容流。
  - AI 输出支持成功网格、失败 Alert、图片/视频角标、引用为附件、下载链接、查看详情、再次编辑和重新生成。
- `apps/react-web/src/components/ai/AiChatAdvancedSettings/index.tsx`
  - 封装 Chat 高级设置面板，统一承载模型选择、System Prompt、上下文窗口和知识内容引用开关。
  - 面板默认折叠，避免挤压 ChatGPT / DeepSeek 形态的底部输入区；展开后在移动端单列展示。
- `apps/react-web/src/components/ai/AiAttachmentPicker/index.tsx`
  - 提供 Chat 输入区“上传附件”的阶段 5 mock 交互，内置图片、文档、视频样例附件。
  - 当前不读取真实本地文件，避免引入真实上传权限和文件存储；后续接后端上传时可替换为 `AiXAttachments` 或上传 service。
- `apps/react-web/src/components/ai/AiGuestLimitAlert/index.tsx`
  - 统一展示 AI 工具的访客试用状态和超限恢复路径。
  - 阶段 5 不改全局登录策略，文本、图片、视频页通过 `guestMode=1&guestLimit=exceeded` 查询参数模拟访客超限并禁用生成按钮；后续接真实后端时改为读取用量接口返回的限制状态。
- `apps/react-web/src/components/ai/AiReferencePicker/index.tsx`
  - 复用 `fetchContentList` 拉取内容中心 mock 列表，提供 Chat 输入区“引用内容”抽屉。
  - 组件只输出轻量 `AiReferenceItem`，页面负责 chip 展示和发送时注入上下文，避免业务状态藏在选择器内部。
- `apps/react-web/src/components/ai/AiQuotaAlert/index.tsx`
  - 统一展示 Token 余额不足或余额偏低提示。
  - 阶段 5 仅做前端 mock 预检，文本、图片、视频页按单次预计消耗禁用生成入口；真实扣费和并发校验后续仍以后端为准。
- `apps/react-web/src/models/ai.ts`
  - 新增 `consumeQuota`，封装 `/api/ai/quota/consume` 并同步 `runtimeConfig.quota`，避免各页面自行维护顶部 Token 余额。
- `apps/react-web/src/pages/ai/Image/index.tsx`
  - 输入区支持模型、尺寸、数量、风格、Seed、风格词追加和模拟失败。
  - 模型下拉读取后台派生的图片模型，不再硬编码页面内选项。
  - 支持 `/ai/image?templateId=xxx` 从首页模板预填 Prompt、模型、尺寸、风格和数量，并展示已应用模板提示。
  - 详情 Drawer 展示图片预览、Prompt、模型、尺寸、风格和预计 Token。
  - 按 `500 Token / 张` 结合当前剩余额度展示不足提示并禁用生成按钮。
  - 生成并保存资产成功后扣减预计 Token，顶部余额随 `runtimeConfig.quota` 更新。
  - 未登录时展示访客试用提示，`guestLimit=exceeded` 时禁用生成按钮并引导登录。
- `apps/react-web/src/pages/ai/Video/index.tsx`
  - 输入区支持模型、比例、时长、镜头风格、Seed、风格词追加和模拟失败。
  - 模型下拉读取后台派生的视频模型，不再硬编码页面内选项。
  - 支持 `/ai/video?templateId=xxx` 从首页模板预填 Prompt、模型、比例、时长和镜头风格，并展示已应用模板提示。
  - 详情 Drawer 展示视频封面、Prompt、模型、比例、时长和预计 Token。
  - 按 `1500 Token / 条` 结合当前剩余额度展示不足提示并禁用生成按钮。
  - 生成并保存资产成功后扣减预计 Token，顶部余额随 `runtimeConfig.quota` 更新。
  - 未登录时展示访客试用提示，`guestLimit=exceeded` 时禁用生成按钮并引导登录。
- `apps/react-web/src/pages/ai/Text/index.tsx`
  - 模型下拉读取后台派生的文本模型，不再硬编码页面内选项；没有可用模型时禁用生成入口。
  - 支持 `/ai/text?templateId=xxx` 从首页模板预填场景、输入内容、模型、语气、长度和目标语言。
  - 按当前输入长度和输出长度估算 Token，余额不足时展示统一提示并禁用生成按钮。
  - mock 流式输出自然完成后扣减预计 Token；停止生成不会扣减。
  - 未登录时展示访客试用提示，`guestLimit=exceeded` 时禁用生成按钮并引导登录。
- `apps/react-web/src/pages/ai/Home/index.tsx`
  - 工具卡片读取 `/api/ai/home` 中的派生工具状态，展示可用工具数量、默认模型、计费文案、游客试用和需登录标签。
  - 可用工具展示“使用工具”按钮；`comingSoon` / `disabled` 工具展示不可点击按钮，避免用户误入未开放能力。

后台 AI 管理：

- `apps/react-web/src/pages/admin/AiConfig/index.tsx`
  - 展示厂商状态、用户可见模型、已启用工具三个摘要。
  - 分段查看厂商管理、模型管理、工具配置。
  - 厂商管理支持打开 Drawer 编辑展示名、Base URL、启用状态和新 API Key；新 API Key 留空表示不修改，保存后只展示脱敏值。
  - 模型管理支持新增模型，新增时填写模型 ID、厂商、支持工具、启用/可见/默认、上下文和输入/输出价格。
  - 模型管理支持打开 Drawer 编辑展示名、启用状态、用户可见、默认模型、上下文和输入/输出价格；编辑时模型 ID、厂商和支持工具保持只读。
  - 模型管理支持删除模型，mock 层会清理工具默认模型引用并尝试回落。
  - 工具配置表格支持修改工具状态（已启用 / 即将上线 / 已禁用），也支持上移/下移展示顺序，或打开 Drawer 编辑状态、默认模型、计费说明、访客试用和展示顺序。
  - 品牌设置分段支持编辑 AI 品牌名和 Logo 文案，保存后用户端 AI 首页和 AI Layout 会读取最新品牌名。
  - 工具配置保存后刷新后台配置，并通过同一份 mock 配置影响用户端 AI 首页、侧边栏和工具接口。
  - 阶段 5 仍不做模型厂商迁移、模型 ID 迁移、真实 Key 明文持久化和工具级权限，后续接真实后端时再扩展完整表单。
- `apps/react-web/src/pages/admin/AiStats/index.tsx`
  - 展示消耗 Token、调用次数、预估费用、活跃用户。
  - 展示近 7 天趋势、工具消耗占比、用户消耗排行和模型消耗分布。

工作区 AI 历史：

- `apps/react-web/src/pages/workspace/AiHistory/index.tsx`
  - 列表展示 AI 会话标题、模型、消息数、Token 和最后更新时间。
  - 支持关键字搜索、继续对话、重命名、删除和批量删除。
  - 继续对话跳转 `/ai/chat?sessionId=xxx`，进入 AI 专属工作台加载对应上下文。
  - 工作区页只做历史管理入口，不复制 AI Chat 主工作区。

内容引用：

- `apps/react-web/src/pages/public/ContentDetail/index.tsx`
  - 在详情操作区新增“引用到 AI”按钮。
  - 点击跳转 `/ai/chat?contentId=xxx&mode=quote`，不改变原有阅读、收藏和复制链接逻辑。
- `apps/react-web/src/pages/ai/Chat/index.tsx`
  - 读取 `contentId` 和 `mode=quote`。
  - 拉取内容详情后展示引用 chip，并预填“基于当前内容总结和给建议”的输入草稿。
  - 引用 chip 保留返回原内容详情页的链接。
  - 输入区“引用内容”按钮打开内容选择抽屉，选择后在 Sender 上方展示可关闭 chip；发送时把引用标题作为 mock 上下文前缀注入用户消息。
  - 输入区“上传附件”按钮打开 mock 附件抽屉，选择后在 Sender 上方展示可关闭 chip；发送时把附件名和类型作为 mock 上下文前缀注入用户消息。

AI 资产：

- `apps/react-web/src/pages/ai/Assets/index.tsx`
  - 新增资产详情 Drawer，展示预览、类型、来源、状态、模型、文件夹、Prompt 和更新时间。
  - 卡片新增详情、移入回收站、恢复入口。
  - 列表新增选择当前分类、清空选择、批量移入回收站、批量移动到文件夹、批量恢复、批量永久删除。
  - 回收站资产可恢复或永久删除；普通资产先移入回收站。
  - 普通资产可通过卡片、详情 Drawer 或批量操作移动到已有项目文件夹；选择“取消归档”会清空 `folderId` / `folderName`。
  - 项目文件夹支持新建、重命名和删除空文件夹；非空文件夹删除入口禁用，避免资产归档关系丢失。
- `apps/react-web/mock/data/ai-store.ts`
  - 新增 `moveAiAssetToTrash`、`restoreAiAsset`、`deleteAiAssetPermanently` 及批量操作函数。
  - 新增 `moveAiAssetToFolder`、`batchMoveAiAssetsToFolder`，阶段 5 使用内存态模拟文件夹归档。
  - 新增独立 `aiAssetFolders` 内存态，空文件夹不再依赖资产反推；重命名文件夹时同步更新已归档资产的 `folderName`。
  - 新增 `AI 生成结果` 默认文件夹，图片/视频 mock 生成结果默认归档到该分类。
  - 新增 `aiUsageLogs`、`consumeAiQuota`、`getWorkspaceUsageFromAiQuota`，阶段 5 先用内存态模拟 AI Token 消耗、余额和工作区用量联动。

样式：

- `apps/react-web/src/styles/ai-tokens.less`
- `apps/react-web/src/styles/ai-layout.less`
- `apps/react-web/src/styles/ai-components.less`
- `apps/react-web/src/styles/ai-motion.less`

## 5. 权限与异常

当前 `/ai/*` 暂不强制登录，符合阶段 5 mock 目标：

- 图片/视频按钮位已保留登录和配额扩展空间。
- Token 额度目前从 mock 首页聚合接口展示。
- 后续接入真实权限时优先沿用 `ai:use` 和更细粒度权限点。

异常处理：

- AI 首页加载失败使用 `ResultState` 提供重试。
- Chat 空会话使用 `ResultState`。
- 图片/视频失败态已在 mock 创作流中可见，失败后保留再次编辑和重新生成恢复路径。

## 6. 验证方式

已通过：

- `PATH=/Users/wangchaocheng/.nvm/versions/node/v22.22.0/bin:$PATH corepack pnpm --filter react-web tsc`
- `PATH=/Users/wangchaocheng/.nvm/versions/node/v22.22.0/bin:$PATH corepack pnpm --filter react-web biome:lint`
- `rg "from ['\\\"]@ant-design/x|@ant-design/x-markdown|@ant-design/x-sdk" apps/react-web/src -n`：确认第三方 X 依赖只出现在 `src/components/ai-x` 封装层。
- `GET /api/admin/ai/config`：返回 3 个厂商、5 个模型、8 个工具配置。
- `GET /api/ai/models`：从后台 AI 配置派生返回 5 个用户可见且启用的模型；禁用或不可见模型不会返回到用户端。
- `GET /api/admin/ai/stats`：返回汇总、7 条趋势、4 个工具占比和 4 个模型分布。
- `GET /api/workspace/ai/history`：返回 AI 会话分页列表，支持 `keyword` 搜索。
- `PUT /api/workspace/ai/history/:id`：可重命名 mock 会话，并同步 `aiConversations`。
- `PATCH /api/ai/assets/:id/trash`、`PATCH /api/ai/assets/:id/restore`、`DELETE /api/ai/assets/:id`：支持资产移入回收站、恢复和永久删除。
- `POST /api/ai/assets/batch-trash`、`POST /api/ai/assets/batch-restore`、`POST /api/ai/assets/batch-delete`：支持资产批量操作。
- `POST /api/ai/quota/consume`：可按工具类型扣减 mock Token，并返回最新 `AiQuotaSummary`。
- `POST /api/ai/sessions`、`PUT /api/ai/sessions/:id`、`DELETE /api/ai/sessions/:id`：支持 AI Chat 会话新建、重命名、会话级设置更新和删除。
- `POST /api/ai/sessions/:id/messages`：支持保存自然完成的 Chat 消息，并同步更新会话标题、消息数、Token 总量和最后消息时间。
- `PUT /api/ai/messages/:id/feedback`：支持 assistant 消息点踩和取消点踩；用户消息不接受反馈。
- `GET /api/workspace/usage`：返回与 `/api/ai/quota` 同源的总额度、已用、剩余和最近用量。
- `GET /api/ai/home`：返回 `recentActivities`，最近创作由 `aiConversations` 和 `aiRecentTasks` 合并排序后取前 5 条。

浏览器抽样验收：

- `/ai`：渲染 AI Layout、`Personal Hub AI`、AI 工作台和推荐模板。
- `/ai`：渲染“最近创作”区块，展示最近会话、图片/视频任务和继续入口。
- `/ai/chat`：渲染 AI Layout、会话列表、mock 消息和底部输入区。
- `/ai/chat`：会话侧栏支持搜索会话，匹配结果保留操作菜单，无结果时展示空状态。
- `/ai/chat`：新建对话后可发送消息，用户消息和 mock 助手流式回复可见。
- `/ai/chat`：新建会话可重命名，删除后回到已有会话，控制台无 error / warning。
- `/ai/text`：6 个文本场景可见；输入内容后可生成 mock Markdown 输出，输出区流式展示，控制台无 error / warning。
- `/ai/text`：生成过程中可停止，输出区保留已生成内容并展示“已停止生成”标记。
- `/ai/image`：渲染图片生成对话流和“再次编辑 / 重新生成”动作。
- `/ai/video`：渲染视频生成对话流和“再次编辑 / 重新生成”动作。
- `/ai/assets`：渲染 AI 资产 mock 列表。
- `/ai/assets`：可按全部、生成结果、上传素材、收藏、最近使用、已分享、回收站和项目文件夹筛选；上传素材、品牌素材文件夹、回收站筛选浏览器验收通过。
- `/content`：仍为公开布局，未进入 AI Layout。
- 2026-07-06 追加回归：`/ai`、`/ai/chat`、`/ai/image` 均存在 `.ph-ai-layout`、`.ph-ai-sidebar`、`.ph-ai-topbar`；`/content` 不存在 AI Layout，仍显示公开前台导航；浏览器控制台无 error。
- 2026-07-06 追加后台 AI 回归：`/admin/ai/config`、`/admin/ai/stats` 均渲染 `.ant-pro-layout` 且不存在 `.ph-ai-layout`；`/content` 仍渲染 `.ph-public-layout` 且不存在 `.ph-ai-layout`；浏览器控制台无应用 error。
- 2026-07-06 追加工作区 AI 历史回归：`/workspace/ai/history` 渲染 `.ant-pro-layout` 且不存在 `.ph-ai-layout`；列表展示 mock 会话并提供 `/ai/chat?sessionId=xxx` 链接；访问该链接后进入 `.ph-ai-layout`；`/content` 仍保持 `.ph-public-layout`；浏览器控制台无应用 error。
- 2026-07-06 追加内容引用回归：`/content/c-md-01` 显示“引用到 AI”按钮且仍渲染 `.ph-public-layout`；`/ai/chat?contentId=c-md-01&mode=quote` 渲染 `.ph-ai-layout` 和 `.ph-ai-reference-chip`，展示内容标题、类型和返回内容详情链接，输入区自动预填引用提示词；浏览器控制台无应用 error。
- 2026-07-06 追加资产操作回归：`/ai/assets` 渲染 `.ph-ai-layout`、`.ph-ai-assets-grid` 和 `.ph-ai-asset-checkbox`；可见详情、移入回收站、批量恢复、永久删除等动作位；资产 mock API 的移入回收站、恢复、批量移入回收站验证通过；浏览器控制台无应用 error/warning。
- 2026-07-06 追加 AI 移动端抽屉回归：390px 下 `/ai` 隐藏 `.ph-ai-sidebar`，展示 `.ph-ai-mobile-menu-button`；点击打开 AI 导航抽屉，抽屉内包含 `Personal Hub AI`、AI 对话等入口；点击 `/ai/chat` 后抽屉自动关闭并进入 `.ph-ai-layout`，浏览器控制台无应用 error/warning。
- 2026-07-06 追加 AI 响应式回归：768px 下 `/ai/image` 保持桌面侧栏，页面无横向溢出；1440px 下 `/ai` 侧栏宽 248px，折叠后为 72px，移动菜单按钮隐藏；`/content` 仍渲染 `.ph-public-layout`，不存在 AI Layout、AI Sidebar 或移动抽屉 DOM。
- 2026-07-06 追加图片/视频创作流回归：`/ai/image` 可见参数面板、数量控件、模拟失败开关和详情按钮；点击生成后展示 mock 输出、下载链接和详情 Drawer，详情包含 Prompt、模型、尺寸和 `500 Token / 张`；模拟失败后展示错误 Alert，保留再次编辑和重新生成，控制台无应用 error/warning。
- 2026-07-06 追加视频创作流回归：`/ai/video` 可见模型、比例、时长、镜头风格、Seed、模拟失败等控件；点击生成后展示 mock 视频输出、视频角标、下载链接和详情 Drawer，详情包含比例、时长和 `1500 Token / 条`；浏览器控制台无应用 error/warning。
- 2026-07-06 追加模型配置联动回归：`/api/admin/ai/config` 中模型配置与 `/api/ai/models` 用户端模型接口保持一致，后者只返回 `enabled && visibleToUser` 模型；`/ai/text` 展示 Qwen 文本模型且不展示图片/禁用模型，`/ai/image` 展示 `DALL·E 3` 且不展示旧硬编码 `Qwen-Image`，`/ai/video` 展示 `Video Mock v1` 且不展示旧硬编码 `Seedance Lite`；`/content` 仍保持公开布局，控制台无应用 error/warning。
- 2026-07-06 追加 AI Layout 运行时配置回归：`/ai/chat`、`/ai/assets`、`/ai`、`/ai/membership` 均渲染 `.ph-ai-layout`，展示 `Personal Hub AI` 和 `7,640 Token`，且不再停留在“加载中”；`/content` 仍渲染 `.ph-public-layout`，不存在 `.ph-ai-layout`；浏览器控制台无应用 error/warning。
- 2026-07-06 追加工具启停配置联动回归：`/api/ai/tools` 和 `/api/ai/home` 均返回后台派生后的工具状态，Chat、文本、图片、视频为 `enabled`，WebUI、ComfyUI、LoRA、AI 应用为 `comingSoon`；`/ai` 首页展示“可用工具 4”、4 个“使用工具”按钮、4 个“即将上线”按钮和视频 `1500 Token / 条` 计费文案；AI 侧栏对即将上线工具展示状态标签并阻止跳转；`/content` 仍保持 `.ph-public-layout` 且无 AI Layout；控制台无应用 error/warning。
- 2026-07-06 追加后台工具状态保存回归：`PUT /api/admin/ai/tools/apps/status` 可将 `AI 应用` 从 `comingSoon` 改为 `disabled`，随后 `/api/admin/ai/config` 和 `/api/ai/tools` 均返回 `disabled`；`/admin/ai/config` 工具配置分段渲染 8 个状态选择控件，后台页保持 `.ant-pro-layout` 且不存在 `.ph-ai-layout`；`/ai` 首页和侧栏同步展示 `AI 应用暂不可用`；`/content` 仍保持 `.ph-public-layout`；测试后已恢复 `AI 应用` 为 `comingSoon`，控制台无应用 error/warning。
- 2026-07-06 追加 AI 资产移动文件夹回归：`PATCH /api/ai/assets/asset-reference-upload-1/folder` 可将资产移动到 `React 内容计划`，`POST /api/ai/assets/batch-folder` 可批量取消归档；测试后已恢复该资产到 `品牌素材`；`/ai/assets` 渲染 `.ph-ai-layout`、`.ph-ai-assets-grid`、批量“移动到文件夹”入口、卡片移动入口和 React/品牌素材文件夹筛选；`/content` 仍保持 `.ph-public-layout` 且无 AI Layout；控制台无应用 error/warning。
- 2026-07-06 追加 Chat 高级设置回归：`/ai/chat` 渲染 `.ph-ai-layout`、会话列表和底部输入区；高级设置默认折叠，展开后可见模型选择、System Prompt、上下文窗口和知识内容引用开关；发送消息后 mock 助手回复展示当前模型和 System Prompt 摘要；`/content` 仍保持 `.ph-public-layout` 且无 AI Layout；`tsc` 与 `biome:lint` 均通过。
- 2026-07-06 追加 Chat 消息操作回归：`/ai/chat` 的 assistant 消息展示复制、重新生成和点踩反馈按钮；点踩可通过 `PUT /api/ai/messages/:id/feedback` 写入 mock store 并再次取消，复制按钮具备 Clipboard API 降级提示；`/content` 仍保持 `.ph-public-layout` 且无 AI Layout；`tsc` 与 `biome:lint` 均通过。
- 2026-07-06 追加 Chat 反馈持久化回归：`PUT /api/ai/messages/:id/feedback` 可为 assistant 消息写入 `feedback=dislike` 和 `feedbackAt`，再次提交空 feedback 可取消；`/ai/chat?sessionId=xxx` 按消息字段渲染点踩状态；`/workspace/ai/history` 保持 ProLayout，`/content` 保持 PublicLayout；`tsc` 与 `biome:lint` 均通过。
- 2026-07-06 追加文本保存到资产回归：`/ai/text` 渲染 `.ph-ai-layout`，生成 mock 输出后“保存到资产”解除禁用；点击保存后 `/ai/assets` 可见新增 `type=text`、`source=generated`、`status=saved` 的文本资产，并归档到“写作素材”；资产详情 Drawer 展示 Prompt 和文本内容；`/content` 仍保持 `.ph-public-layout` 且无 AI Layout；`tsc` 与 `biome:lint` 均通过。
- 2026-07-06 追加图片/视频保存到资产回归：`/ai/image` 与 `/ai/video` 点击生成后通过 `POST /api/ai/assets` 写入 mock 资产库，页面输出卡片使用返回资产；`/ai/assets` 可见新增图片/视频资产并归档到“AI 生成结果”；`/content` 仍保持 `.ph-public-layout` 且无 AI Layout；`tsc` 与 `biome:lint` 均通过。
- 2026-07-06 追加 Token 用量联动回归：文本生成自然完成后扣减 mock Token，图片/视频生成并保存资产成功后扣减对应预计 Token；AI Layout 顶部余额随 `runtimeConfig.quota` 更新；`/api/workspace/usage` 与 `/api/ai/quota` 返回同源额度，`/workspace/usage` 展示同步后的已用/剩余额度；`/content` 仍保持 `.ph-public-layout` 且无 AI Layout；`tsc` 与 `biome:lint` 均通过。
- 2026-07-06 追加 Chat 持久化与用量联动回归：`/ai/chat?sessionId=xxx` 可加载指定会话；发送消息自然完成后通过 `POST /api/ai/sessions/:id/messages` 保存 user/assistant 消息，刷新 mock 接口后工作区 AI 历史可看到更新后的标题、消息数、Token 和最后时间；Chat 完成态通过 `POST /api/ai/quota/consume` 扣减 Token，停止生成不扣费；`tsc` 与 `biome:lint` 均通过。
- 2026-07-06 追加 Chat 会话设置持久化回归：`PUT /api/ai/sessions/:id` 可保存 `modelId`、`systemPrompt`、`contextLimit` 和 `enableKnowledgeReference`；`/ai/chat?sessionId=xxx` 进入后高级设置从会话字段回填；发送消息时 mock 回复展示保存后的 System Prompt 摘要；`/workspace/ai/history` 保持工作区 ProLayout，`/content` 保持公开前台布局；`tsc` 与 `biome:lint` 均通过。
- 2026-07-06 追加 AI 资产文件夹管理回归：`GET /api/ai/asset-folders` 返回独立文件夹列表和资产数；`POST /api/ai/asset-folders` 可新建空文件夹，`PUT /api/ai/asset-folders/:id` 可重命名并同步资产展示名，`DELETE /api/ai/asset-folders/:id` 仅允许删除空文件夹；`/ai/assets` 可见新建、重命名和空文件夹删除入口；`/content` 仍保持 `.ph-public-layout` 且无 AI Layout；`tsc` 与 `biome:lint` 均通过。
- 2026-07-06 追加后台 AI 模型配置回归：`PUT /api/admin/ai/models/:id` 可保存模型展示名、启用、用户可见、默认、上下文和价格；禁用或隐藏模型后 `/api/ai/models` 不再返回该模型；`/admin/ai/config` 模型管理分段可打开编辑 Drawer，后台页保持 `.ant-pro-layout` 且不存在 `.ph-ai-layout`；`/content` 仍保持 `.ph-public-layout`；`tsc` 与 `biome:lint` 均通过。
- 2026-07-06 追加后台 AI 工具完整配置回归：`PUT /api/admin/ai/tools/:code` 可保存工具状态、默认模型、计费说明和访客试用开关；保存后 `/api/ai/tools`、`/api/ai/home` 同步返回新的工具配置；`/admin/ai/config` 工具配置分段可打开编辑 Drawer，后台页保持 `.ant-pro-layout` 且不存在 `.ph-ai-layout`；`/ai` 首页展示更新后的计费与访客试用信息；`/content` 仍保持 `.ph-public-layout`；`tsc` 与 `biome:lint` 均通过。
- 2026-07-06 追加 AI 首页最近创作回归：`/api/ai/home` 返回 `recentActivities`，包含最近 Chat 会话和生成任务；`/ai` 首页展示“最近创作”统计与列表，最近会话可跳转 `/ai/chat?sessionId=xxx`，生成任务可进入资产或对应工具页；`/workspace/ai/history` 保持 ProLayout，`/content` 保持 PublicLayout；`tsc` 与 `biome:lint` 均通过。
- 2026-07-06 追加 Chat 会话搜索回归：`/ai/chat` 侧栏新增搜索框，可按标题或模型过滤会话；搜索命中时保留 `AiXConversations` 列表和操作菜单，搜索无结果时展示空状态；清空搜索后恢复全部会话；`/workspace/ai/history` 保持 ProLayout，`/content` 保持 PublicLayout；`tsc` 与 `biome:lint` 均通过。
- 2026-07-06 追加首页模板预填回归：`AiTemplate` 补充文本场景和生成参数字段；`/ai/text?templateId=tpl-weekly-report` 可预填场景、输入、模型和语气；`/ai/image?templateId=tpl-cover-qwen` 可预填 Prompt、`DALL·E 3`、尺寸、风格和数量；`/ai/video?templateId=tpl-video-intro` 可预填 Prompt、`Video Mock v1`、比例、时长和镜头风格；`tsc` 与 `biome:lint` 均通过。
- 2026-07-06 追加 AI 占位入口回归：AI 侧栏补齐创作中心和发布入口；`/ai/profile`、`/ai/creation-center`、`/ai/publish`、`/ai/tutorials`、`/ai/api` 等占位页按路由展示独立说明、状态、后端依赖和订阅上线提醒 mock；`/workspace/ai/history` 保持 ProLayout，`/content` 保持 PublicLayout；`tsc` 与 `biome:lint` 均通过。
- 2026-07-06 追加 AI 首页搜索回归：`/ai` 新增搜索框，可过滤工具卡片和推荐模板；搜索 `视频` 命中视频工具和产品介绍短片模板，搜索无结果时展示空状态并支持清除搜索；`/workspace/ai/history` 保持 ProLayout，`/content` 保持 PublicLayout；`tsc` 与 `biome:lint` 均通过。
- 2026-07-06 追加 AI 资产检索回归：`/ai/assets` 在左侧来源/文件夹分类基础上新增关键字、类型、来源、状态、模型和排序筛选；批量选择范围改为当前筛选结果；搜索无结果时展示筛选空状态并支持重置；`/workspace/ai/history` 保持 ProLayout，`/content` 保持 PublicLayout；`tsc` 与 `biome:lint` 均通过。
- 2026-07-06 追加会员中心用量回归：`/api/ai/membership` 返回 `usageOverview`，包含余额状态、近 30 天 Token 趋势、工具用量明细和访客试用状态；`/ai/membership` 展示用量概览、趋势柱、Chat/Text/Image 明细和套餐/邀请 mock；`/workspace/ai/history` 保持 ProLayout，`/content` 保持 PublicLayout；`tsc` 与 `biome:lint` 均通过。

## 7. 已知限制与后续扩展

- Chat 目前仍是前端本地 mock 流式输出，尚未接真实 SSE；完成后会通过 mock service 保存消息。
- Chat 会话 CRUD 和完成消息已写入 dev server 内存态 mock store，刷新页面可在当前 dev server 生命周期内保留；重启 dev server 后仍回到 mock 初始数据，后续需要接真实后端持久化。
- Chat 模型、System Prompt、上下文窗口和知识引用开关已写入 dev server 内存态 mock store；后续接真实后端时需要映射到会话详情接口和发送消息请求体。
- 文本生成已具备 `POST /api/ai/text/generate` mock 契约，页面仍在前端拆分完整文本形成流式观感；复制按钮依赖浏览器 Clipboard API，Token 扣减仍由前端完成态后调用 mock 接口，后续接真实后端时需要补真实 SSE/非 SSE 返回适配和服务端原子扣费。
- 图片/视频已具备 `POST /api/ai/image/generate`、`POST /api/ai/video/generate` mock 契约；引用为附件、再次编辑、重新生成、失败态、详情预览和 mock 资产入库已具备本地状态流；下载当前使用 mock 链接，真实文件下载和服务端持久化后续接后端补。
- 会员中心只做 mock，不接支付和真实权益开通；当前已展示套餐、邀请记录、余额状态、近 30 天趋势、工具用量明细和访客试用状态。
- AI 资产已具备首版推荐分类、项目文件夹筛选、关键字/类型/来源/状态/模型筛选、排序、新建/重命名/删除空文件夹、移动到文件夹、详情、恢复、永久删除和批量操作；后续仍需补真实预览详情、文件夹排序、服务端持久化和权限校验。
- 后台 AI 配置和统计当前仍是阶段 5 mock 页面；用户端模型下拉已从后台 mock 配置派生，厂商基础配置、模型新增/删除、模型基础配置、工具状态、工具默认模型、计费说明、访客试用和工具排序已支持 mock 保存，但模型厂商迁移、模型 ID 迁移、真实 Key 明文持久化、工具级权限和统计时间范围真实筛选后续接后端时补。
- 工作区 AI 历史当前直接复用 `aiConversations` 内存态；刷新 dev server 后会恢复 mock 初始数据，真实持久化后续接后端会话 API。
- 内容引用到 AI 当前只做 URL 参数和引用 chip；后续可扩展为 Chat 内内容选择器、引用片段选择和多引用来源。
