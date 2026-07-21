# 用户、登录与权限体系

> 状态：🟢 当前 React-first mock 权限契约已对齐；后端细粒度权限待 NestJS 阶段确认
> 最后更新：2026-07-10

---

## 登录方式

| 方式 | 优先级 | 说明 |
|---|---|---|
| 邮箱 + 密码注册/登录 | 首版必须 | — |
| GitHub OAuth | 后续 | 预留接口 |
| 微信 OAuth | 后续 | 需微信开放平台资质 |
| 手机号验证码 | 后续 | 需短信服务商接入 |

---

## 注册流程

```
用户填写表单
  · 邮箱（必填，格式校验）
  · 密码（必填，见密码策略）
  · 昵称（必填，最多 20 字）
      ↓
前端发送注册请求
      ↓
后端发送邮箱验证码（6 位数字，10 分钟有效）
      ↓
用户填写验证码
      ↓
验证通过 → 创建账号 → 自动登录（返回 Token）
         → 赠送初始 Token 配额 10,000
```

**首版简化选项**：若邮件服务未就绪，可跳过邮箱验证，注册即激活，后续补充邮件验证。

---

## 密码策略

- 长度：8～64 位
- 复杂度：包含字母 + 数字（不强制特殊字符，降低注册摩擦）
- 存储：bcrypt 哈希，cost factor = 12
- 重置方式：发送重置链接到注册邮箱（链接 30 分钟有效，一次性）
- 登录失败：连续失败 5 次后，锁定账号 15 分钟

---

## Token 认证

- **Access Token**：JWT，有效期 15 分钟
- **Refresh Token**：随机字符串，存数据库，有效期 7 天（滑动续期）
- Web 端：Access Token 存内存，Refresh Token 存 HttpOnly Cookie
- Flutter 端：两个 Token 均存安全存储（flutter_secure_storage）
- 后端 NestJS 守卫：`JwtAuthGuard` + `RolesGuard` + `PermissionsGuard` 三层

---

## 权限模型（RBAC）

```
用户（User）
  └── 属于多个角色（Role）
        └── 拥有多个权限点（Permission）
              ├── 菜单可见（menu:xxx）
              ├── 页面可见（page:xxx）
              └── 操作权限（action:xxx）
```

### 预设角色

| 角色 | 标识 | 说明 |
|---|---|---|
| 管理员 | `admin` | 全部权限，系统内置不可删除 |
| 编辑者 | `editor` | 内容创作 + 工作区完整能力 |
| 普通会员 | `member` | 注册后默认角色，阅读 + AI 基础使用 |

> 角色可在后台自由新增，以上三个为系统内置预设。

---

## 当前权限契约

> `packages/shared-types/src/permission.ts` 是当前 mock 和 React 前端的唯一代码来源。它采用模块级粗粒度权限，目的是先验证路由、菜单、按钮三级体验；后端接入前再根据接口和数据归属细化为“本人/全部/单工具”等权限点。

| 权限标识 | 当前用途 |
|---|---|
| `content:read` | 阅读内容与小册 |
| `content:write` | 创建、编辑内容 |
| `content:publish` | 发布、归档内容 |
| `content:delete` | 删除内容 |
| `booklet:read` | 阅读本地小册 |
| `booklet:write` | 导入、管理小册 |
| `workspace:access` | 访问登录后工作区 |
| `admin:access` | 访问后台运营台 |
| `user:manage` | 管理用户 |
| `role:manage` | 管理角色与菜单权限 |
| `ai:use` | 使用当前启用的 AI 工具 |
| `ai:manage` | 管理 AI 厂商、模型与工具配置 |
| `system:config` | 修改系统级配置 |

未登录试用是系统策略，不属于 `PermissionCode`。后续若要把 AI 工具、内容所有权或后台资源拆得更细，必须先更新共享类型、API 文档、NestJS Guard 和角色迁移方案，不能只改前端显隐。

### 预设角色权限分配

| 权限 | member | editor | admin |
|---|:---:|:---:|:---:|
| `content:read` | ✅ | ✅ | ✅ |
| `content:write` | ❌ | ✅ | ✅ |
| `content:publish` | ❌ | ✅ | ✅ |
| `content:delete` | ❌ | ❌ | ✅ |
| `booklet:read` | ✅ | ✅ | ✅ |
| `booklet:write` | ❌ | ✅ | ✅ |
| `workspace:access` | ❌ | ✅ | ✅ |
| `admin:access` | ❌ | ❌ | ✅ |
| `ai:use` | ✅ | ✅ | ✅ |
| `ai:manage` | ❌ | ❌ | ✅ |
| `user:manage` | ❌ | ❌ | ✅ |
| `role:manage` | ❌ | ❌ | ✅ |
| `system:config` | ❌ | ❌ | ✅ |

---

## 数据模型

```sql
users           -- id, email, password_hash, nickname, avatar, bio,
                --  status(active/disabled), token_quota, created_at, updated_at

roles           -- id, name, label, is_system(bool), created_at

permissions     -- id, code(唯一), label, group

menus           -- id, name, path, icon, parent_id, sort, is_visible

user_roles      -- user_id, role_id          （多对多）
role_permissions-- role_id, permission_id    （多对多）
menu_permissions-- menu_id, permission_id   （菜单访问需要哪个权限点）
```

---

## 第三方登录扩展方案（后续）

使用 Passport.js（NestJS 集成）：
- `passport-github2`：GitHub OAuth
- `passport-wechat`：微信 OAuth

统一入口：`GET /auth/{provider}`，回调统一处理：
- 若邮箱已注册 → 关联账号并登录
- 若首次登录 → 创建账号（自动生成昵称），跳转完善资料页

---
