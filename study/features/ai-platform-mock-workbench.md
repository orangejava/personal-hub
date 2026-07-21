# AI 平台 mock 工作台实现笔记

## 场景背景

当一个项目既有公开前台、登录后工作区和后台管理台，又要新增 AI 工具平台时，最容易出问题的是布局互相污染、第三方组件调用散落、mock 状态和后续真实接口脱节。阶段 5 的目标不是接真实 AI 厂商，而是先把 AI 工作台的信息架构、页面状态、service 契约和 mock 数据流跑通。

## 核心概念

- AI 专属布局：`/ai/*` 使用 `AiLayout`，公开前台继续使用 `PublicLayout`，工作区和后台继续使用 ProLayout。
- 本地封装层：页面不直接 import `@ant-design/x`，只通过 `src/components/ai-x` 使用 Ant Design X。
- 业务组件层：`src/components/ai` 放项目自己的 AI 业务交互，例如引用内容、附件选择、额度提示、生成流。
- 稳定 service 契约：页面调用 `src/services/ai.ts`，mock 路由再访问 `mock/data/ai-store.ts`，后续接真实后端时尽量替换 service/mock 层。
- 配置联动：用户端模型、工具状态、品牌名从后台 AI 配置 mock 派生，避免页面硬编码。

## 实现步骤

1. 先建 AI 壳层：`src/layouts/AiLayout` 负责侧栏、顶部栏、移动端抽屉、品牌名和 Token 余额。
2. 再建 Ant Design X 封装：`src/components/ai-x` 覆盖 Bubble、Sender、Conversations、Actions、Markdown、Attachments、hooks 等能力。
3. 补共享类型：`packages/shared-types/src/ai.ts` 定义工具、模型、会话、消息、资产、用量、会员、生成任务。
4. 补 mock store：`apps/react-web/mock/data/ai-store.ts` 维护会话、资产、额度、模板、最近创作和会员 mock 数据。
5. 页面只做编排：`src/pages/ai` 负责 Chat、Text、Image、Video、Assets、Membership 和占位工具页。
6. 做联动验证：生成结果写入资产，成功后扣 Token，工作区用量和 AI 顶部余额使用同一份 quota。

## 关键代码

页面层不要这样直接依赖第三方组件：

```ts
import { Bubble, Sender } from '@ant-design/x';
```

而是通过本地封装入口：

```ts
import { AiXBubble, AiXSender } from '@/components/ai-x';
```

mock 数据流保持单向：

```txt
page
  -> src/services/ai.ts
  -> mock/ai.ts
  -> mock/data/ai-store.ts
```

## 常见错误

- 页面层直接 import `@ant-design/x`，后续改 UI 时会到处找调用点。
- `/ai/*` 复用公开前台布局，导致公开导航和 AI 侧栏同时出现。
- 生成结果只存在页面 state，刷新或跳转到资产页后无法查看。
- Token 扣减散落在各页面，导致会员中心、工作区用量和 AI 顶部余额不一致。
- dev server 出现 MFSU/core-js 缓存错误时，误判为业务代码问题。可清理 `apps/react-web/src/.umi` 和 `apps/react-web/node_modules/.cache/mfsu` 后重启。

## 手动验证

1. 打开 `/ai`，确认进入 AI 专属布局，公开顶部导航隐藏。
2. 打开 `/ai/chat`，创建会话、发送消息、停止生成、重新生成。
3. 打开 `/ai/text`、`/ai/image`、`/ai/video`，确认生成结果可保存到 `/ai/assets`。
4. 打开 `/ai/membership` 和 `/workspace/usage`，确认 Token 余额来自同一份 mock quota。
5. 打开 `/content`、`/workspace/ai/history`、`/admin/ai/config`，确认它们没有被 AI Layout 污染。
6. 运行 `rg "@ant-design/x" apps/react-web/src -n`，确认第三方 X import 只出现在 `src/components/ai-x`。
