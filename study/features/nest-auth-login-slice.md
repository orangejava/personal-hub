# Nest 登录切片：内存 Access Token 与 Refresh Cookie

## 场景背景

前端 mock 登录把 token 放进 `localStorage`。真实后端要求 Access Token 只放内存、Refresh Token 走 HttpOnly Cookie。如果第 1 刀只做 login/me/logout、不做 refresh，页面一刷新内存令牌就丢，浏览器联调几乎不可用。

## 核心概念

- Access JWT：请求头 `Authorization: Bearer`，8 小时，不含权限列表，只含 `sub/sid/av/pv`
- Refresh Cookie：`ph_refresh`，HttpOnly + SameSite=Lax，7 天；响应体永不返回明文
- 开发期 React `:8000` 通过代理访问 Nest `:3001`，浏览器眼里是同源，Cookie 才能带上
- 工作区/后台菜单来自 Nest `/auth/permissions`；其余业务 CRUD 仍可能走 mock，登录成功后用 `mock-token-{role}` 桥接

## 实现步骤

1. Nest 登录：校验 Argon2 密码 → 写会话和 refresh 哈希 → 签发 JWT → Set-Cookie
2. Guard：验签 → Redis/DB 核对会话版本 → 拒绝已撤销会话
3. 刷新：校验 Origin → 轮换 Refresh Token → 新 JWT
4. 登出：校验 Origin → 先按 Refresh Cookie 撤当前会话，没有 Cookie 再用 Access Token → 清 Cookie；不必先 refresh
5. React：Access Token 放内存；启动时若没有内存令牌就先 `POST /auth/refresh`。仅 401 清登录态；403/5xx 留在当前页

## 常见错误

- 前端直连 `:3001`：Cookie 写在 3001，页面在 8000，刷新会丢登录
- 生产才加 `Secure`：本地 HTTP 加了 Secure，浏览器不会存 Cookie
- 登录失败区分“账号不存在”和“密码错误”：会给枚举账号，必须统一 `AUTH_INVALID_CREDENTIALS`
- refresh 失败一律 `clearAuthSession()`：Origin 403 或断网时页面像已退出，Redis 会话还在。只应在 401 时清
- HTTP 测试读 `.env.local`：`@nestjs/config` v4 会用文件里的 Redis 覆盖 Testcontainers，会话写进 `ph:dev`

## 手动验证

1. bootstrap 一个 super_admin，用该邮箱登录 `http://localhost:8000/user/login`
2. 刷新页面仍保持登录
3. 退出后再访问应回到登录页
