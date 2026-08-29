# React Mock 到 Canonical Nest API 对照

> 状态：🟢 已确认；React 对接真实 API 时的迁移清单
> 最后更新：2026-08-02
> 原则：以现有 `apps/user-web/src/services` 盘点为功能事实，以 [canonical-api.md](./canonical-api.md) 为未来契约事实。Mock 路径不长期保留别名。

---

## 1. 迁移原则

- 当前 Mock 用于 React-first 开发，不应限制 Nest 的安全与数据模型。
- React 对接时在 service 层集中改造，不在页面内拼 URL 或伪造状态。
- 先接 Auth 和基础公开读取，再逐领域替换；Mock 可保留为本地演示兜底，但不与真实 API 混用同一状态源。
- `packages/shared-types` 中的旧 `ApiResponse { code, message, data }` 和 mock DTO 不作为新 HTTP 类型来源；新类型由 OpenAPI 生成。

## 2. Auth

| 当前 Mock                                               | Canonical Nest                                                          | React 改造                                                 |
| ------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- |
| `POST /api/auth/login` 返回 `token` 并写 `localStorage` | `POST /api/v1/auth/login` 返回 Access Token，Refresh 写 HttpOnly Cookie | Access 仅放内存；请求设置 Bearer 与 `credentials: include` |
| `GET /api/auth/current-user`                            | `GET /api/v1/auth/me`                                                   | 启动时拉取当前用户                                         |
| `GET /api/auth/permissions`                             | 同路径 `/api/v1/auth/permissions`                                       | 读取动作权限、范围和菜单                                   |
| 401 直接跳登录                                          | 401 单飞 `/auth/refresh` 后重试一次                                     | 刷新失败才清状态并跳转                                     |
| mock 单角色                                             | 首版单角色 `role`                                                       | member 可进入个人 `/app`，写内容由权限控制                 |

## 3. Public 与 App 内容

| 当前 Service/Mock                        | Canonical Nest                                              |
| ---------------------------------------- | ----------------------------------------------------------- |
| `GET /api/contents`                      | `GET /api/v1/public/contents`，使用 `categorySlug/tagSlugs` |
| `GET /api/contents/:id`                  | `GET /api/v1/public/contents/:contentId`                    |
| `GET /api/contents/:id/chapters*`        | `GET /api/v1/public/contents/:contentId/chapters*`          |
| `GET /api/contents/meta`                 | `GET /api/v1/public/contents/meta`                          |
| `POST/DELETE /api/contents/:id/favorite` | `PUT/DELETE /api/v1/app/favorites/:contentId`               |
| `POST /api/reading/progress`             | `PUT /api/v1/app/reading-records/:contentId`                |
| `/api/workspace/stats`                   | `GET /api/v1/app/dashboard`                                 |
| `/api/workspace/contents*`               | `/api/v1/app/contents*`                                     |
| `/api/workspace/favorites`               | `GET /api/v1/app/favorites`                                 |
| `/api/workspace/continue-reading`        | `GET /api/v1/app/reading-records/recent`                    |

页面适配重点：

- 公开列表必须接受服务端的 published/visibility 过滤，不再由 Mock 返回草稿或私有内容。
- `LOGIN` 内容显示锁定卡片；私有、草稿、归档公开访问的 404 不应作为页面异常泄露。
- 编辑页需改为读取 `GET /app/contents/:id`，禁止继续用硬编码编辑内容。
- PATCH 按“缺失不修改、null 清空”处理；发布/归档使用明确动作端点，不传 `{ status }` 伪更新。

## 4. 文件与小册

| 当前状态           | Canonical Nest                                         |
| ------------------ | ------------------------------------------------------ |
| 无正式上传 service | `/app/uploads` 创建预签名单 PUT/Multipart 会话         |
| 本地脚本同步小册   | 现有存量继续 CLI；用户 ZIP 使用 `/app/booklet-imports` |
| 章节 mock 本地读取 | public 章节索引/单章 API，正文按需读 COS/MinIO         |
| 固定 URL/本地资源  | FileAsset + 签名 URL，Bucket 默认私有                  |

## 5. AI

| 当前 Mock                        | Canonical Nest                              |
| -------------------------------- | ------------------------------------------- |
| `useAiChatMock` 浏览器模拟流式   | `POST /app/ai/sessions/:id/messages` 真 SSE |
| 流结束后 `persistAiChatMessages` | 服务端创建/流式写消息，前端不再二次持久化   |
| 前端 `consumeAiQuota`            | 服务端预占、实际结算；前端只读取用量        |
| 同步 `generateAiImage`           | `202 /app/ai/image-generations` 后轮询任务  |
| `/workspace/ai/history`          | `/app/ai/sessions` 作为同一会话资源         |
| AI 资产 mock store               | `/app/ai/assets`、`/app/ai/asset-folders`   |
| 视频纯前端 mock                  | Nest `MockVideoProvider` 任务接口           |

## 6. Admin

| 当前 Mock                         | Canonical Nest                                                   |
| --------------------------------- | ---------------------------------------------------------------- |
| `PUT /admin/users/:id/role`       | 保留单角色语义，统一 `/admin/users/:id/role`                     |
| 管理端按 `role === admin`         | API 使用权限 Guard；前端仅做体验性显示                           |
| `PUT /admin/menus` 全树覆盖       | 菜单 UUID 单项 POST/PATCH/DELETE + `/sort`                       |
| `/admin/system/config` 等多套路径 | `/admin/system-configs`，按 group 原子更新                       |
| `/admin/homepage` 独立配置        | `system_configs` 的 `site.homepage`                              |
| `/admin/ai/config` 聚合读写       | 聚合只读；写入拆为 provider/model/tool/template/entitlement 资源 |
| `POST /admin/files/batch-delete`  | `DELETE /admin/files`，响应逐项结果                              |

## 7. 迁移验收

1. React 请求层能通过 HTTP 401 刷新 Cookie 会话且不会把 Refresh Token 写入 localStorage。
2. 收藏、阅读进度、AI 消息、额度均由后端持久化，不再依赖 mock 内存 store。
3. 所有写请求在需要时携带稳定的 `Idempotency-Key`，同一用户操作重试复用该 key。
4. 管理页面不再假设 Mock 的 `200 + code`、整树菜单 PUT、AI 前端手动扣费等语义。
