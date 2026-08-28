# Next API Bridge 过渡方案 PRD

> 状态：⏭️ 已跳过。Nest 阶段 0 + M1 已落地，不再建设 `apps/next-api`，直接走 `apps/server`。
> 最后更新：2026-08-13
> 目标：说明在 NestJS 未启动前，是否可以先用 Next.js 做一层临时后端，以及如何避免和后续 Next 前台站点混淆。

---

## 1. 结论

**当前决策（2026-08-13）**：本方案评估保留作历史参考，**不再实施**。Nest 已有 `apps/server`，直接进入 Auth HTTP 与 React 联调。

可以先用 Next.js 做临时后端，但建议定位为 **API Bridge（过渡 API 层）**，不要把它设计成最终业务后端。

推荐命名：

```txt
apps/
├── react-web/       # 当前 React-first 前端
├── next-api/        # 可选：临时 API Bridge，使用 Next Route Handlers
├── next-web/        # 后续 SEO 公开前台，使用 Next App Router
└── api/             # 最终 NestJS 后端
```

如果只建一个 Next 项目同时做前台和 API，后续会增加迁移成本。因此若要先用 Next 做后端，建议单独建 `apps/next-api`，明确它是过渡层。

---

## 2. Next API 与 NestJS 的区别

| 维度             | Next API Bridge                  | NestJS API                         |
| ---------------- | -------------------------------- | ---------------------------------- |
| 定位             | 前端同栈的轻量接口层             | 长期业务后端                       |
| 开发速度         | 快，适合快速接数据库和第三方 API | 稍重，但结构更稳定                 |
| 路由             | 文件路由 `app/api/**/route.ts`   | Controller / Module / Service      |
| 架构约束         | 容易写散，需要人为约束           | 模块化、依赖注入、Guard、Pipe 完整 |
| 权限             | 需要自行封装中间件和 helper      | Guard / Decorator / RBAC 更自然    |
| Swagger          | 需要额外工具或手写               | `@nestjs/swagger` 成熟             |
| SSE / AI 代理    | 能做，但复杂场景要谨慎           | 更适合长期 AI 代理、日志、限流     |
| 定时任务         | 不适合复杂任务                   | `@nestjs/schedule`                 |
| 后续 Flutter API | 可以用，但长期契约治理弱         | 更适合作为多端统一 API             |

---

## 3. 适合先用 Next API 的场景

- 先接 PostgreSQL/Prisma 做真实内容 CRUD。
- 先做登录、内容、后台配置的最小后端。
- 先代理 AI 请求，隐藏 API Key。
- 学习成本想从 Next 全栈逐步过渡到 NestJS。

不建议用 Next API 长期承载：

- 完整 RBAC 权限体系。
- 复杂后台审计日志。
- 长期 AI 计费、用量统计、限流、队列。
- Flutter 多端长期 API。
- 大文件处理、异步任务、批量导入。

---

## 4. 与后续 Next 前台的区分

必须遵守以下命名和边界：

1. `apps/next-api`：只放 API，不放公开页面。
2. `apps/next-web`：只放 SEO 前台页面，不直接写业务 API。
3. `apps/react-web`：继续作为后台、工作区、React-first 前端。
4. `packages/shared-types`：所有请求/响应类型先放这里，不让 Next API 私自定义一套。
5. API 路径仍保持 `/api/v1/**`，与 Canonical API 对齐。
6. service 方法名保持稳定，未来从 Next API 切 NestJS 时前端改 `baseURL` 为主。

---

## 5. 迁移到 NestJS 的前置约束

如果实施 `apps/next-api`，必须从第一天开始按 NestJS 迁移来写：

- 业务逻辑不要写在 route handler 里，抽到 `modules/*/service.ts`。
- DTO / 响应类型使用 `packages/shared-types`。
- 数据模型按 `docs/backend/canonical-data-model.md` 维护。
- 权限判断集中在 `auth/requirePermission.ts`，不要散落页面。
- 错误响应遵循 Canonical API 的 HTTP 状态码与 `{ data, requestId }` / `{ error, requestId }` 响应格式。
- AI Provider 调用封装到独立 adapter，后续可搬到 Nest Service。

建议结构：

```txt
apps/next-api/src/
├── app/api/
│   ├── auth/login/route.ts
│   ├── contents/route.ts
│   └── ai/chat/route.ts
├── modules/
│   ├── auth/
│   ├── content/
│   ├── ai/
│   └── system/
├── lib/
│   ├── prisma.ts
│   ├── response.ts
│   └── auth.ts
└── adapters/
    └── ai-providers/
```

---

## 6. 推荐实施顺序

如果决定启用 Next API Bridge：

1. 先建 `apps/next-api` 工程骨架。
2. 接 Prisma + PostgreSQL。
3. 实现认证和当前用户。
4. 实现内容列表/详情/工作区内容 CRUD。
5. 实现后台系统配置、菜单、日志。
6. 实现 AI 代理最小链路。
7. 当 API 稳定后，再迁移到 `apps/server` NestJS。

---

## 7. 对当前路线图的影响

原路线：

```txt
阶段 5：AI 工具平台
阶段 6：接入 NestJS API
阶段 7：抽离 Next.js 公开页面
```

如果采用 Next API Bridge，可调整为：

```txt
阶段 5：AI 工具前端 + mock
阶段 5.5：Next API Bridge（可选）
阶段 6：NestJS API 或从 Next API 迁移 NestJS
阶段 7：Next.js 公开页面
```

注意：`apps/next-api` 不替代 `apps/next-web`，两者目标不同。

---

## 8. 需要用户确认

- 是否接受多一个临时应用 `apps/next-api`。
- 是否希望先学 Next 全栈，再迁移 NestJS。
- 是否愿意承担一次 Next API → NestJS 的迁移成本。
- 当前是否已经准备本地 PostgreSQL / Prisma。
