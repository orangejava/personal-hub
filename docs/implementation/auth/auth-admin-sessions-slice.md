# Nest M2 第 8 刀：后台只读用户与踢全部设备

> 状态：✅ 已落地
> 最后更新：2026-08-22
> 依据：[切片划分](./README.md)、[Canonical API](../../backend/canonical-api.md) §5.1、[治理 PRD](../../prd/long-term/admin-governance-audit-prd.md)

## 目标与边界

管理员要能看到真实 Nest 用户并踢全部设备。不做完整用户治理（禁用/改角色/额度），避免和 mock 后台用户表混用。

已实现：

- `GET /api/v1/admin/users`（`user:read`）
- `GET /api/v1/admin/users/:userId/sessions`（`user:session:read`）
- `POST /api/v1/admin/users/:userId/sessions/revoke-all`（`user:session:revoke`）
- `PermissionsGuard` + `@RequirePermission`
- `admin` 不能踢 `admin` / `super_admin`；任何人不能通过后台踢自己
- 踢全部会递增 `authVersion` 并清会话 Redis
- React `/admin/users` 改为 Nest 列表 + 查看会话 + 踢全部

明确不做：禁用/启用、改角色、踢单设备、额度、审计页。

## 关键文件

- `apps/server/src/modules/admin/admin-users.controller.ts`
- `apps/server/src/modules/auth/permissions.guard.ts`
- `apps/react-web/src/pages/admin/Users/index.tsx`
