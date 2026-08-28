# Nest Auth 第 4–6 刀：验证码、设备会话、强制改密

## 场景背景

登录接口公开暴露后，需要把「连续失败」和「无限试密码」分开：先限流，再在失败三次后出一次性算术码。登录成功后用户要能看见自己的设备并踢掉其它会话。管理员 bootstrap 的临时密码不能直接进工作区。

## 核心概念

- 验证码答案不进 HTTP 响应；Redis 里只存加 pepper 的哈希，并绑定邮箱规范化值 + IP。同一邮箱+IP 只留最新挑战，刷新会删旧键。
- 忘记密码走邮件链接（30 分钟），始终 202；重置后撤销全部会话。
- 后台踢人是约束刀：只读用户列表 + 踢全部，不做禁用/改角色。admin 不能踢 admin / super_admin。
- 会话表存 `ip_masked` 和设备摘要，不把完整 UA / 精确 IP 回给前端。
- 改密会递增 `authVersion` 并撤销全部会话，旧 Access Token 立即失效。
- 登录页可「记住用户名」：勾选后写入 `ph.prefs.v1.rememberedLoginEmail`，只记邮箱不记密码。
- `429 AUTH_RATE_LIMITED` 带 `Retry-After`（窗口秒数，当前 900）。
- `/ai` 是 `layout: false`，强制改密要在 `getInitialState` 与 `AiLayout` 再拦一次，不能只靠 ProLayout `onPageChange`。

## 实现步骤

1. 连续 3 次 `AUTH_INVALID_CREDENTIALS` 后，下一次登录无码返回 `AUTH_CAPTCHA_REQUIRED`。
2. `POST /auth/captcha-challenges` 取 SVG，登录时带上 `challengeId` + `captchaAnswer`。
3. 登录后打开 `/workspace/sessions` 查看设备；可踢单个或退出其它设备。
4. `mustChangePassword === true` 时跳 `/user/change-password`，改完用新密码重新登录。

## 常见错误

- 直连 Nest `:3001` 刷新会 Origin 403；必须走 React `:8000`。
- 验证码点刷新后旧 `challengeId` 作废，必须用新挑战再提交。
- 改密成功后旧 Token 立刻 401，这是预期，不是登录坏了。
- 日常 seed 账号不会强制改密；要用 `bootstrap:super-admin` 或把该用户标记为 `mustChangePassword`。

## 手动验证

1. 用错误密码打 `member@example.com` 三次，第四次应出验证码；算对后再登录。
2. 同一账号开两个浏览器登录，在 `/workspace/sessions` 踢掉另一个。
3. 用 `mustChangePassword` 账号登录，应停在改密页，改完回登录页用新密码进入工作区。
