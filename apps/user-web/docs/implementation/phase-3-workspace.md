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

## 8. M4 内容域对接后的编辑体验修正（2026-09）
- 文档管理中的 Markdown / 富文本草稿标题改为直接进入对应工作区编辑器；公开详情页只用于已发布内容。
- 分类选项统一读内容元数据接口提供的启用分类，并在创建时设为必填。历史草稿仍可在「基础信息」补选或修改；发布未选分类时会展开抽屉并标记字段错误，避免只收到后端错误 toast。
- 编辑器首次创建成功后仅在页面状态内保存新 ID，不再通过 `history.push` 重挂载当前编辑器，因此保存草稿和发布不会整页闪动。
- Markdown 与富文本的操作区都有全屏按钮。全屏状态由 `@@initialState.workspaceEditorFullscreen` 驱动 ProLayout 隐藏顶栏、侧栏与页脚；离开编辑页自动恢复。Markdown 编辑器自身的全屏命令已关闭，避免与页面级全屏重复。
- 侧栏和文档管理页只保留「新建内容」作为创建入口。Markdown / 富文本 / 小册的路由保留，已存在的内容仍可编辑或访问。
- `TextbusEditor` 的高度改用 React 容器样式控制。切换全屏时不会销毁重建 Textbus，防止未保存内容丢失。
- 工作区 ProLayout 固定为视口高度，Footer 处于主内容区之后。表格等超长页面只在中间内容区滚动，Footer 始终留在可视区域底部；全屏退出后侧栏固定恢复为展开状态，避免路由切换时意外折叠。
- 工作区暂时隐藏语言切换，避免与仅出现在工作区的局部多语言能力产生认知不一致；公开首页的多语言入口后续与整站国际化一并设计。
- Markdown / 富文本编辑页在操作栏提供“返回文档管理”，不必依赖侧栏返回列表。编辑路由仍按“文档管理”高亮；工作区菜单组的 `openKeys` 统一受 `@@initialState` 管理，因此全屏进出和页面跳转不会重置 Content 菜单组的展开状态。
- 工作区侧栏折叠由 `workspaceSiderCollapsed` 控制，不能再写死 `collapsed: false`。编辑全屏只隐藏框架，退出后恢复用户上次的折叠状态，而不是强制展开。
- 工作区顶栏提供「返回前台」，进入公开首页 `/`；公开区顶栏不展示该按钮。
- Markdown 与富文本的「基础信息」抽屉都有「保存信息」。该按钮只确认分类/可见性/摘要到表单，真正写入服务端仍走保存草稿或发布。当前可编辑类型只有这两种；Word / PDF / 外链 / 项目尚无工作区编辑页。
- 新建内容入口仅保留 Markdown 与富文本：PDF、Word、ZIP 小册与外链项目尚未有完整工作区编辑/导入链路，不能再创建后把用户带到无法继续编辑的页面。
- 编辑器“首次创建并发布”先落草稿并记录内容 ID，再单独发布；发布校验或网络错误后，用户继续保存/重试仍会更新同一条草稿。阅读进度上报失败后会停止当前阅读会话的后续上报，避免滚动产生未处理 Promise rejection。
