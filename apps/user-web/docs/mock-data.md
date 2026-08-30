# React-first Mock 数据与接口契约

> 状态：🟢 阶段 0-5 mock 已实施；本文继续作为真实 API 接入前的契约索引
> 最后更新：2026-07-10；启动方式 2026-08-30：默认 `dev` 为 `MOCK=none`，`dev:mock` 才加载 mock
> 目标：在 NestJS 后端完成前，用 mock 数据支撑完整前端开发，同时保证后续接真实 API 时改动可控。

---

## 1. Mock 的定位

React-first 阶段的 mock 不是临时页面数据，而是未来 API 契约的前置模拟。

**启动（不要删 `mock/` 文件）：**

| 命令 | 是否加载 `mock/` |
| --- | --- |
| `pnpm dev:user` / `pnpm dev:admin`（默认） | 否（`MOCK=none`） |
| `pnpm dev:user:mock` / `pnpm dev:admin:mock` | 是 |
| `pnpm build:user` / `pnpm build:admin` | 否，产物不含 mock 中间件 |

`dev:mock` 时 `/api/v1` 仍代理 Nest，登录走真实鉴权；mock 只回答尚未迁 Nest 的路径（内容、工作区、AI、后台 CRUD）。

mock 需要做到：

- 页面能完整开发和验收。
- 数据结构贴近未来 NestJS API。
- 权限、菜单、分页、筛选、状态流都能模拟。
- 后续替换真实 API 时，优先改 service 层，不大改页面。

---

## 2. Mock 分层

建议分三层：

```txt
src/services/      ← 页面调用的服务函数
mock/              ← Umi mock 接口
mock/data/         ← 可复用 mock 数据源
```

调用链：

```txt
页面 / 组件
  → src/services/content.ts
  → /api/mock/content
  → mock/content.ts
  → mock/data/content.ts
```

---

## 3. 统一响应结构

所有 mock 接口都按统一结构返回：

```ts
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  requestId?: string;
}
```

成功：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

失败：

```json
{
  "code": 401,
  "message": "登录已过期",
  "data": null
}
```

---

## 4. 模块接口清单

### 4.1 认证与用户

| 方法 | 路径 | 用途 |
|---|---|---|
| `POST` | `/api/auth/login` | 登录 |
| `POST` | `/api/auth/logout` | 退出 |
| `GET` | `/api/auth/current-user` | 当前用户 |
| `GET` | `/api/auth/permissions` | 当前用户权限 |

首版 mock 支持切换：

- admin。
- editor。
- member。
- guest。

### 4.2 系统配置

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/api/system/config/public` | 公开配置 |
| `GET` | `/api/system/theme` | 主题配置 |

### 4.3 内容中心

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/api/contents` | 内容列表 |
| `GET` | `/api/contents/featured` | 首页精选内容 |
| `GET` | `/api/contents/:id` | 内容详情 |
| `GET` | `/api/contents/:id/chapters` | 小册章节列表 |
| `GET` | `/api/contents/:id/chapters/:chapterId` | 小册章节详情 |
| `POST` | `/api/contents/:id/favorite` | 收藏 |
| `DELETE` | `/api/contents/:id/favorite` | 取消收藏 |
| `POST` | `/api/reading/progress` | 保存阅读进度 |

### 4.4 工作区

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/api/workspace/stats` | 工作台统计 |
| `GET` | `/api/workspace/continue-reading` | 继续阅读 |
| `GET` | `/api/workspace/contents` | 我的文档 |
| `POST` | `/api/workspace/contents` | 新建文档 |
| `PUT` | `/api/workspace/contents/:id` | 更新文档 |
| `POST` | `/api/workspace/booklets/import` | 导入小册，后续真实上传使用 |
| `GET` | `/api/workspace/booklets/local` | 本地小册同步结果，React-first 阶段使用 |
| `GET` | `/api/workspace/favorites` | 我的收藏 |
| `GET` | `/api/workspace/usage` | 我的用量 |

### 4.5 后台管理

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/api/admin/users` | 用户列表 |
| `GET` | `/api/admin/roles` | 角色列表 |
| `GET` | `/api/admin/content/list` | 内容管理列表 |
| `GET` | `/api/admin/content/categories` | 分类列表 |
| `GET` | `/api/admin/content/tags` | 标签列表 |
| `GET` | `/api/admin/files` | 文件列表 |
| `GET` | `/api/admin/ai/providers` | AI 厂商 |
| `GET` | `/api/admin/ai/models` | AI 模型 |
| `GET` | `/api/admin/ai/stats` | AI 统计 |
| `GET` | `/api/admin/logs` | 操作日志 |

### 4.6 AI 工具

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/api/ai/tools` | 工具广场 |
| `GET` | `/api/ai/models` | 可用模型 |
| `GET` | `/api/ai/sessions` | 会话列表 |
| `GET` | `/api/ai/sessions/:id` | 会话详情 |
| `POST` | `/api/ai/chat` | 对话生成 |
| `POST` | `/api/ai/text` | 文本生成 |
| `POST` | `/api/ai/image` | 图片生成 |

阶段 5 已使用 `@ant-design/x` 封装和 mock 状态流完成 AI 工作台。真实 API 接入时保留 service 方法名，替换 mock 实现与流式传输层。

---

## 5. Mock 数据目录建议

```txt
mock/
├── auth.ts
├── system.ts
├── content.ts
├── workspace.ts
├── admin.ts
├── ai.ts
└── data/
    ├── users.ts
    ├── permissions.ts
    ├── menus.ts
    ├── contents.ts
    ├── chapters.ts
    ├── categories.ts
    ├── tags.ts
    ├── ai-sessions.ts
    ├── ai-models.ts
    ├── local-booklets.generated.ts
    ├── system-config.ts
    └── logs.ts
```

---

## 6. Mock 数据质量要求

mock 数据要覆盖真实开发中容易漏掉的状态：

- 空列表。
- 多页分页。
- 搜索无结果。
- 无权限。
- 未登录。
- 草稿 / 已发布 / 已归档。
- public / login / private 可见性。
- 内容类型：Markdown、小册、PDF、Word、富文本、外链、项目。
- AI 生成中、生成成功、生成失败等状态后续阶段补充，本阶段只保留接口契约占位。
- Token 不足。
- 用户禁用。
- 本地小册目录不存在。
- 本地小册 `meta.json` 错误。
- 本地小册没有章节。

---

## 6.1 本地小册 mock 生成

阶段 3 本地小册不通过浏览器直接读取文件夹，而是通过开发期 Node 脚本生成 mock 数据。

输入：

```txt
content-local/booklets/
```

输出：

```txt
apps/user-web/mock/data/local-booklets.generated.ts
```

服务：

```txt
src/services/booklet.ts
```

页面不关心数据来自静态 mock 还是本地同步结果，只调用 service。

同步命令：

```bash
pnpm --filter user-web sync:booklets
```

---

## 7. 从 mock 切真实 API 的策略

阶段一：

- 页面调用 `services`。
- `services` 请求 Umi mock。

阶段二：

- NestJS API 完成后，保持 `services` 方法名不变。
- 修改 request baseURL 或代理配置。
- mock 保留为开发兜底和离线演示。

阶段三：

- 稳定接口通过 OpenAPI / Swagger 生成类型或客户端。
- 与 `packages/shared-types` 对齐。

---

## 8. 不推荐的写法

- 在 React 组件中直接声明大段 mock 数组。
- 每个页面自己定义一套 `ApiResponse`。
- mock 字段名和未来数据库/API 字段完全不同。
- 权限只做菜单显隐，不模拟按钮禁用或接口拒绝。
- 阶段 5 实现 AI mock 时，不要只返回最终文本，需要模拟 loading、停止生成、失败状态。
