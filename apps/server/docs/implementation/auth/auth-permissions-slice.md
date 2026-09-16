# Nest M2 第 2 刀：权限快照与过滤菜单

> 状态：✅ 已落地
> 最后更新：2026-08-13
> 依据：[Auth/RBAC PRD](../../../../docs/prd/long-term/auth-rbac-session-prd.md)、[Canonical API](../../../../docs/backend/canonical-api.md)、[系统配置与菜单 PRD](../../../../docs/prd/long-term/system-config-menu-prd.md)

## 目标与边界

登录后不再用 mock 角色表冒充权限。`GET /api/v1/auth/permissions` 返回当前角色的动作权限、`OWN`/`ALL` 数据范围，以及按权限过滤后的菜单树；React 用 `routeKey` 解析成现有 ProLayout 菜单。

已实现：

- `GET /api/v1/auth/permissions`（需 Access Token）
- Redis 快照 `auth:permission:{userId}:{pv}`，TTL 60 秒
- seed 菜单覆盖公开前台、工作区、后台现有导航
- React `fetchPermissions` 默认走 Nest；`UMI_APP_NEST_AUTH=0` 仍用 mock

明确不做：

- 后台菜单管理写接口
- 权限 Guard（业务 API 仍是 mock）
- 注册邮件、验证码、TOTP

## 调用链

```text
React getInitialState / 登录成功
  → GET /api/v1/auth/permissions
  → 读角色 role_permissions + 可见 menus
  → 多权限菜单 OR；无关联权限的菜单对已登录用户可见
  → 丢掉过滤后没有子项的目录
  → React routeRegistry 把 routeKey 映射为 path / locale / icon
  → 派生 workspace:access、content:write 等 mock 兼容码，供 access.ts 使用
```

## 角色可见性要点

| 角色 | 动作权限 | 菜单 |
| --- | --- | --- |
| MEMBER | 空 | 公开导航 + 个人工作台（概览/收藏/用量/设置/AI 历史）；无内容创作、无后台 |
| EDITOR | 内容类 `OWN` | 工作区内容创作；后台项使用 EDITOR 没有的权限码（如 `content:featured`）隐藏 |
| ADMIN / SUPER_ADMIN | 目录授权，`ALL` | 工作区 + 后台。`content:purge` 仅 SUPER_ADMIN |

## 关键文件

- `apps/server/prisma/seed.ts`：系统菜单与权限关联
- `apps/server/src/modules/auth/permission-snapshot.ts`：过滤与建树
- `apps/server/src/modules/auth/auth.service.ts`：快照与 Redis
- `apps/user-web/src/auth/routeRegistry.ts`：routeKey → 路径
- `apps/user-web/src/auth/mapNestPermissions.ts`：Nest → React access 兼容

## 验证

1. `pnpm --filter server prisma:seed` 写入扩展菜单。
2. `pnpm --filter server test`，覆盖 SUPER_ADMIN / EDITOR / MEMBER 的权限与菜单差异。
3. `http://localhost:8000/user/login` 分别用 `owner@example.com`、`editor@example.com`、`member@example.com`（密码 `HubDev!234`）：
   - owner 能进 `/admin/users` 与 `/workspace/content`
   - editor 能进工作区内容，侧栏无用户管理
   - member 能进工作台/个人设置，看不到文档管理与后台
