# 用户、登录与权限体系

> 状态：🟢 产品与 UI 说明；Nest 后端事实以 [Canonical API](../backend/canonical-api.md)、[Canonical 数据模型](../backend/canonical-data-model.md) 和 [Auth/RBAC PRD](../prd/long-term/auth-rbac-session-prd.md) 为准
> 最后更新：2026-08-26

---

## 当前 Mock 与未来 Nest 的关系

`apps/user-web` 当前通过 mock 验证登录页面、菜单、路由守卫和按钮显隐；它不是认证或授权的事实来源。mock token、粗粒度权限和本地存储仅用于过渡体验，接入 Nest 时必须由 `/api/v1/auth/*` 和服务端 Guard/Service 替换。

长期 Web 请求只在内存保存 Access Token，并以 Bearer Header 调用受保护 API；Refresh Token 仅通过 Cookie 用于 Auth 接口。前端菜单、路由和按钮只能改善体验，不能构成权限边界。

## 首版认证

首版只支持邮箱密码，不实现 GitHub、微信或手机号登录的表、回调和备用路径。

1. 注册创建 `PENDING_VERIFICATION` 的 `MEMBER`，发送 24 小时一次性邮箱验证 Token；注册成功返回 `202`，不自动登录、不签发 Token。
2. 消费验证 Token 后账号成为 `ACTIVE`。未验证账号登录返回 `403 AUTH_EMAIL_NOT_VERIFIED`；重发验证统一响应，避免枚举邮箱。
3. 邮箱验证成功后，服务端在 AI 额度账本中一次性赠送默认 `10,000` 可运营额度；这不是前端显示值或 `users` 上可直接改写的余额。
4. 密码至少 8 位，必须包含大写、小写、数字和特殊字符；密码使用 **Argon2id** 哈希。找回密码 Token 30 分钟一次性有效，邮箱变更需要当前密码并重新验证新邮箱。

## Token、会话与刷新

| 项目          | Canonical 规则                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| Access Token  | 8 小时 JWT；仅含 `sub`、`sid`、`authVersion`、`permissionVersion`，不含完整权限                       |
| Refresh Token | 7 天高熵随机值；数据库只保存加 pepper 的哈希，刷新时轮换                                              |
| Web 存储/传输 | Access Token 仅内存 + `Authorization: Bearer`；Refresh 为 `Secure`、`HttpOnly`、`SameSite=Lax` Cookie |
| Cookie 防护   | 不设置宽泛 `Domain`；Cookie 鉴权 Auth 路由严格校验 `Origin` / `Referer` 同源白名单                    |
| 登出          | Web `POST /auth/logout` 优先 Refresh Cookie，没有再用 Access Token；只撤当前会话                      |
| 会话失效      | 登出撤销当前会话；密码、禁用、全量撤销递增认证版本；角色/权限变更递增权限版本                         |

检测到已轮换 Refresh Token 重放时，只撤销该设备会话及其 Token 链，不影响其他设备。`member` 最多 5 个活跃会话，新登录会撤销最久未活跃的非当前会话；管理角色首版不设上限。

Flutter 将使用独立 `/auth/mobile/*` 传输契约和系统安全存储，复用同一 SessionService，不削弱 Web Cookie 策略。

## 登录风险控制与 TOTP

- 同一规范化邮箱 + IP 最多 5 次/15 分钟，单 IP 总计最多 20 次/15 分钟；错误账号和密码统一返回 `401 AUTH_INVALID_CREDENTIALS`。
- 连续 3 次失败后，下一次登录须提交自建 SVG/算术验证码。挑战 5 分钟一次性有效，答案及账号/IP 绑定仅以 Redis 哈希保存。
- `admin`、`super_admin` 可自愿绑定 TOTP，首版不强制。已绑定时，密码校验只返回一次性短期 MFA challenge；TOTP 或恢复码验证成功后才创建会话。
- 恢复码只在绑定确认时显示一次，数据库仅保存哈希；绑定、停用、使用和管理员重置均必须审计。

## RBAC 与数据范围

### 单角色模型

首版每个用户只有一个 `users.role_id`：`member`、`editor`、`admin` 或受保护的 `super_admin`。不建立 `user_role_assignments`、用户直接权限或多角色权限并集；未来有明确语义后再迁移。

`super_admin` 只能由受控 bootstrap CLI 创建/提升，事务中始终至少保留一名 `ACTIVE` 的系统所有者。普通 `admin` 不得降级、禁用、撤销 `super_admin` 会话或管理其高风险配置。

### Canonical 权限码

真实权限为受控 seed，格式为“资源:动作”，例如 `content:create`、`content:update`、`booklet:import`、`user:status:update`、`role:permission:manage`、`ai:quota:adjust`、`system:config:manage`。不再使用 `content:write`、`admin:access`、`ai:use` 等 mock 粗粒度码作为后端授权。

权限码不携带范围。`role_permissions.data_scope` 独立保存：

| 范围   | 首版语义                                 |
| ------ | ---------------------------------------- |
| `OWN`  | 服务端按资源所有者过滤                   |
| `ALL`  | 不按所有者过滤，仍遵从资源状态与业务规则 |
| `TEAM` | 仅枚举预留，首版不可配置或授予           |

Guard 校验动作权限；Service/Repository 必须在列表、详情和写操作中强制 `OWN/ALL`。客户端不得提交 `ownerId` 或范围绕过校验。

### React mock 权限兼容

`packages/shared-types/src/permission.ts` 仍是当前 React mock 的 UI 显隐来源。接 Nest 时应建立适配层或一次性迁移为 Canonical 权限目录，而不是让 mock code 直接成为 API 合约。

## 身份与授权接口

固定前缀为 `/api/v1`。主要接口包括注册/验证/重发验证、忘记密码/重置密码、验证码挑战、登录/MFA、刷新/登出、`/auth/me`、`/auth/permissions`、`/auth/change-password`、会话列表与撤销、后台踢全部设备、邮箱变更及 TOTP 管理。精确路径、状态码、错误码和响应格式以 [Canonical API](../backend/canonical-api.md#2-auth) 为准。

## 后续扩展

OAuth、手机号、团队范围和多角色均为后续独立设计项。它们不得通过新增前端入口、模拟角色或绕过上述会话/权限模型提前落地。

---
