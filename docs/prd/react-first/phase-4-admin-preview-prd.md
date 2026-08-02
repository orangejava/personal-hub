# 阶段 4：后台运营与文档预览 PRD

> 状态：✅ 阶段 4 收尾已完成；阶段 4.5 体验深化已完成本轮收尾
> 最后更新：2026-07-05
> 优先级：P0（React-first 当前主线）
> 目标：在 `apps/react-web` 内完成后台运营台首版 CRUD、文档在线预览（PDF/Word）与公开阅读增强，仍使用 mock，为阶段 6 接入 NestJS 预留 service 契约。

---

## 1. 本 PRD 解决什么问题

阶段 0–3 已跑通公开前台、工作区内容生产与 Markdown/小册阅读。阶段 4 聚焦**运营侧能力**与**非 Markdown 内容可读性**，补齐管理员日常运营闭环。

实施范围来自 [../../react-first/roadmap.md](../../react-first/roadmap.md) 阶段 4，并吸收阶段 2–3 遗留项：

| 来源        | 内容                                                                  |
| ----------- | --------------------------------------------------------------------- |
| 阶段 4 主线 | 后台用户/角色/内容/分类/标签/文件/首页/菜单/系统/日志                 |
| 阶段 2 遗留 | PDF、Word 在线预览（阶段 0–3 仅占位）                                 |
| 阶段 3 遗留 | 富文本阅读占位 → 本阶段评估 Textbus 只读渲染                          |
| 阅读体验    | 目录锚点、代码块工具栏、章节切换滚顶（阶段 3 后补丁，本阶段验收固化） |

**明确不包含**：

- NestJS 真实 API（阶段 6）
- Next.js 应用（阶段 7）
- AI 工具平台（阶段 5）
- Flutter App
- 完整富文本协作编辑（Textbus 编辑留阶段 5+ 或独立迭代）

---

## 2. 已确认决策

| 事项         | 结论                                                                            |
| ------------ | ------------------------------------------------------------------------------- |
| 工程         | 仍在 `apps/react-web`，不新建 admin 工程                                        |
| 后台 UI      | Ant Design Pro Layout + ProTable + ProForm                                      |
| 数据         | mock 为主；`services/admin/*` 与 future NestJS 路径对齐                         |
| PDF 预览     | **react-pdf**（见 `apps/react-web/src/config/documentViewers.ts`）              |
| Word 预览    | **docx-preview**（浏览器端 docx → HTML）                                        |
| 富文本阅读   | **方案 A**：本阶段集成 Textbus 只读 View；编辑仍占位                            |
| 小册上传权限 | 仅 `editor` / `admin`（`booklet:write`）；`member` 不可上传                     |
| AI 导航      | 阶段 4 仅顶栏 `/ai` 占位；完整功能阶段 5                                        |
| 站点访问     | 域名未定前开发用 `http://localhost:8000`                                        |
| 视觉规范     | 见 [frontend-visual-spec.md](./frontend-visual-spec.md)                         |
| Mock 账号    | 见 [../../engineering/dev-credentials.md](../../engineering/dev-credentials.md) |
| 权限         | 沿用 `access.ts` + mock 角色；`/admin/*` 仅 admin                               |
| 主题         | 根级 `ThemeProvider` + 工作区 `SettingDrawer`；公开/工作区主题分离              |
| 本地小册     | 继续 `pnpm sync:booklets`；TOC anchor 与 MarkdownViewer slug 一致               |

---

## 3. 总体完成效果

阶段 4 完成后应满足：

1. **admin** 登录后可访问 `/admin` 下全部运营页面，非 admin 有明确无权限反馈。
2. ProTable / ProForm 支撑内容、用户、角色、分类、标签、文件、菜单、系统配置的主要 CRUD。
3. 后台配置变更（主题色、站点名、首页模块、菜单）能反映到公开前台 mock 展示。
4. 公开区 PDF / Word 详情页可在线预览（mock 或本地文件 URL）。
5. 富文本类型使用 Textbus 只读预览（方案 A）。
6. 小册/Markdown 目录无 `**` 残留，点击目录可定位；代码块支持折叠/语言/复制。
7. service 方法签名稳定，阶段 6 替换 mock 时页面层改动最小。

---

## 4. 模块拆分

### 4.1 后台运营台（`/admin`）

参考产品范围：[../../product/admin.md](../../product/admin.md)、PRD 细化：[../long-term/admin-content-config-prd.md](../long-term/admin-content-config-prd.md)。

| 路由                        | 页面     | 首版能力                            |
| --------------------------- | -------- | ----------------------------------- |
| `/admin/dashboard`          | 运营概览 | 内容/用户/访问量 mock 统计卡片      |
| `/admin/users`              | 用户管理 | 列表、禁用/启用、角色分配           |
| `/admin/roles`              | 角色管理 | 列表、权限点勾选（mock）            |
| `/admin/content/list`       | 文档列表 | 筛选、发布/归档、删除、跳转编辑     |
| `/admin/content/booklets`   | 小册管理 | 小册列表、章节数、删除              |
| `/admin/content/categories` | 分类管理 | 树形 CRUD                           |
| `/admin/content/tags`       | 标签管理 | 列表 CRUD                           |
| `/admin/files`              | 文件管理 | 上传 mock、预览链接、删除           |
| `/admin/homepage`           | 首页配置 | 模块显隐、排序                      |
| `/admin/menus`              | 菜单管理 | 公开/工作区/后台菜单 mock 编辑      |
| `/admin/system`             | 系统配置 | Key-Value、站点名、SEO 占位         |
| `/admin/system/theme`       | 主题配置 | 与工作区 SettingDrawer 字段对齐说明 |
| `/admin/logs`               | 操作日志 | 只读列表、筛选                      |

**验收要点**：

- 所有表格具备 loading / empty / error。
- 删除、下线、批量操作二次确认。
- 操作写入 mock 日志数组（便于阶段 6 对齐 `audit_logs` 表）。

### 4.2 PDF / Word 在线预览（公开区 + 工作区）

| 类型 | 组件         | 公开阅读路由   | 工作区           |
| ---- | ------------ | -------------- | ---------------- |
| PDF  | react-pdf    | `/content/:id` | 文档详情预览 Tab |
| Word | docx-preview | 同上           | 同上             |

**接口/mock 约定**：

- `ContentDetail.fileUrl` 或 `body` 外字段 `previewUrl` 指向 mock 静态文件或 MinIO 占位 URL。
- 大文件首版不做分页缓存优化，需 loading 与加载失败态。
- PDF 需处理 worker 路径（react-pdf 官方推荐 copy 到 public 或 CDN）。

**不做**：

- PDF 标注、表单填写
- Word 在线编辑（仍跳工作区占位或下载）

### 4.3 富文本（Textbus）只读

**已确认：方案 A** — 本阶段集成 Textbus 只读 View，mock 存 JSON delta。需补 `study/features/textbus-readonly.md`。

### 4.4 阅读体验固化（阶段 3 后补丁验收）

| 项       | 标准                                                              |
| -------- | ----------------------------------------------------------------- |
| 章节切换 | 上一章/下一章 / 菜单切换后滚到内容顶部                            |
| 目录     | `stripMarkdownInline` + `slugifyHeading`；mock TOC 与 DOM id 一致 |
| 代码块   | 折叠、语言标签、复制（`copyToClipboard` 通用方法）                |
| 主题     | 公开深色顶栏导航可读；工作区深色无「壳亮表暗」混合                |

---

## 5. 技术实现要点

### 5.1 目录与文件（计划新增/修改）

```txt
apps/react-web/
├── src/pages/admin/          # 各运营页面
├── src/services/admin/       # admin API mock 契约
├── mock/admin/               # 用户、角色、日志等
├── src/components/shared/
│   ├── PdfViewer/            # react-pdf 封装
│   ├── WordViewer/           # docx-preview 封装
│   └── RichTextViewer/       # Textbus 只读（可选）
└── src/config/documentViewers.ts  # 已有选型，安装依赖时对齐
```

### 5.2 依赖（阶段 4 新增）

| 包                 | 用途                     |
| ------------------ | ------------------------ |
| `react-pdf`        | PDF 预览                 |
| `docx-preview`     | Word 预览                |
| `@textbus/core` 等 | 富文本只读（若选方案 A） |

### 5.3 与 NestJS 对齐

- mock service 维持现有兼容结构；真实接口接入时遵循 Canonical API。
- admin 列表分页参数在真实接口接入时以 [Canonical API](../../backend/canonical-api.md) 为准。
- 共享类型扩展放 `packages/shared-types`，先改类型再改 mock。

---

## 6. 阶段边界

### 6.1 必须完成

- [ ] `/admin` 下 §4.1 全部页面可访问（至少列表 + 核心操作）。
- [ ] PDF、Word 公开详情可预览 mock 样例文件。
- [ ] 后台菜单/系统配置变更反映到 `@@initialState`。
- [ ] 阅读体验 §4.4 回归通过。

### 6.2 可选 / 下一阶段

- [ ] Textbus 只读（若本阶段时间不足，保持占位并在 roadmap 标注）
- [ ] 文件真实上传到 MinIO
- [ ] 操作日志持久化

### 6.3 不做

- [ ] AI 工具
- [ ] NestJS 实现
- [ ] Next.js SSR 抽离

---

## 7. 当前缺口与补齐计划（2026-07-04 审阅后）

### 7.0 完成度判断

阶段 4 在 2026-07-05 已完成本轮收尾，可以作为阶段 5 前的后台 mock 验收基线。目前代码已经具备后台主路由、核心列表页、PDF/Word 预览、首页配置、菜单配置、内容状态 mock 持久更新、分类树、文件引用校验和操作日志写入。

判断如下：

| 维度                    | 当前判断                                                | 是否阻塞阶段 5                                    |
| ----------------------- | ------------------------------------------------------- | ------------------------------------------------- |
| 后台页面骨架            | 已基本可访问                                            | 不阻塞                                            |
| PDF / Word / 富文本阅读 | 已可体验，PDF 已修复开发态兼容问题                      | 不阻塞                                            |
| 首页配置联动            | 已补齐 mock 配置源与保存入口                            | 不阻塞                                            |
| 菜单配置联动            | 已补齐公开/工作区/后台/AI 预留菜单配置                  | 不阻塞                                            |
| 内容状态 mock 持久更新  | 已写回共享 contents                                     | 不阻塞                                            |
| 分类树、文件引用校验    | 已补齐树形 CRUD、引用校验和批量删除                     | 不阻塞                                            |
| 操作日志                | 关键后台操作已写入 mock 日志，支持 action/resource 筛选 | 不阻塞                                            |
| 权限契约统一            | 未统一                                                  | 若开放多人使用或做角色配置，建议阶段 4 收尾单独做 |

结论：

1. 阶段 4 P0/P1 收尾项已落地，后续只保留权限契约统一和用户详情等可独立迭代项。
2. 阶段 5 可以进入 AI 独立工作台开发，但必须复用阶段 4.5 的体验组件和菜单配置约定。
3. 网站整体动画、加载、骨架屏已在阶段 4.5 建立底座，后续开发阶段 5 时继续扩覆盖范围。

### 7.1 已基本完成

| 模块                | 当前状态                                    | 后续动作                                    |
| ------------------- | ------------------------------------------- | ------------------------------------------- |
| 用户管理            | ProTable 列表、启用/禁用、角色切换已接 mock | 补 Token 配额和用户详情可放到 NestJS 接入前 |
| 角色管理            | 权限勾选已接 mock                           | 权限点命名需与长期 RBAC 收口                |
| 文档列表            | 筛选、发布/归档、删除已接 mock              | mock 需真正更新内容状态，避免刷新后丢失     |
| 分类 / 标签         | 新增、删除已接 mock                         | 分类需补树形展示、编辑、父子校验            |
| 文件管理            | 列表、删除、预览链接已接 mock               | 补 Word 文件和引用占用校验                  |
| 系统配置 / 主题配置 | 可保存并刷新 `@@initialState`               | 补更多字段和公开页配置映射                  |
| PDF / Word 预览     | `react-pdf`、`docx-preview` 已接入样例文件  | PDF 补响应式宽度和分页策略                  |
| 富文本只读          | Textbus readonly 已跑通                     | 补学习文档和复杂 HTML 样例                  |

### 7.2 未完成且阶段 4 应补齐

| 优先级 | 模块                       | 需要补什么                                                                         | Mock 数据要求                                                 |
| ------ | -------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| P0     | 首页配置 `/admin/homepage` | 已完成：Hero、内容推荐、AI 工具、技术栈模块显隐、排序、保存                        | 4 个首页模块、精选内容 6 条、技术栈 8 条                      |
| P0     | 菜单管理 `/admin/menus`    | 已完成：公开/工作区/后台/AI 预留菜单树展示、编辑、保存并刷新 `@@initialState.menu` | 三套既有菜单树 + AI 侧栏预留菜单                              |
| P0     | 内容状态 mock              | 已完成：后台发布/归档写回共享 mock 数据，刷新列表后状态仍正确                      | 内容列表已补 `status`、`visibility`、`createdAt`、`updatedAt` |
| P1     | 分类树形 CRUD              | 已完成：树形展示、新增子分类、编辑、删除前检查子级和内容引用                       | 已准备二级分类和关联内容数                                    |
| P1     | 文件管理增强               | 已完成：Word/PDF/图片样例、引用占用提示、批量删除 mock                             | 已准备图片、PDF、Word、未引用、被引用文件                     |
| P1     | 操作日志                   | 已完成：关键后台操作写入日志，日志支持 action/resource 筛选                        | 覆盖登录、更新用户、角色权限、内容、文件、首页/菜单/系统配置  |
| P2     | 用户详情                   | 角色、Token 配额、最近 AI 使用日志                                                 | 准备 token 交易记录和 AI 使用日志                             |

### 7.2.1 后台管理还需要补哪些配置

当前项目后续还需要补充以下后台配置，才能支撑“内容平台 + AI 平台 + 工作区”的长期形态：

| 分组       | 配置项                                           | 为什么需要                                   | 建议阶段           |
| ---------- | ------------------------------------------------ | -------------------------------------------- | ------------------ |
| 站点配置   | 站点名、Logo、favicon、SEO、站长信息、社交链接   | 公开前台和后续 Next.js SEO 需要统一来源      | 阶段 4 P0          |
| 首页配置   | Hero、精选内容、AI 工具推荐、技术栈、项目推荐    | 让后台配置影响公开首页，不再写死 mock 文案   | 阶段 4 P0          |
| 菜单配置   | 公开导航、工作区菜单、后台菜单、AI 侧边栏        | 阶段 5 AI 工作台会新增大量入口，需要统一管理 | 阶段 4 P0 / 阶段 5 |
| 内容配置   | 分类、标签、内容类型、可见性、精选规则           | 内容中心和 AI 引用素材都依赖稳定内容元数据   | 阶段 4 P1          |
| 文件配置   | 存储位置、本地/MinIO、引用占用、文件类型白名单   | PDF/Word/图片资产都需要统一文件规则          | 阶段 4 P1          |
| AI 配置    | 厂商、模型、工具启用、默认模型、单价、上下文长度 | 阶段 5 用户端模型选择和后台统计依赖          | 阶段 5             |
| 会员与配额 | 初始 Token、套餐、用量限制、访客试用次数         | AI 平台商业化入口需要先有 mock 口径          | 阶段 5             |
| 通知配置   | 邮件、站内通知、邀请奖励提示                     | 后续注册、会员、邀请有礼会用到               | 阶段 6+            |
| 审计配置   | 操作日志保留天数、敏感操作二次确认               | 后台管理安全与排查需要                       | 阶段 4 P1          |

后台菜单分组建议同步调整为：

- `运营概览`
- `内容管理`：文档列表、小册管理、分类管理、标签管理、文件管理、首页配置
- `AI 管理`：AI 配置、AI 统计、工具配置、套餐配置（阶段 5 增加）
- `系统管理`：用户管理、角色管理、菜单管理、系统配置、主题配置、操作日志

文件管理放到内容管理下更合理，因为当前文件主要服务内容预览、封面、附件和后续 AI 资产引用。用户管理和角色管理属于系统管理，不应作为后台一级散落入口。

### 7.2.2 阶段 4 收尾实施顺序

1. 重组后台菜单分组，先让信息架构和后续 AI 管理入口一致。
2. 补 `/admin/homepage` mock 配置联动首页。
3. 补 `/admin/menus` 三套菜单树保存和刷新。
4. 补内容状态 mock 持久更新。
5. 补分类树编辑、父子校验、引用数量。
6. 补文件样例、引用占用校验、批量删除。
7. 补关键操作写入日志。
8. 再评估是否统一权限契约。

---

## 8. 阶段 4.5：体验优化底座

用户体验优化建议现在开始做，但不把所有页面一次性重做。原因是阶段 5 会引入大量交互页面，如果现在先建立统一的加载、骨架、动效和反馈规范，后面开发 AI 页面能直接复用；如果等阶段 5/6 后再做，会同时改很多页面和状态流，返工更大。

### 8.1 现在应该做

| 能力            | 目标                                    | 覆盖范围                                  |
| --------------- | --------------------------------------- | ----------------------------------------- |
| 统一 loading    | 页面级、区块级、按钮级 loading 规范     | 公开页、工作区、后台                      |
| 骨架屏          | 列表、详情、阅读页、表格使用统一骨架    | 内容中心、详情页、ProTable 外的自定义区块 |
| 空状态 / 错误态 | 统一标题、说明、重试按钮、返回按钮      | 所有 service 请求页面                     |
| 页面切换反馈    | 路由切换时避免白屏和布局跳动            | 全站                                      |
| 基础动效        | hover、卡片进入、抽屉打开、流式输出光标 | 公开页 + AI 阶段                          |
| 图片 / 文档占位 | PDF、Word、封面图加载前后稳定尺寸       | 内容详情和文件管理                        |

### 8.1.1 已启动落地（2026-07-05）

| 能力           | 当前实现                                                                                 | 位置                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 页面级 loading | `PageLoading` 统一整页等待态                                                             | `src/components/shared/PageLoading`                                                   |
| 区块级骨架     | `SectionSkeleton` 支持 card/list/table/article                                           | `src/components/shared/SectionSkeleton`                                               |
| 结果态         | `ResultState` 统一 empty/error/success/warning/info，旧 `EmptyState`/`ErrorState` 已收敛 | `src/components/shared/ResultState`                                                   |
| 页面切换动画   | `PageTransition` 在 ProLayout 与 PublicLayout 统一接入                                   | `src/components/shared/PageTransition`、`src/app.tsx`、`src/layouts/PublicLayout.tsx` |
| 动效 token     | duration/easing/distance 与 reduced motion                                               | `src/styles/tokens.less`、`src/styles/motion.less`                                    |
| 首批页面接入   | 首页、内容中心、内容详情、小册阅读、工作台、后台概览、首页配置、菜单管理                 | 对应页面目录                                                                          |

### 8.1.2 深化落地（2026-07-05）

| 能力     | 当前实现                                                                                          | 位置                                          |
| -------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 动效分层 | 页面、内容、hover/stagger 拆分 token，页面切换位移更轻                                            | `tokens.less`、`motion.less`                  |
| 局部动效 | `MotionSurface`、`AnimatedList` 统一卡片/列表进入动画                                             | `src/components/shared`                       |
| 骨架变体 | `stats`、`form`、`media`、`dashboard` 等变体                                                      | `SectionSkeleton`                             |
| 文档预览 | PDF/Word/RichText 接入统一骨架和结果态，固定预览高度                                              | `PdfViewer`、`WordViewer`、`RichTextViewer`   |
| 页面覆盖 | 项目、关于、AI 占位、工作区小册/收藏/用量/个人设置、后台用户/角色/内容/分类/标签/文件/系统/日志等 | 对应页面目录                                  |
| 操作反馈 | 发布、归档、删除、批量删除、保存配置、角色权限、用户状态等操作补 loading/error                    | 工作区与后台页面                              |
| 滚动策略 | 阅读详情和小册章节使用统一滚顶工具，后台表格不强制滚顶                                            | `utils/scroll.ts`                             |
| 验收修复 | 清理 MFSU 生成缓存恢复开发态渲染；富文本只读页去除编辑器工具栏；mock 业务失败不再打印 AxiosError  | dev server、`RichTextViewer`、`mock/utils.ts` |

### 8.2 暂时不做

- 大规模视觉重设计。
- 自研复杂动画系统。
- 所有页面统一重写布局。
- 真实接口缓存策略和乐观更新，等阶段 6 接后端后再定。

### 8.3 推荐实施顺序

1. 已新增 `PageLoading`、`SectionSkeleton`、`ResultState`、`PageTransition` 等共享体验组件。
2. 已先改首页、内容中心、内容详情、小册阅读、工作台、后台 Dashboard、首页配置、菜单管理这些高频页面。
3. 已完成阶段 4.5 深化主要页面覆盖和浏览器验收，阶段 5 PRD 需继续增加“必须复用体验组件”的验收标准。
4. 阶段 5 开发时同步使用，不再每个页面临时写 loading。

## 9. 权限契约是否现在完善

当前代码使用简化权限：

- `content:read`
- `content:write`
- `content:publish`
- `content:delete`
- `booklet:read`
- `booklet:write`
- `workspace:access`
- `admin:access`
- `user:manage`
- `role:manage`
- `ai:use`
- `ai:manage`
- `system:config`

长期文档使用更细权限：

- `content:view`
- `content:upload`
- `content:edit:own`
- `content:edit:all`
- `content:delete:own`
- `content:delete:all`
- `content:manage:category`
- `content:manage:tag`
- `system:user:manage`
- `system:role:manage`
- `system:menu:manage`
- `system:file:manage`
- `system:log:view`
- `system:ai:config`
- `system:ai:stats`

判断：

- 如果只是本地开发或小范围给别人试用，暂时不改影响不大。当前路由级 `admin/editor/member` 已能挡住主要入口。
- 如果要开放多人使用、后台可配置角色权限，建议先统一权限契约再继续扩后台。否则后面会同时改共享类型、mock 用户、菜单、按钮权限、文档和后端 Guard。
- 统一权限的改动规模为中等：主要影响 `packages/shared-types/src/permission.ts`、`mock/data/users.ts`、`mock/data/admin-store.ts`、`mock/data/menus.ts`、`src/access.ts`、`PermissionGate` 使用点和后台角色页。

阶段 4 推荐策略：

1. 本轮先不改权限代码，避免打断后台补齐。
2. 在阶段 4 收尾或阶段 5 启动前，新开一次“权限契约统一”任务。
3. 统一时以 `docs/product/auth-rbac.md` 和 `docs/backend/canonical-api.md` 为准，同步更新 React-first 文档。

## 10. 内容类型补全决策

`ContentItem` 已补充可选运营字段：

- `status`
- `visibility`
- `createdAt`
- `updatedAt`

区别：

- 以前：公开列表、工作区列表、后台列表共用 `ContentItem`，但列表类型没有状态和可见性，页面只能用临时强转读取。
- 现在：公开页仍可只使用展示字段；工作区和后台拿到运营字段时有类型提示，后续接 API 更自然。
- 后续：若后台字段继续增多，可再拆 `ContentListItem`、`WorkspaceContentItem`、`AdminContentItem`，避免一个类型越来越臃肿。

---

## 11. 验收标准（手动）

1. 使用 admin mock 账号进入 `/admin/content/list`，筛选、发布、删除流程可用。
2. 打开 mock PDF/Word 内容详情，文档在页内渲染，无控制台报错。
3. 小册章节：目录无 `**`，点击跳转正确；代码块可复制。
4. 公开区深色 → 工作区深色：侧栏、顶栏、ProTable 同一套暗色。
5. `pnpm exec tsc --noEmit` 通过。

---

## 12. 相关文档

| 文档                                                                                           | 关系           |
| ---------------------------------------------------------------------------------------------- | -------------- |
| [../../react-first/roadmap.md](../../react-first/roadmap.md)                                   | 阶段总览       |
| [phase-0-3-foundation-prd.md](./phase-0-3-foundation-prd.md)                                   | 上一阶段 PRD   |
| [../long-term/admin-content-config-prd.md](../long-term/admin-content-config-prd.md)           | 后台字段级细化 |
| [content-reading-prd.md](./content-reading-prd.md)                                             | 阅读交互来源   |
| [../../implementation/react-first/phase-0-3.md](../../implementation/react-first/phase-0-3.md) | 已实现说明     |

---

## 13. 后续预留

- 阶段 5：AI 工具（`@ant-design/x`），见 [phase-5-ai-platform-prd.md](./phase-5-ai-platform-prd.md)
- 阶段 6：mock → NestJS，admin service 逐模块切换
- 阶段 7：公开页迁移 Next.js，admin 可仍留 React 或后续再议
