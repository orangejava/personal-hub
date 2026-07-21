# AI 三页统一布局与输入框 PRD

> 状态：已实施 LibLib 风格细化
> 最后更新：2026-07-08
> 对应范围：`/ai/chat`、`/ai/image`、`/ai/video`

## 1. 目标

本次改造在阶段 5 AI 工作台 mock 闭环基础上，补齐三类创作页的统一体验：

- AI 对话、图片生成、视频生成使用一致的“消息流 + 底部输入区”布局。
- 底部输入区抽象为可配置组件，支持不同工具按 props 组合按钮、模型、附件、引用内容和参数弹窗。
- 图片/视频参数从页面内表单迁移到输入区底部按钮触发的配置弹窗。
- Chat 消息气泡支持多类型流式内容，包括思考过程、思维链、Markdown 正文和来源。
- 空数据时展示统一样式的 Welcome，引导用户开始创作。

本轮仍基于 React-first mock，不接真实 SSE、真实语音识别或真实模型优化接口。

## 2. 统一布局

三页统一使用共享工作台内容壳层：

- 主内容宽度固定为 `1080px`，小屏下使用 `max-width: 100%` 兜底。
- 页面上半部为消息或生成结果列表，下半部为输入区。
- 输入区距离底部默认约 `20px`。
- 消息区与输入区间距默认约 `20px`。
- 消息区顶部保留统一留白，其余高度交给可滚动消息区。
- 进入 `/ai/chat`、`/ai/image`、`/ai/video` 时，AI 主侧边栏默认自动收起。
- Chat 页会话历史列表是页面内能力，仍允许用户展开和操作。

空态规则：

| 页面 | Welcome 标题 | Welcome 描述 |
|---|---|---|
| `/ai/chat` | 今天想聊点什么？ | 可以直接提问、引用知识内容，或切换模型开始一段新的 AI 对话。 |
| `/ai/image` | 开始你的第一张创作图像 | 输入提示词、选择模型和参数，也可以补充附件与尺寸配置，快速生成想要的画面。 |
| `/ai/video` | 描述一个想生成的视频画面 | 输入脚本或镜头想法，设置比例、时长与风格，先用 mock 创作流验证整体体验。 |

## 3. `AiComposer` 输入区契约

`AiComposer` 是 AI 创作页共享输入区组件，承担输入、按钮区、附件/引用展示和提交状态。

核心交互：

- `Enter` 发送。
- `Shift + Enter` 换行。
- 不传高度时使用默认高度。
- 支持 `minHeight`、`maxHeight`，内容超过最大高度后在输入区域内部滚动。
- 清空按钮只清空当前文本、附件、引用内容，不重置模型、尺寸、质量等参数。
- 模型选择使用点击下拉，只展示当前工具可用模型。
- 语音输入本轮只做 UI 占位。
- 优化提示词后直接覆盖原文，并显示撤销优化按钮，点击恢复优化前内容。
- 暂不处理移动端底部输入区样式，后续单独参考移动端应用体验设计。

推荐 props 结构：

```ts
interface AiComposerProps {
  value: string;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  submitDisabled?: boolean;
  minHeight?: number;
  maxHeight?: number;
  defaultHeight?: number;
  model?: {
    value?: string;
    options: { label: string; value: string; disabled?: boolean }[];
    loading?: boolean;
    placeholder?: string;
    onChange: (modelId: string) => void;
  };
  leadingActions?: React.ReactNode;
  extraActions?: React.ReactNode;
  attachments?: React.ReactNode;
  references?: React.ReactNode;
  footerExtra?: React.ReactNode;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onStop?: () => void;
  onClear?: () => void;
  onVoice?: () => void;
  onOptimize?: (value: string) => string | Promise<string>;
}
```

## 4. 配置弹窗契约

图片和视频配置弹窗由输入区底部按钮触发，弹窗内容完全由 props 驱动。

交互规则：

- 点击选项立即生效。
- 关闭弹窗后保留当前选择。
- 使用“分组数组 + 选项数组”的 schema。
- 支持单选按钮组、比例/尺寸宫格、图标 + 文案选项。
- 支持默认值、选中态、禁用态和回填。

推荐 schema：

```ts
interface AiConfigGroup {
  key: string;
  title: string;
  type: 'segmented' | 'grid';
  value?: string | number;
  columns?: number;
  options: {
    label: string;
    value: string | number;
    description?: string;
    icon?: React.ReactNode;
    disabled?: boolean;
  }[];
  onChange: (value: string | number) => void;
}
```

## 5. Chat 多类型流式内容

Chat mock 流应区分不同响应类型，为后续真实 SSE 做好前端契约：

| 类型 | 用途 |
|---|---|
| `reasoning` | 展示模型思考摘要或推理状态 |
| `thought_chain` | 展示多步骤思维链 / 任务链路 |
| `content` | 展示最终 Markdown 正文 |
| `source` | 展示引用来源 |
| `done` | 标记本轮输出完成 |

前端实现约束：

- `AiMessage.content` 继续保留完整正文，用于复制、持久化和历史兼容。
- 页面可额外维护 `parts` 结构，用于当前运行时按类型展示。
- `AiXBubble` 优先封装 Markdown、思考过程、思维链和来源展示，页面层只传入业务数据。
- AI 正文通过 `AiXMarkdown` 渲染。

## 6. 验收标准

- `/ai/chat`、`/ai/image`、`/ai/video` 三页布局统一，主内容最大宽度为 `1080px`。
- 三页空态使用统一 Welcome 样式且文案不同。
- 底部输入区支持动态按钮、模型下拉、清空、语音占位、优化提示词和撤销优化。
- Chat 清空会清掉文本、附件和引用内容，不重置高级设置。
- 图片/视频配置弹窗可打开、选择、关闭并保留状态。
- Chat 可展示思考过程、思维链、Markdown 正文和来源。
- 原有发送、停止、重新生成、引用内容、上传附件、详情查看和 mock 生成链路不回退。
- 页面可正常打开，控制台无本次改动相关新报错。

## 7. 二次布局优化补充

本轮继续优化三页的可视区布局和媒体消息列表体验。

### 7.1 固定视口布局

- `/ai/chat`、`/ai/image`、`/ai/video` 去掉页面内 `AiPageHeader` 标题卡片，保留 AI Layout 顶部工具条。
- 三页工作区高度刚好等于当前可视窗口可用高度。
- 底部输入框固定展示在底部区域。
- 消息列表占据输入框上方剩余高度，并且只有消息列表内部滚动。
- 页面外层不出现滚动条。
- 消息列表默认展示最新内容，向上滚动加载更早历史。

### 7.2 Chat 会话历史

- Chat 左侧会话历史面板固定高度。
- “新建对话”和搜索区域固定在面板顶部。
- 会话列表内部滚动。
- 默认每页展示 `20` 条，滚动到底部后加载更多 mock 会话。
- 优先复用 `AiXConversations`，外层补滚动与分页状态。

### 7.3 输入框按钮优化

- 图片/视频底部不再直接展示“科技感”“写实摄影”等风格快捷按钮。
- 配置按钮反显当前已选关键参数，并用竖线分隔。
- 图片示例：`16:9 | 1张 | 标准画质`。
- 视频示例：`16:9 | 6秒 | 产品运镜`。
- 保留模型下拉、配置按钮、优化提示词、语音占位、清空、发送/停止。

### 7.4 图片/视频消息列表

- 图片和视频消息列表参考 Liblib 的连续生成记录样式。
- UI 上按“用户 prompt + AI 输出”连续展示，但不在数据层新增“组”的概念。
- 用户 prompt、模型、参数、创建时间展示在同一块上方。
- AI 输出图片/视频默认直接展示内容，不用明显分离的用户卡片和 AI 卡片背景。
- hover 时展示图片/视频操作按钮。
- “重新编辑 / 再次生成”展示在本条 AI 输出底部。
- 默认展示最新 `10` 条 mock 消息，向上滚动加载更早记录。
- 每条消息展示创建时间，规则为：今天、昨天、一周前、超过一周显示具体日期、超过半年显示月份。

### 7.5 图片/视频筛选工具

- 图片/视频右侧展示固定筛选工具。
- 默认结构为：搜索图标、竖线、时间筛选按钮。
- 点击搜索图标后，搜索框向左展开。
- 输入内容后执行搜索；有内容时搜索框保持展开，并展示清空按钮。
- 时间筛选弹窗包含开始日期、结束日期、全部、最近一周、最近一个月、最近三个月。
- 选择预设后反显到时间筛选按钮。
- 搜索范围覆盖 `prompt`、标题、模型、参数、资产标题。
- 时间筛选按生成任务 `createdAt`，缺失时回落到资产 `createdAt`。

## 8. LibLib 风格细化补充

本轮继续按用户提供的 LibLib 截图优化 AI 工作台细节。

### 8.1 三页工作区尺寸

- `/ai/chat`、`/ai/image`、`/ai/video` 中间消息列表和底部输入框宽度统一从 `1080px` 调整为 `918px`。
- 输入框默认高度提高，保留最小高度、最大高度和内部滚动。
- 图片/视频生成记录的时间字体调大并加粗。
- 图片/视频生成记录的时间和底部操作按钮统一左对齐。

### 8.2 侧边栏导航

- AI 左侧导航参考 LibLib：去掉小字分组标题。
- “创作”作为父级入口，AI 对话、文本生成、图片生成、视频生成、WebUI、ComfyUI、训练 LoRA、AI 应用作为子项缩进展示。
- 创作子项点击后自动折叠侧边栏。
- “会员中心”和“会员超市”合并为一个“会员中心”入口，仍复用 `/ai/membership` 页面。
- 侧边栏底部不再展示“返回首页”按钮，顶部品牌名点击返回公开首页。

### 8.3 输入框与媒体筛选

- 输入框底部功能按钮参考 LibLib 做灰底胶囊按钮、深色发送按钮。
- 图片生成最多一次 4 张。
- 视频生成每次固定 1 条视频。
- 图片/视频顶部筛选工具移动到页面右侧，整体高度提高。
- 时间筛选使用日期范围选择器，一次选择开始和结束时间；快捷选项纵向排列。

### 8.4 登录态入口

- 进入 AI 工具页后，如果用户已登录，右上角不再显示“登录”按钮。
- 登录态展示头像和昵称，hover 后展示用户卡片：用户信息、免费用户权益、积分余额、训练加速余额、存储空间、个人中心、账号设置和退出登录。
