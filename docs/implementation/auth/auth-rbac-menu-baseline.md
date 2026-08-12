# Nest M1：身份、RBAC 与菜单数据基线

> 状态：✅ 已落地（仅数据模型、受控初始化与部署 CLI）
> 最后更新：2026-08-09
> 依据：[Auth/RBAC PRD](../../prd/long-term/auth-rbac-session-prd.md)、[Canonical 数据模型](../../backend/canonical-data-model.md)

## 目标与边界

M1 建立真实 PostgreSQL 的身份、会话、RBAC、菜单、审计及最小 AI 额度账本模型，并提供系统目录 seed 与首个 `super_admin` 的部署侧 bootstrap 命令。

本阶段没有 Auth HTTP Controller、Guard、JWT、登录/注册、邮件发送、额度服务或 React 改动；这些仍由后续模块实现。

## 数据与初始化链路

```text
正式 Prisma migration
  → users / roles / permissions / sessions / menus / audit / quota 表
  → prisma:seed 写入受控角色、权限、权益与菜单
  → bootstrap:super-admin（仅部署人员）创建或受控提升首个系统所有者
```

- `users.email_normalized` 只接受小写值，数据库 `CHECK` 与唯一索引共同保证大小写规范化唯一性；后续注册、邮箱变更服务必须复用相同规范化规则。
- 权限码由 `src/modules/auth/rbac-catalog.ts` 的唯一目录提供，migration 同时以 `CHECK` 禁止未设计权限码入库。数据范围只在 `role_permissions.data_scope` 保存，并且只存在 `OWN`、`ALL`。
- `MEMBER` 没有内容创作或后台动作权限；`EDITOR` 仅有内容类 `OWN` 授权；`SUPER_ADMIN` 全部为 `ALL`，其中 `content:purge` 不授予 `ADMIN`。
- 每个系统角色都有一个 `ai_entitlements` 默认记录，邮箱验证未来可在同一事务中创建 `ai_quota_accounts` 和 `GRANT` 账本交易。

## 部署侧超级管理员

先运行正式 migration 和受控 seed，然后在容器内提供环境变量后运行：

```bash
SUPER_ADMIN_EMAIL=owner@example.com \
SUPER_ADMIN_TEMP_PASSWORD='OneTimePassword!1' \
pnpm --filter server bootstrap:super-admin
```

命令使用 Argon2id 哈希临时密码、事务级 PostgreSQL advisory lock，并在任意 active `super_admin` 已存在时失败。因此重复执行不会悄然产生第二个系统所有者。创建或提升的账号被标记为 `must_change_password`，并写入安全审计记录。

## 关键文件

- `apps/server/prisma/schema.prisma`：M1 Prisma 模型与 PostgreSQL 映射。
- `apps/server/prisma/migrations/20260809025019_auth_rbac_menu_baseline/`：正式迁移；保留已有 `pgcrypto` 初始化迁移。
- `apps/server/prisma/seed.ts`：可重复的受控角色、权限、菜单与权益 seed。
- `apps/server/src/cli/bootstrap-super-admin.ts`：没有 HTTP 入口的系统所有者 bootstrap。
- `apps/server/test/auth-rbac-baseline.spec.ts`：迁移、重复 seed、权限约束和首个超级管理员保护的容器测试。

## 验证

1. 启动本地 PostgreSQL 后执行 `pnpm --filter server prisma:deploy` 与 `pnpm --filter server prisma:seed`。
2. 运行 `pnpm --filter server test`；测试在临时 PostgreSQL 中应用同一套正式 migration。
3. 设置一次性环境变量后运行 bootstrap 命令；再次运行应以“已有 active super_admin”失败。
