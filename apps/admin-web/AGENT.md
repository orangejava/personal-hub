# apps/admin-web 开发规范

> 适用范围：`apps/admin-web`。这是从 `apps/user-web` 拆出的后台管理台，**不承载**公开前台、工作区、AI 工具页。
> 登录页在用户端 `apps/user-web`；未登录访问本应用会整页跳到用户端登录，登录成功后再回到管理端。

## 1. 定位与技术栈

- 框架：React 19 + Umi Max + Ant Design Pro
- 本地端口：`http://localhost:8001`（`PORT=8001`）
- 用户端：`http://localhost:8000`
- 数据：页面走 `src/services/*`；默认 `pnpm dev:admin` 无 mock。后台 CRUD 仍可用 `pnpm dev:admin:mock`；认证走 Nest `/api/v1`
- 共享类型：`@personal-hub/shared-types`

## 2. 路由

- 路由前缀保持 `/admin/*`，与 Nest `routeKey`、权限菜单 path 一致。
- `/` 重定向到 `/admin/dashboard`。
- 无 `canAdmin` 时走 403；未登录由 403 / `onPageChange` 跳用户端登录。

## 3. 跨应用跳转

- 返回前台、个人设置、登录：使用 `src/config/appOrigins.ts` 拼用户端绝对地址。
- 不要再用 Umi `history.push('/admin')` 从用户端进后台。

## 4. 语言

- 运行时只加载 `src/locales` 下的 `zh-CN`、`en-US`。下拉也只展示这两项。
- 其它语言文件保留在 `src/locales-frozen/`，不删除、不更新、不移回 `src/locales/`。
- 后续模块新增文案只改中、英。

## 5. 模块

| 模块 | 位置 |
|---|---|
| 后台页面 | `src/pages/admin` |
| 后台组件 | `src/components/admin` |
| mock | `mock/admin.ts` 与 `mock/data/admin-store.ts` |
| 细则 | `.agent/admin.md` |
