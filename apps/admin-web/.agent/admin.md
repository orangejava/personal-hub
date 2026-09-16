# 后台管理台模块规范

> 适用：`apps/admin-web` 的 `src/pages/admin`、`src/components/admin`

- `/admin/*` 仅 `admin` 角色或 `admin:access` 可访问。
- 优先使用 ProTable、ProForm。
- 标题链到公开阅读页时，使用用户端 Origin（`getUserWebOrigin()`），不要用管理端内部路由。
