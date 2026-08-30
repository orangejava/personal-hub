# Personal Hub Admin Web

后台管理台（Umi + Ant Design Pro）。本地独立端口启动，与用户端 `apps/user-web` 分离。

```bash
PORT=8001 pnpm --filter admin-web dev          # 默认无 mock
# 或根目录：pnpm dev:admin
# 后台 CRUD mock：pnpm dev:admin:mock
```

浏览器打开 `http://localhost:8001/admin/dashboard`。未登录会跳到用户端 `http://localhost:8000/user/login`。

Nest API 经本应用 `/api/v1` 代理到 `:3001`，Refresh Cookie 与 `:8001` 同源。
