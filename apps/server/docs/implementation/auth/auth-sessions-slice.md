# Nest M2 第 5 刀：设备会话与工作区登录设备页

> 状态：✅ 已落地
> 最后更新：2026-08-21
> 依据：[切片划分](./README.md)、[Canonical API](../../../../docs/backend/canonical-api.md)

## 目标与边界

让用户看见本账号活跃会话，并能踢掉其它设备。MEMBER 上限 5 在第 1 刀已生效，本刀补可见列表与主动撤销。

已实现：

- `GET /api/v1/auth/sessions`
- `DELETE /api/v1/auth/sessions/:sessionId`（不能踢当前会话）
- `POST /api/v1/auth/sessions/revoke-all`（默认 `keepCurrent: true`）
- 工作区页 `/workspace/sessions`，菜单 `workspace.sessions`

列表不返回 Token、完整 UA、精确 IP；展示设备名、浏览器、脱敏 IP、`isCurrent`。

明确不做：管理员踢指定用户全部设备。

## 关键文件

- `apps/server/src/modules/auth/session-display.ts`
- `apps/server/prisma/schema.prisma`：`auth_sessions.ip_masked`
- `apps/user-web/src/pages/workspace/Sessions/index.tsx`
- `apps/server/prisma/seed.ts`：`workspace.sessions`
