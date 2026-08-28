# Nest M2 第 7 刀：忘记密码与邮件链接重置

> 状态：✅ 已落地
> 最后更新：2026-08-22
> 依据：[切片划分](./README.md)、[Canonical API](../../backend/canonical-api.md)

## 目标与边界

已激活用户丢了密码时，用邮件链接重置，而不是 6 位 OTP。发信仍走本地 Mailpit。

已实现：

- `POST /api/v1/auth/forgot-password`：始终 `202`，避免枚举；仅 `ACTIVE` 发信
- `POST /api/v1/auth/reset-password`：消费 30 分钟一次性 Token
- 成功后改密、清 `mustChangePassword`、递增 `authVersion`、撤销全部会话
- 限流：邮箱+IP 3 次 / 15 分钟，IP 10 次 / 15 分钟
- React：`/user/forgot-password`、`/user/reset-password`，登录页入口

明确不做：真实 SMTP、改邮箱、TOTP。

## 关键文件

- `apps/server/src/modules/auth/auth.service.ts`
- `apps/server/src/infrastructure/mail/mail.service.ts`
- `apps/react-web/src/pages/user/forgot-password/index.tsx`
- `apps/react-web/src/pages/user/reset-password/index.tsx`
