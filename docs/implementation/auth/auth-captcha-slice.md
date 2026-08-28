# Nest M2 第 4 刀：登录 SVG/算术验证码

> 状态：✅ 已落地
> 最后更新：2026-08-22
> 依据：[切片划分](./README.md)、[Canonical API](../../backend/canonical-api.md) §2.1

## 目标与边界

连续登录失败后出码，而不是一进登录页就出码。不接第三方验证码，不替代已有 5/15 分钟与 IP 20 次限流。

已实现：

- `POST /api/v1/auth/captcha-challenges`：5 分钟一次性 SVG 算术题
- 同一账号 + IP 连续 3 次失败后，`POST /auth/login` 无码或错码 → `403 AUTH_CAPTCHA_REQUIRED`
- 答案只存 Redis 哈希（加 pepper），绑定规范化邮箱 + IP
- 同一邮箱 + IP 只保留最新挑战：`auth:captcha-active:{emailHash}:{ipHash}` 指向当前 `challengeId`，刷新时删除旧 `auth:captcha:{id}`
- React 登录页在该错误码下展示验证码，随登录提交 `challengeId` + `captchaAnswer`

登录页体验（第 4 刀收口后补齐）：

- 验证码图片与输入框同一行；点图片换题，不再单独放「点击图片刷新」文案
- 错码或挑战已消费后密码仍错：自动换图并清空验证码输入
- 「记住用户名」与「忘记密码 / 没有账号？注册」左右排布；勾选且有邮箱时写入 `ph.prefs.v1` 的 `rememberedLoginEmail`

明确不做：腾讯云等第三方码、忘记密码、TOTP。签发挑战不预检「是否已进入风险状态」（有邮箱即可领码）；登录仍按失败次数强制校验。

## 调用链

```text
错误密码 × 3
  → Redis auth:login-fail:{emailHash}:{ipHash} >= 3
  → 再登录无码：403 AUTH_CAPTCHA_REQUIRED
  → POST /auth/captcha-challenges { email }
  → svg-captcha 算术题；答案哈希写入 auth:captcha:{challengeId} TTL 300s
  → 登录带 challengeId + captchaAnswer
  → 消费（删除）挑战；邮箱/IP/答案任一不匹配则再次 403
  → 密码正确则清失败计数并签发会话
```

## 关键文件

- `apps/server/src/modules/auth/auth.service.ts`：阈值判断、一次性消费
- `apps/server/src/modules/auth/dto/captcha-challenge.dto.ts`、`dto/login.dto.ts`
- `apps/react-web/src/pages/user/login/index.tsx`
- `apps/react-web/src/services/auth.ts`：`createCaptchaChallenge`
