# 认证模块规范

> 适用：`src/pages/user`（登录、注册结果等）

## 约束
- 登录页沿用 Ant Design Pro 自带 `/user/login` 改造，不另起。
- mock 登录支持三角色：见 `src/config/devCredentials.ts` 与 [docs/engineering/dev-credentials.md](../../../docs/engineering/dev-credentials.md)。
- 登录后写入 `@@initialState`（user、token、permissions、menu）。
- 未登录访问工作区/后台跳转登录页。
- 注册页走 Nest `POST /api/v1/auth/register`；验证页消费邮件链接 Token。本地邮件在 Mailpit `http://localhost:8025`。
