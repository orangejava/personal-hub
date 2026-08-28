# Nest M2 第 6 刀：临时密码首次强制改密

> 状态：✅ 已落地
> 最后更新：2026-08-22
> 依据：[切片划分](./README.md)、[Canonical API](../../backend/canonical-api.md)

## 目标与边界

`bootstrap:super-admin` 写入 `mustChangePassword: true`。登录后进入工作区/后台前必须改密。日常 `seed:local-users` 仍为 `false`。

已实现：

- `POST /api/v1/auth/change-password`：当前密码 + 新密码
- 成功后清 `mustChangePassword`、递增 `authVersion`、撤销全部会话、清 Refresh Cookie
- JWT Guard：该标记为 true 时，除 `/auth/me`、`/auth/permissions`、`/auth/change-password` 外返回 `403 AUTH_PASSWORD_CHANGE_REQUIRED`。登出为 Cookie/Bearer 会话接口，不走该 Guard。
- React：`/user/change-password`。拦截不只依赖 ProLayout `onPageChange`：`getInitialState` 与 `/ai` 的 `AiLayout` 也会跳改密页（`/ai` 为 `layout: false`）

明确不做：忘记密码邮件重置、改邮箱。

## 关键文件

- `apps/server/src/modules/auth/dto/change-password.dto.ts`
- `apps/server/src/modules/auth/jwt-auth.guard.ts`
- `apps/react-web/src/pages/user/change-password/index.tsx`
- `apps/react-web/src/app.tsx`：`getInitialState` + `onPageChange` 拦截
- `apps/react-web/src/layouts/AiLayout/index.tsx`：`layout: false` 下的改密拦截
