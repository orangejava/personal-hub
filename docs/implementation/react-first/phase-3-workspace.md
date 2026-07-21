# 阶段 3：工作区与内容生产

## 1. 目标与范围
- 登录后工作区：概览、文档管理、新建内容、Markdown 编辑、小册管理、收藏、用量、个人设置。
- 让用户在 mock 环境下完整跑通「创建 → 编辑 → 发布 → 查看」闭环。
- 非目标：真实持久化、AI 写作、富媒体上传。

## 2. 页面与入口
| 路由 | 文件 | 说明 |
|---|---|---|
| `/workspace/dashboard` | `workspace/Dashboard` | 概览统计 + 继续阅读 |
| `/workspace/content` | `workspace/Content` | 我的内容 ProTable（类型/状态/操作） |
| `/workspace/content/new` | `workspace/ContentNew` | 新建向导（类型 + 基础信息） |
| `/workspace/markdown`、`/workspace/markdown/:id` | `workspace/Markdown` | Markdown 编辑器 |
| `/workspace/booklets` | `workspace/Booklets` | 本地小册 + 站点小册 |
| `/workspace/favorites` | `workspace/Favorites` | 我的收藏 |
| `/workspace/usage` | `workspace/Usage` | Token 用量（mock） |
| `/workspace/profile` | `workspace/Profile` | 个人资料（mock） |

## 3. 接口与数据流
workspace mock 接口（`mock/workspace.ts`）：
- `GET /api/workspace/stats` → `WorkspaceStats`
- `GET /api/workspace/continue-reading` → 进行中的小册
- `GET /api/workspace/contents` → 我的内容列表（含 `status`）
- `POST /api/workspace/contents` → 创建草稿
- `PUT /api/workspace/contents/:id` → 更新
- `GET /api/workspace/booklets/local` → 本地同步小册
- `GET /api/workspace/favorites`、`GET /api/workspace/usage`

数据流与阶段 1 一致：service 调 mock → `useRequest` 自动解包 `data` → 页面渲染。

## 4. 关键实现
- `Content`（ProTable）：`actionRef` 控制刷新；`valueEnum` 由 `ContentType` / `ContentStatus` / `ContentVisibility` 生成；支持标题、类型、状态、可见性筛选；操作可编辑、查看、发布、归档、还原草稿、删除。
- `ContentNew`（ProForm）：选类型 → 填基础信息 → `createContent` → 按 `type` 跳对应编辑/阅读页。
- `Markdown`：`@uiw/react-md-editor` 分栏；标题用大号 `Input`；「基础信息」抽屉存分类/摘要；`beforeunload` 在 `dirty` 时拦截离开；保存区分草稿/发布。
- `Booklets`：本地小册来自 `fetchLocalBooklets`（`syncedAt` 显示同步时间），站点小册来自 `fetchContentList({type: Booklet})`，卡片点击 `history.push('/content/:id')`。
- `Usage`：`fetchUsage` 返回 `total/used/remaining`，`Progress` 展示，>80% 标红。
- `Profile`：从 `useModel('@@initialState')` 取 `currentUser` 预填，保存为 mock。
- 工作区菜单把「文档管理 / 新建内容 / 新建 Markdown / 小册管理 / 我的收藏」收敛到「内容中心」分组，避免侧栏过散。

## 5. 权限与异常
- 工作区路由 `access: { canLogin: true }`，未登录跳登录。
- 编辑离开未保存用 `beforeunload` 提醒（SPA 内跳转的拦截待阶段 4 用 `history.block` 补）。
- 接口失败 → message 提示，不阻塞表格骨架。

## 6. 验证方式
- `curl /api/workspace/usage` 返回 `code:0`；`curl /api/workspace/contents` 列表首项含 `status`。
- admin 登录 → 工作区各页可打开；新建 Markdown → 保存草稿 → 提示成功。
- `tsc` 0 错误，`biome check` 通过，`pnpm build:react` 通过。

## 7. 已知限制与后续扩展
- mock 无持久化，创建/编辑结果刷新即失，阶段 4 接 NestJS 后 service 不变即可切真实。
- `ContentItem` 暂无 `status` 字段，用 `(r as any)` 临时读取；接入后端时在 `shared-types` 补字段并去掉强转。
- 用量页为占位，真实统计在 AI 阶段接入。
