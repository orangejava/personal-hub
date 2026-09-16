# packages/api-client

Nest 认证相关的共享运行时：内存 Access Token、用户/权限映射、`createAuthApi`。

## 边界

- HTTP 由调用方注入（各 app 传入 Umi `request`），本包不依赖 `@umijs/max`。
- 401 之后跳哪一页由各 app 的 `requestErrorConfig` 决定。
- 菜单路径解析（`mapNestMenusToLayout`）留在各 app：用户端与管理端 routeKey 注册表不同。
- 内容 / AI / 后台 CRUD 仍放在各 app 的 `services/`。
