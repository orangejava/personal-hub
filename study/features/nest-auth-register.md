# Nest 注册与邮箱链接验证

## 场景背景

需要公开注册，但不能让未验证邮箱立刻拿到登录态，也不能让攻击者靠接口探测某个邮箱是否已经注册。本地还没有真实 SMTP，所以验证信必须能在 Mailpit 里看见、点开。

## 核心概念

- **链接 Token，不是 6 位验证码。** 邮件里带 24 小时一次性 URL，服务端只存哈希。
- **统一 202。** 注册和重发对“新用户 / 已存在 / 不存在”返回同一形状，避免枚举。
- **验证赠额在同一事务。** 首次激活时按角色 `ai_entitlements.verification_grant_amount` 写 `GRANT`，幂等键 `email-verify-grant:{userId}`，重复点击链接不会加第二次钱。

## 实现步骤

1. 注册 DTO 校验密码策略（大小写 + 数字 + 特殊字符，至少 8 位）。
2. 没有该邮箱则创建 `PENDING_VERIFICATION` MEMBER，写入验证 Token 哈希，再发信。
3. 已有 PENDING 则作废未消费 Token 再发新信；其它状态只返回 202。
4. 验证页把 `?token=` POST 到 `/auth/verify-email`；成功后去登录。
5. 登录若返回 `AUTH_EMAIL_NOT_VERIFIED`，提供重发。

## 关键代码

验证 URL 由 `PUBLIC_APP_ORIGIN` 拼出（默认用户端 `:8000`），不要写成管理端，也不要让用户直接打 Nest `:3001`。

额度账本用 Prisma 事务 + 唯一幂等键，而不是应用内存锁。

## 常见错误

- 测试里打到真实 Mailpit：HTTP 测试必须 `overrideProvider(MailService)`。
- 把明文 Token 写入数据库或日志。
- 已存在邮箱返回 409：会泄露账号是否注册。
- 验证成功后再另起请求写额度：请求中断会造成“已激活但没赠额”。

## 手动验证

1. 打开 `http://localhost:8000/user/register`，用新邮箱注册。
2. 打开 `http://localhost:8025`，点击邮件链接。
3. 回到登录页用同一密码登录，应能进入工作区。
4. 同一封邮件再点一次，页面仍显示成功，额度不会变成 20000。
