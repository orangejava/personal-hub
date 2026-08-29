# 系统配置与菜单管理后端需求确认稿

> 状态：🟢 已确认；最终端点与模型以 Canonical API/数据模型为准
> 最后更新：2026-08-02
> 适用：`apps/server`、`apps/user-web` 与未来前端应用
> 关联：[Auth、会话与 RBAC 后端需求确认稿](./auth-rbac-session-prd.md)、[公开前台](../../product/frontend-public.md)、[后台管理台](../../product/admin.md)

---

## 1. 目标与边界

本模块管理站点可运营配置与导航菜单，目标是让管理员在不重新构建前端的前提下修改站点品牌、公开首页展示和导航结构。

本期支持：

- 站点名称、描述、Logo、主题、首页 Hero、首页区块等公开配置。
- 公开前台、工作区、后台、AI 工作台四个区域的菜单树。
- 目录、内部菜单、外部链接三种菜单类型。
- 树形菜单新增、编辑、禁用、删除、排序和权限可见性配置。
- 配置保存后立即生效、清除缓存、记录审计日志。

本期不支持：

- 仅通过后台菜单创建新的 React/Next 页面或 Nest 接口。
- 自定义 CMS 页面编辑器与页面模板市场。
- 菜单直接授予用户接口权限。
- 配置草稿、发布审批、版本回滚；后续有运营协作需求时再独立设计。

---

## 2. 配置分层原则

| 类型           | 例子                                                               | 存储与修改方式                              |
| -------------- | ------------------------------------------------------------------ | ------------------------------------------- |
| 公开运营配置   | 站点名、Hero、首页区块、主题色、导航展示                           | PostgreSQL `system_configs`，后台管理员修改 |
| 导航配置       | 菜单树、排序、图标、可见性、外链                                   | PostgreSQL `menus` / 关联表，后台管理员修改 |
| 安全与运行配置 | JWT 密钥、数据库地址、Redis 地址、SMTP 密码、AI 明文 Key、限流阈值 | `.env` / 密钥管理 / Nginx，禁止进入后台配置 |
| 构建时路由     | React/Umi/Next 路由、页面组件、接口地址                            | 代码仓库，发布时变更                        |

动态配置不等于所有配置都动态化。特别是密钥、网络地址、安全阈值不能通过普通后台页面读写。

---

## 3. 公开系统配置

### 3.1 配置项

首版公开配置结构：

```json
{
  "siteName": "Personal Hub",
  "siteDescription": "个人知识中台 + AI 工具箱",
  "logoFileId": "file_id_or_null",
  "theme": {
    "colorPrimary": "#1677ff",
    "colorSuccess": "#52c41a",
    "colorWarning": "#faad14",
    "colorError": "#ff4d4f",
    "borderRadius": 6,
    "fontFamily": "system",
    "mode": "auto"
  },
  "homepage": {
    "hero": {
      "title": "…",
      "subtitle": "…",
      "primaryAction": { "label": "浏览内容", "target": "/content" },
      "secondaryAction": { "label": "关于我", "target": "/about" }
    },
    "modules": [{ "key": "featured-content", "visible": true, "sort": 10 }]
  },
  "aiEnabled": true
}
```

数据库采用通用 `system_configs` 表；每个 Key 关联受代码管理的类型化配置注册表，表内保存所属 group、JSONB value、公开标记、版本和最近修改人。对前端公开的值由专用服务组装，不能把整张配置表直接暴露给匿名请求。

### 3.2 读取、写入与缓存

| 方法 | 路径                                  | 权限                               | 说明                                 |
| ---- | ------------------------------------- | ---------------------------------- | ------------------------------------ |
| GET  | `/api/v1/public/site-config`          | 公开                               | 返回经过白名单筛选和组装后的公开配置 |
| GET  | `/api/v1/admin/system-configs`        | `system:config:manage`             | 按 group 读取可编辑配置与元数据      |
| PUT  | `/api/v1/admin/system-configs/:group` | `system:config:manage`，必填幂等键 | 原子更新一个配置组                   |

保存规则：

1. DTO 校验值类型、颜色、URL、长度和允许的枚举值。
2. 同一配置组在一个数据库事务中更新，避免前端读到半套主题或首页配置。
3. 更新成功后删除 Redis `cache:system:public-config` 等相关缓存。
4. 写入 `audit_logs`，记录修改前后摘要；敏感配置永不记录明文。
5. 下一次公开请求读取新配置；当前已打开页面无需推送刷新，首版不做 WebSocket 热更新。

---

## 4. 菜单与路由注册表

### 4.1 核心原则

菜单是导航数据，不是页面定义，也不是接口权限来源。

前端维护一份构建时路由注册表，例如：

```text
public.content       -> /content
workspace.contents   -> /workspace/content
admin.users          -> /admin/users
ai.chat              -> /ai/chat
```

新增内部菜单时，管理员只能从该注册表选择 `routeKey`。后端保存 `routeKey`，前端根据当前应用版本解析实际路径。这样可以避免后台配置失效路径，也便于未来从 Umi 迁移到 Next 时只更新前端注册表映射。

### 4.2 菜单类型

| 类型        | 必填字段      | 行为                              |
| ----------- | ------------- | --------------------------------- |
| `directory` | 名称、区域    | 仅作分组，可有子菜单，不要求跳转  |
| `internal`  | `routeKey`    | 跳转前端已注册内部路由            |
| `external`  | `externalUrl` | 跳转 HTTPS 外链；可设置新标签打开 |

外链仅接受 `https:`，开发环境可允许 `http://localhost`；禁止 `javascript:`、`data:` 及未校验协议。内部菜单不得保存任意手填 path。

### 4.3 数据模型

`menus` 建议字段：

| 字段                      | 说明                                    |
| ------------------------- | --------------------------------------- |
| `id`                      | 主键                                    |
| `scope`                   | `PUBLIC` / `WORKSPACE` / `ADMIN` / `AI` |
| `type`                    | `DIRECTORY` / `INTERNAL` / `EXTERNAL`   |
| `name`                    | 默认展示名                              |
| `localeKey`               | 可选国际化 key                          |
| `icon`                    | 受白名单校验的图标 key                  |
| `parentId`                | 同 scope 内父节点，可为空               |
| `routeKey`                | 内部菜单目标；仅 `internal` 使用        |
| `externalUrl`             | 外链目标；仅 `external` 使用            |
| `openInNewTab`            | 外链默认 true                           |
| `sort`                    | 同级排序号                              |
| `visible`                 | 是否显示                                |
| `enabled`                 | 是否可点击/可用                         |
| `isSystem`                | 核心内置菜单保护标记                    |
| `remark`                  | 管理备注                                |
| `createdAt` / `updatedAt` | 审计时间                                |

`menu_permissions`：

- 一个菜单可关联 0..n 个既有权限码。
- 无关联表示公开可见，或在 scope 的基础登录规则允许时可见。
- 有多个关联权限时，用户拥有任一权限即可看见菜单。
- 菜单权限只影响菜单返回结果，不替代 API 的 Controller Guard。

### 4.4 约束与防锁死规则

- 父菜单必须存在、同 scope、类型为 `directory`。
- 禁止循环父子关系；删除有子菜单的目录必须先迁移或删除子菜单。
- `routeKey` 必须在当前前端路由注册表中；首版由各前端构建产物生成版本化的受控 route registry 清单，并通过受保护的部署同步步骤写入 Nest 配置。后台只能读取该清单，不能新增任意 routeKey；清单版本不匹配时拒绝内部菜单写入并返回 `MENU_ROUTE_KEY_UNAVAILABLE`。
- 禁止删除或禁用当前后台的“菜单管理”“角色权限”“系统配置”等恢复入口，除非另一个具备等价权限的系统入口仍可用。
- 不能通过菜单编辑创建、修改或授予 Permission；权限由角色权限管理模块维护。
- 禁用父目录时，其子菜单不返回给前端；保留数据方便恢复。
- 菜单删除、批量排序、权限关联改变均写入审计日志。

---

## 5. 菜单 API 草案

| 方法   | 路径                               | 权限          | 说明                                 |
| ------ | ---------------------------------- | ------------- | ------------------------------------ |
| GET    | `/api/v1/public/navigation`        | 公开          | 返回匿名可见的 public/ai 菜单        |
| GET    | `/api/v1/auth/permissions`         | 登录          | 返回有效权限与按权限过滤后的登录菜单 |
| GET    | `/api/v1/admin/menus`              | `menu:manage` | 获取完整菜单树及管理字段             |
| POST   | `/api/v1/admin/menus`              | `menu:manage` | 新增目录、内部菜单或外链             |
| PATCH  | `/api/v1/admin/menus/:menuId`      | `menu:manage` | 更新显示字段、目标、状态和权限关联   |
| PATCH  | `/api/v1/admin/menus/sort`         | `menu:manage` | 同 scope、同父节点下批量排序         |
| DELETE | `/api/v1/admin/menus/:menuId`      | `menu:manage` | 删除无子项且非核心菜单               |
| GET    | `/api/v1/admin/menu-route-options` | `menu:manage` | 获取当前可选内部路由注册表           |

菜单修改后删除 `cache:navigation:{userId}:{permissionVersion}`。用户下一次拉取菜单时获得新树；权限变化还要由 Auth 模块同步提高 `permissionVersion`。

---

## 6. 后端与前端职责

| 事项     | 后端职责                               | 前端职责                           |
| -------- | -------------------------------------- | ---------------------------------- |
| 配置读取 | 白名单组装、缓存、默认值               | 启动时拉取、应用主题与首页展示     |
| 配置修改 | 权限、DTO、事务、审计、缓存失效        | 表单校验提示、保存反馈             |
| 菜单返回 | 根据 scope、enabled、visible、权限过滤 | 按区域渲染菜单                     |
| 内部目标 | 校验 `routeKey` 合法                   | 用注册表映射 `routeKey` 到当前路由 |
| API 安全 | Guard 与数据范围校验                   | 不可依赖菜单隐藏作为安全措施       |

---

## 7. 验收与进入编码条件

- 管理员修改公开主题/首页配置后，新匿名请求可获得最新值，且不暴露内部或敏感配置。
- 管理员可新增目录、内部菜单和 HTTPS 外链；内部菜单只能选择注册路由。
- 多权限菜单在当前用户拥有任一权限时显示；移除权限后下一次菜单读取不再显示。
- curl 直接调用受保护 API 时，即使手动构造菜单配置也不能越过权限 Guard。
- 核心管理菜单不能被删除或配置到无法恢复后台的状态。
- 所有配置和菜单写操作有审计日志，并能从 Redis 缓存失效后读取最新数据。

## 8. 模块实施前契约清单

- OpenAPI/DTO：类型化配置组、菜单树、排序批量请求、route option 与公开过滤后的响应必须定稿。
- 枚举与错误：`menus.scope` 使用 `PUBLIC/WORKSPACE/ADMIN/AI`，菜单类型使用 `DIRECTORY/INTERNAL/EXTERNAL`；覆盖 `MENU_ROUTE_KEY_UNAVAILABLE`、循环、核心菜单保护等错误码。
- 权限与审计：全部后台写接口使用 `menu:manage` 或 `system:config:manage` + `ALL`，带幂等要求的写操作列入 HTTP E2E。
- 运行协作：route registry 由前端发布流程同步，Nest 不扫描前端文件系统；同步失败、缓存失效和恢复入口防锁死均有集成测试。

后续与 Auth/RBAC 联动时，需要将 `menu:manage`、`system:config:manage` 等最终权限码加入角色 seed 与权限管理 UI。
