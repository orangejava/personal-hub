# Nest M2 Auth 切片划分

> 状态：第 1–6 刀已落地；另补忘记密码与管理员踢人约束刀
> 最后更新：2026-08-22
> 契约：[Auth/RBAC PRD](../../prd/long-term/auth-rbac-session-prd.md)、[Canonical API](../../backend/canonical-api.md)

本文件只排 **M2 Auth HTTP** 的刀序，不替代 Canonical 契约。每刀做完后立刻接 React，并补对应 `auth-*-slice.md`。

## 登录验证码为什么曾经后置

**不是产品放弃。** PRD §6.1、Canonical API、`conventions.md` 和 `nest-dependency-catalog.md` 都要求：连续 3 次登录失败后，必须走自建 SVG/算术验证码（`svg-captcha`，答案只存 Redis 哈希）。

2026-08-13 开 M2 时，为了第 1 刀尽快和现有登录页联调，把当时还不挡「用已有账号登录」的能力标成「本刀不做」。现已作为第 4 刀落地。

## 切片一览

| 刀 | 内容 | 状态 |
| --- | --- | --- |
| 1 | 登录 / me / refresh / logout | ✅ [auth-login-slice.md](./auth-login-slice.md) |
| 2 | 权限快照与过滤菜单 | ✅ [auth-permissions-slice.md](./auth-permissions-slice.md) |
| 3 | 注册、邮件链接验证、验证赠额 | ✅ [auth-register-slice.md](./auth-register-slice.md) |
| 4 | 登录 SVG/算术验证码 | ✅ [auth-captcha-slice.md](./auth-captcha-slice.md) |
| 5 | 设备会话 API + 工作区登录设备页 | ✅ [auth-sessions-slice.md](./auth-sessions-slice.md) |
| 6 | 临时密码首次强制改密 | ✅ [auth-change-password-slice.md](./auth-change-password-slice.md) |
| 7 | 忘记密码 / 邮件链接重置 | ✅ [auth-forgot-password-slice.md](./auth-forgot-password-slice.md) |
| 8 | 后台只读用户 + 踢全部设备 | ✅ [auth-admin-sessions-slice.md](./auth-admin-sessions-slice.md) |

## M2 Auth HTTP 仍不做

- 改邮箱
- TOTP / MFA
- 真实 SMTP（本地继续 Mailpit）
- 后台禁用用户 / 改角色 / 额度调整
- 管理员踢单设备（本次只做踢全部）
- OAuth、Flutter
