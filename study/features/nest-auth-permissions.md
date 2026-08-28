# Nest 权限快照与菜单过滤

## 场景背景

Access Token 里不能放完整权限列表。登录成功后，前端还需要知道：当前用户能做什么（动作权限）、能看哪些数据（OWN/ALL）、侧栏展示哪些入口（菜单）。这三类数据来自一次 `GET /auth/permissions`。

## 核心概念

- **权限码只描述动作**，例如 `content:read`。范围写在 `role_permissions.data_scope`，不拼进权限字符串。
- **JWT 只含** `sub`、`sid`、`av`、`pv`。Guard 用会话版本拒绝过期令牌；真正的权限列表按 `permissionVersion` 缓存。
- **菜单不是安全边界**。隐藏 `/admin/users` 不能代替 `user:read` Guard。菜单关联多个权限时，拥有其中任一动作即可看见。
- **后端存 routeKey，前端解析路径**。这样以后从 Umi 迁到 Next 只需改注册表。

## 实现步骤

1. seed 写入系统菜单和 `menu_permissions`。ADMIN 区里与 EDITOR 内容权限重叠的项，改用 EDITOR 没有的动作（如 `content:featured`），否则编辑者会因为 `content:read` 看到后台内容管理。
2. Service 读取角色授权和可见菜单，过滤、建树、丢掉空目录。
3. Redis key：`{prefix}:auth:permission:{userId}:{pv}`。权限变更提升 `pv` 后旧缓存自然失效。
4. React `routeRegistry` 映射 path/icon/locale；`mapNestPermissions` 再派生 mock 时代的 `workspace:access`、`content:write` 等，避免大改 `access.ts`。

## 常见错误

- 把 mock 的 `admin:access` / `content:write` 直接写进 Nest 目录。Canonical 没有这些码。
- 浏览器直连 Nest `:3001`。Refresh Cookie 的 Origin 白名单是 React `:8000`。
- 忘记 `pnpm --filter server prisma:seed`。扩展菜单不会随代码自动进已有数据库。
- 用角色名拼菜单。MEMBER 没有动作权限，但仍应看到个人工作台（这些菜单不关联权限码）。
- 登录成功后用 `startTransition` 推迟写入权限，再立刻 `history.replace` 到工作区。路由守卫读到空权限会把人踢回登录页。

## 手动验证

1. 三个本地账号分别登录（见 `docs/engineering/dev-credentials.md`）。
2. owner 侧栏有后台用户管理；editor 没有；member 没有文档管理。
3. 刷新页面后菜单仍在，说明 refresh + permissions 都成功。
