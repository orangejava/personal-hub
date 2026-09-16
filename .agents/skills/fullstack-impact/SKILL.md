---
name: fullstack-impact
description: >-
  Assesses frontend and backend impact before changing Nest APIs, Prisma,
  Canonical contracts, api-client, Umi request interceptors, services, or
  useRequest pages. Requires a file-level plan, global unwrap rule (pages
  receive business T, not mock envelopes), caller list, and product
  acceptance criteria. Use when adding or changing HTTP endpoints, schema,
  request adapters, services, or mock fallbacks.
compatibility: Works with Cursor, Claude Code, Codex, and other Agent Skills clients.
metadata:
  author: personal-hub
  version: "1.3"
---

# 前后端影响面评估（personal-hub）

防止「后端接了 Canonical，前端仍读信封 / 仍打已关闭的 mock」。

短约束：`.agents/rules/fullstack-impact.md`。  
契约：[canonical-api.md](../../../docs/backend/canonical-api.md)、[react-mock-migration.md](../../../docs/backend/react-mock-migration.md)（含 Umi 解包）、[nest-backend-requirements.md](../../../docs/prd/long-term/nest-backend-requirements.md) §4。

菜单展示名 / `localeKey` 等**产品字段约定**写在对应 PRD/实现文档，不在本 skill 展开。改映射时去读那些文档，并列入 §5 调用方。

---

## 0. 硬门槛（未满足不得改业务代码）

改代码前必须用中文贴出 **§4 完整计划**（文件路径、每文件改什么、验收通过/故意忽略、忽略项的后续阶段）。用户未确认前，只允许读代码与提问。

**禁止**：先改再补计划；只跑 `pnpm --filter server test` 就宣称完成。

---

## 1. 何时必须加载

触及任一则加载：

- Nest 模块、Controller、DTO、Guard、信封
- Prisma schema / seed / 迁移
- `packages/api-client`、`packages/shared-types`
- **Umi `request` / `requestErrorConfig` / responseInterceptor**
- `apps/*/src/services/**`、`getInitialState`、`useRequest` 页面、layout
- mock 路由、`MOCK=none` 回落、`skipErrorHandler`
- Canonical 路径替换 mock（`/api/...` → `/api/v1/...`）

纯样式、与 HTTP 无关的改动可跳过。

**前端单独改 service / 拦截器 / useRequest，即使不改 Nest，也必须加载。**

---

## 2. 请求层只承认一套：HTTP + 业务对象 T

权威：[canonical-api.md](../../../docs/backend/canonical-api.md) 文首、[react-mock-migration.md](../../../docs/backend/react-mock-migration.md)「请求解包」。

| 侧 | 成功 | 失败 |
| --- | --- | --- |
| Nest | HTTP 2xx，`{ data, requestId? }` | HTTP 4xx/5xx，`{ error, requestId }` |
| Umi `request` | **responseInterceptor 解包后返回 T** | throw；`errorHandler` 或页面 `error` |
| 页面 / `useRequest` / `getInitialState` | `data` **就是 T** | try/catch 或 `error`；**禁止** `res.code === 0` |

旧 mock 的 `{ code, success, message, data }` **不是**目标契约。拦截器对仍存在的 mock 成功体同样拆出 `data`，业务错误（`code !== 0` 或 HTTP 4xx/5xx）throw。

**必须全局做**：两端 `requestErrorConfig`（共享解包函数放 `packages/api-client`）。不要在单个 service 里 `toApiResponse` 再迁就旧页面。

**禁止**：

- 为迁就 `if (res?.code === 0)` 把 Nest 再包成 mock 信封
- GET 返回 T、写接口返回 `{ code: 0 }` 两套成功语义
- 以「内容 / 工作区 / AI 还在 mock」为由推迟解包收口——那些领域后续接 Nest，页面按 T 写，现在改掉 `code === 0` 即可
- 已有 Nest 的路径失败后再 `request` 已关闭的 mock（`MOCK=none` 下会 404 弹窗）

`toApiResponse` 只允许出现在尚未切到拦截器的遗留代码；新增或改到的调用链必须删掉。

### 2.1 失败 toast 与 `skipErrorHandler`

后续新接口**默认沿用全局 `errorHandler`**，不要为每个页面再写一套失败提示。

| 角色 | 做什么 |
| --- | --- |
| Nest | 特定失败文案写在 `DomainHttpException(status, 'CODE', '给人看的中文')`。成功 toast 仍由前端写。 |
| 两端 `requestErrorConfig` | HTTP 4xx/5xx 优先 `message.error(error.message)`（就地读 `response.data.error`，避开 MFSU）。401 跳登录。 |
| 写接口 service | **不要** `skipErrorHandler`；让全局 toast 弹出后端文案。页面 `catch` 后 `return false`，不要再 `message.error` 一遍。 |
| 仅这些才 skip | `getInitialState` / 启动拉取、登录冷却与验证码等要自己画 UI 的调用。skip 后用 `nestError` 分支。 |

**禁止**：为了特定 toast 再包 `{ code, message, data }`；禁止写接口 skip 完又不 catch，导致失败既无 toast 也无空态。

---

## 3. mock 与后续阶段

开发顺序：[nest-backend-requirements.md](../../../docs/prd/long-term/nest-backend-requirements.md) §4：脚手架 → Auth → System/Menu → **Content** → File/Booklet → AI → Admin 聚合。

| 情况 | 要求 |
| --- | --- |
| 该资源 **已有** Nest | 前端打 Nest；失败内存默认值或空态；禁止回落旧 mock |
| 该资源 **尚无** Nest | 路径仍 404/空态可以暂时存在，但调用方必须已按 T / throw 写，不能再依赖 `code`。计划写清后续领域阶段 |
| 全局 404 弹窗 | 已接 Nest 的模块视为缺陷 |

不要用「先别动 mock 页」来保留信封兼容层。

---

## 4. 改前必须贴出的计划模板

```markdown
### 影响面
- 契约变更：路径 / 方法 / 信封 / 字段（旧 → 新）
- 解包：是否走全局拦截器；页面是否仍检查 code
- 后端写入点：Controller、Service、seed
- 前端读取点（grep）：api-client、拦截器、两端 services、getInitialState、useRequest、layout、model
- mock：该路径 Nest 是否已存在；失败是否还会打旧 mock
- 明确不做 + **后续阶段**：§3 顺序 + 领域名

### 计划修改的文件
| 文件 | 改什么 |

### 验收
- 通过：产品路径（打开页 → 有数据 → 保存 → 刷新相关面）
- 故意忽略：现象 + 原因 + 后续阶段
```

**禁止**：只改 Nest + 写一个 service，却不打开实际用该数据的页面核对字段。

---

## 5. 后端改完后必须提醒的前端面

交付说明按 grep 列出「已改 / 未改及原因」：

1. 全局拦截器是否已解出 T（不要再包信封）
2. `packages/api-client` 映射
3. 两端 `services/`、`getInitialState`、`useRequest` 页、layout、model
4. 所有 `code === 0` 调用方
5. 失败是否回落 mock；写接口是否误加 `skipErrorHandler`；toast 是否会显示 Nest `error.message`

Grep 起点：新路径、旧 mock 路径、`toApiResponse`、`fetchXxx`、`code === 0`。

---

## 6. 验收未完成不得宣称功能完成

- `pnpm --filter server test` 只证明 Nest。
- 有浏览器时：走用户路径。
- 交付写清：**已验路径**、**故意忽略及后续阶段**、**用户可复现的 2～3 步**。
