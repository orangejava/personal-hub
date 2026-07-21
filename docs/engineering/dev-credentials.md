# 本地开发 Mock 账号

> 状态：✅ 已确定（2026-07-01）
> 适用范围：`apps/react-web` mock 登录；生产环境由 NestJS seed / 首次部署另行设置。

## 账号列表

| 角色 | 邮箱 | 密码 | 说明 |
|---|---|---|---|
| 管理员 | `admin@example.com` | `yyQhItHlRe8Q9suV` | 强随机密码，可访问工作区 + 后台 |
| 编辑者 | `editor@example.com` | `dev123456` | 可访问工作区、创建/发布内容、上传小册 |
| 普通会员 | `member@example.com` | `dev123456` | 仅公开区阅读 + AI 入口（阶段 5 功能占位） |

## 代码来源

- 账号定义：`apps/react-web/src/config/devCredentials.ts`（单一数据源）
- mock 校验：`apps/react-web/mock/data/users.ts`
- 登录页**不展示**账号密码；开发账号仅记录在本文档与 `src/config/devCredentials.ts`。

## 安全说明

- 上述密码**仅用于本地 mock**，不得提交到生产环境。
- 生产部署时通过环境变量或 seed 脚本生成管理员密码，并**不**在登录页展示。
- `admin@example.com` 密码如需轮换：改 `devCredentials.ts` 后同步更新本文档。

## 相关决策

- 小册上传：仅 `editor` / `admin`（需 `booklet:write`），`member` 不可上传。
- 域名与站点名：暂未确定；开发环境直接访问 `http://localhost:8000`。
