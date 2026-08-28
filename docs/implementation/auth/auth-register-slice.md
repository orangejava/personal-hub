# Nest M2 第 3 刀：注册、邮件验证与验证赠额

> 状态：✅ 已落地
> 最后更新：2026-08-14
> 依据：[Auth/RBAC PRD](../../prd/long-term/auth-rbac-session-prd.md)、[Canonical API](../../backend/canonical-api.md)

## 目标与边界

公开注册不再缺页。用户提交邮箱和密码后得到 `PENDING_VERIFICATION` MEMBER，邮件里是 24 小时一次性链接；点开后激活账号，并在同一事务写入 10000 验证赠额。本地发信只进 Mailpit。

已实现：

- `POST /api/v1/auth/register` → `202 { accepted: true }`，不签发 Token
- `POST /api/v1/auth/verify-email` → 消费链接 Token，首次 GRANT
- `POST /api/v1/auth/resend-verification` → 统一 `202`，避免枚举
- React `/user/register`、`/user/verify-email`；登录页可跳转注册，未验证可重发
- 测试覆盖弱密码、未验证登录、赠额幂等、重复邮箱

明确不做（本刀）：

- 真实 SMTP 厂商、忘记密码、TOTP、改邮箱
- 登录 SVG 验证码已改到第 4 刀，见 [README.md](./README.md)

## 调用链

```text
React 注册页
  → POST /api/v1/auth/register
  → 创建 PENDING MEMBER + 哈希后的 EmailVerificationToken
  → nodemailer → Mailpit :1025
  → 用户打开 CORS_ORIGIN/user/verify-email?token=...
  → POST /api/v1/auth/verify-email
  → 同一事务：消费 Token、ACTIVE、upsert 额度账户、GRANT（idempotencyKey=email-verify-grant:{userId}）
  → 之后可走第 1 刀登录
```

## 防枚举与限流

| 场景 | 行为 |
| --- | --- |
| 新邮箱 | 创建 PENDING 并发信 |
| 已有 PENDING | 作废旧 Token，发新链接 |
| 已有 ACTIVE/DISABLED/未知 | 仍 202，不发信 |
| 注册 | 同一邮箱+IP 5 次 / IP 20 次 / 15 分钟 |
| 重发 | 同一邮箱+IP 3 次 / 15 分钟 |

Token 只存 SHA-256 + `JWT_REFRESH_SECRET` pepper，与 Refresh Token 相同策略。

## 关键文件

- `apps/server/src/infrastructure/mail/mail.service.ts`：Mailpit SMTP
- `apps/server/src/modules/auth/auth.service.ts`：注册 / 验证 / 重发 / 赠额
- `apps/react-web/src/pages/user/register/index.tsx`
- `apps/react-web/src/pages/user/verify-email/index.tsx`

## 验证

1. `pnpm --filter server test`
2. Compose 已启动 Mailpit 时：`http://localhost:8000/user/register` 注册新邮箱
3. 打开 `http://localhost:8025` 点验证链接，再回登录页登录
4. 用未验证账号登录应看到 `请先完成邮箱验证` 和重发按钮
