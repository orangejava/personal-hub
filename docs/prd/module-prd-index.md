# 大模块 PRD 细化索引（历史与补充入口）

> 状态：🟡 React-first 历史拆分计划与长期 PRD 补充索引
> 最后更新：2026-08-02
> 当前长期后端入口：[长期 PRD](./long-term/README.md)、[Canonical API](../backend/canonical-api.md)、[Canonical 数据模型](../backend/canonical-data-model.md)

> 本文中的 React-first 历史描述不构成 Nest 实现依据；`apps/server` 脚手架以 [Nest Server 脚手架 PRD](./long-term/nest-server-bootstrap-prd.md) 为准。

---

## 0. 文档分区（必读）

PRD 按实施路线分为两组，**不要混读**：

| 分区                    | 入口                                                                        | 适用场景                         |
| ----------------------- | --------------------------------------------------------------------------- | -------------------------------- |
| **React-first（当前）** | [README.md](./README.md) · [react-first/README.md](./react-first/README.md) | `apps/react-web`、mock、阶段 0–7 |
| **长期全栈**            | [long-term/README.md](./long-term/README.md)                                | Next.js、NestJS、生产部署        |

当前开发顺序以 React-first 为主；长期 PRD 提供字段与 API 契约，供阶段 6 接入时对齐。

---

## 1. 为什么需要这份索引

当前 `docs/` 已经覆盖产品定位、技术选型、前台、工作区、后台、认证、内容、AI、部署等大方向，但如果直接开发，仍会遇到这些问题：

- 页面有哪些状态不够清楚：空状态、加载中、错误、无权限、未登录。
- 每个按钮触发什么接口不够清楚。
- 表单字段、校验规则、默认值、边界条件还不够细。
- 后端模块怎么预留扩展点还需要约定。
- 前台主题色、导航位置、运营端配置项还需要形成统一配置模型。
- 工程初始化过程中产生的新约定，需要同步沉淀，不能只存在聊天记录里。

所以后续开发前，建议在大模块文档之上补 PRD 级细化文档。

---

## 2. PRD 文档颗粒度标准

每个功能模块 PRD 至少包含：

| 章节         | 内容                                           |
| ------------ | ---------------------------------------------- |
| 模块目标     | 这个模块解决什么问题，首版做到哪里             |
| 用户角色     | 访客、会员、编辑者、管理员分别能做什么         |
| 页面清单     | 路由、页面名称、访问权限、入口来源             |
| 页面结构     | 页面区域、组件布局、核心交互                   |
| 字段设计     | 字段名、类型、是否必填、默认值、校验规则       |
| 功能逻辑     | 按钮、筛选、提交、跳转、权限判断、异常处理     |
| 接口草案     | 请求方法、路径、参数、响应重点、错误码         |
| 数据模型影响 | 涉及哪些表、字段、索引、预留扩展点             |
| 状态说明     | loading、empty、error、forbidden、unauthorized |
| 验收标准     | 开发完成后如何判断功能可用                     |
| 后续预留     | 哪些能力暂不做，但字段或架构上预留             |

---

## 3. 大模块 PRD 拆分计划

### 3.1 工程底座

| 文档                                                                       | 状态      | 说明                                                                     |
| -------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------ |
| [nest-server-bootstrap-prd.md](./long-term/nest-server-bootstrap-prd.md)   | ✅ 阶段 0 已实施 | `apps/server`、本地依赖 Compose、Prisma、Redis、Health、Swagger          |
| [bootstrap-prd.md](./react-first/bootstrap-prd.md)                         | 🟡 已补充 | React-first 工程初始化：`apps/react-web`、Ant Design Pro、mock、共享类型 |
| [phase-0-3-foundation-prd.md](./react-first/phase-0-3-foundation-prd.md)   | ✅ 已实施 | React-first 阶段 0-3 一次性实施计划                                      |
| [phase-4-admin-preview-prd.md](./react-first/phase-4-admin-preview-prd.md) | 🟡 已补充 | React-first 阶段 4：后台运营、PDF/Word 预览                              |
| [agent-file-templates.md](../engineering/agent-file-templates.md)          | ✅ 已补充 | 目录级 AGENT 模板；后续领域模块按实际结构补充                            |

优先级：P0。

原因：React-first 与 Nest 阶段 0 骨架均已落地；后续所有真实后端模块依赖现有 Express、Prisma、Redis、Health 与质量入口。Next.js 工程仍保留为后续目标。

---

### 3.2 主题与导航配置

| 文档                                                                           | 状态      | 说明                                     |
| ------------------------------------------------------------------------------ | --------- | ---------------------------------------- |
| [theme-navigation-config-prd.md](./react-first/theme-navigation-config-prd.md) | ✅ 已补充 | 主题色、导航位置、页面布局、未来配置预留 |

优先级：P0。

原因：前台和运营端都需要读取配置，越早统一越不容易后面返工。

---

### 3.3 内容阅读：Markdown + 掘金小册

| 文档                                                           | 状态      | 说明                                                |
| -------------------------------------------------------------- | --------- | --------------------------------------------------- |
| [content-reading-prd.md](./react-first/content-reading-prd.md) | ✅ 已补充 | Markdown 阅读、掘金小册阅读、章节、进度、收藏、目录 |

优先级：P0。

原因：用户明确希望最先开发能阅读 Markdown 文档和掘金小册，这是第一条业务闭环。

---

### 3.4 内容工作区：上传、导入、编辑

| 计划文档                                                           | 状态      | 说明                                                    |
| ------------------------------------------------------------------ | --------- | ------------------------------------------------------- |
| [content-workspace-prd.md](./react-first/content-workspace-prd.md) | ✅ 已补充 | 工作区文档列表、Markdown 创建/编辑、小册导入、草稿/发布 |

优先级：P1。

建议覆盖：

- `/workspace/content`
- `/workspace/markdown`
- `/workspace/booklets`
- 上传 ZIP 与 Markdown 文件
- 导入结果页
- 编辑后保存草稿 / 发布

---

### 3.5 后台运营端：内容与配置

| 计划文档                                                                   | 状态        | 说明                                                            |
| -------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------- |
| [admin-content-config-prd.md](../history/admin-content-config-prd.md)      | 📚 历史资料 | 页面字段决策参考；API、状态与数据模型以 Canonical 为准          |
| [phase-4-admin-preview-prd.md](./react-first/phase-4-admin-preview-prd.md) | 🟡 已补充   | **React-first 阶段 4 实施范围**：admin 页面落地 + PDF/Word 预览 |

优先级：P0（React-first 阶段 4）。

建议覆盖：

- `/admin/content/list`
- `/admin/content/booklets`
- `/admin/content/categories`
- `/admin/content/tags`
- `/admin/menus`
- `/admin/system`
- `/admin/theme`

---

### 3.6 认证与 RBAC

| 计划文档                                                         | 状态      | 说明                                              |
| ---------------------------------------------------------------- | --------- | ------------------------------------------------- |
| [auth-rbac-session-prd.md](./long-term/auth-rbac-session-prd.md) | ✅ 已确认 | JWT 会话、RBAC、权限 seed、数据范围与管理员初始化 |

优先级：P1。

建议覆盖：

- 是否必须邮箱验证。
- 密码复杂度。
- 管理员初始账号。
- 权限点完整枚举。
- 普通会员是否允许上传小册。

---

### 3.7 AI 工具平台

| 计划文档                                       | 状态      | 说明                                           |
| ---------------------------------------------- | --------- | ---------------------------------------------- |
| [ai-tools-prd.md](./long-term/ai-tools-prd.md) | ✅ 已补充 | Chat、文本生成、图片生成、模型配置、Token 消耗 |

优先级：P2。

前置动作：

- 先清理 `docs/product/ai-tools.md` 中重复的旧版段落。
- 统一对话流式输出、多会话、System Prompt、素材引用口径。

---

### 3.8 Flutter App

| 计划文档             | 状态   | 说明                                          |
| -------------------- | ------ | --------------------------------------------- |
| `flutter-app-prd.md` | 待补充 | 移动端内容阅读、登录、收藏、AI Chat、离线缓存 |

优先级：P3。

原因：Flutter 复用后端 API，建议等 Web 主链路稳定后再细化。

---

## 4. 当前推荐开发顺序

### 当前：React-first 阶段 4

目标：

- 完成 `/admin` 运营页面首版 CRUD。
- PDF / Word 公开预览。
- 阅读体验与主题回归验收。

参考：

- [phase-4-admin-preview-prd.md](./react-first/phase-4-admin-preview-prd.md)
- [admin-content-config-prd.md](../history/admin-content-config-prd.md)
- [../react-first/roadmap.md](../react-first/roadmap.md)

### 已完成：React-first 阶段 0–3

参考：

- [phase-0-3-foundation-prd.md](./react-first/phase-0-3-foundation-prd.md)
- [../implementation/react-first/phase-0-3.md](../implementation/react-first/phase-0-3.md)

### 后续：长期全栈工程骨架

目标：

- `apps/server` 可打开 Swagger。
- PostgreSQL 和 Redis 可启动。
- `packages/shared-types` 能被前后端引用。
- `apps/server/AGENT.md` 落地。

参考：

- [nest-server-bootstrap-prd.md](./long-term/nest-server-bootstrap-prd.md)
- [agent-file-templates.md](../engineering/agent-file-templates.md)

### 第三步：主题与导航配置底座

目标：

- 系统配置中有主题色、导航位置、布局配置。
- 前台和运营端有统一读取配置的约定。
- 后续开发页面时不硬编码站点名、主题色、导航布局。

参考：

- [theme-navigation-config-prd.md](./react-first/theme-navigation-config-prd.md)

### 第四步：Markdown / 掘金小册阅读闭环

目标：

- 数据库有内容、章节、分类、标签、阅读记录。
- 后端能返回 Markdown 内容详情和小册章节。
- 前端能阅读 Markdown 和掘金小册。
- 登录用户能收藏和保存阅读进度。

参考：

- [content-reading-prd.md](./react-first/content-reading-prd.md)

### 第五步：内容生产与后台运营

目标：

- 工作区能创建 Markdown、导入小册、管理草稿和发布状态。
- 后台能管理内容、分类、标签、文件、首页配置和系统配置。

参考：

- [content-workspace-prd.md](./react-first/content-workspace-prd.md)
- [admin-content-config-prd.md](../history/admin-content-config-prd.md)

### 第五步：AI 工具平台

目标：

- Chat、文本生成、图片生成和用量统计形成可用闭环。
- 后台模型配置能影响用户端可选模型。

参考：

- [ai-tools-prd.md](./long-term/ai-tools-prd.md)

---

## 5. 文档维护规则

- 每开始一个大模块开发前，先补齐对应 PRD。
- 开发过程中如果发现字段、接口、权限、配置有变化，同步更新 PRD 和原大模块文档。
- 如果工程中新增目录级规范，必须同步更新对应 `AGENT.md`。
- 如果用户学习成本较高，补充到 `study/`，不要只写在交付说明里。
- PRD 不追求一次写到完美，但必须足够指导“第一轮可开发版本”。
