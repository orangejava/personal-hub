# 首次上线检查清单

> 状态：🟢 首次生产上线入口（2026-09-15）
> 详细终端命令统一见 [production-runbook.md](./production-runbook.md#3-首次上线一次性完整流程)。

本文件只保留首次上线的执行顺序和验收清单，避免与生产操作手册重复维护命令。

## 一、上线前准备

- [ ] 腾讯云服务器可 SSH 登录；
- [ ] 安全组已开放 SSH 和 HTTP 80；
- [ ] Docker 与 Docker Compose 插件已安装；
- [ ] 项目代码位于 `/opt/personal-hub/`；
- [ ] 小册源文件位于 `/data/personal-hub/content-local/`；
- [ ] `.env.prod` 已根据 [prod-env-worksheet.md](./prod-env-worksheet.md) 填写；
- [ ] `.env.prod` 未提交 Git，权限为 `600`；
- [ ] COS Bucket、Endpoint、权限已确认；
- [ ] QQ SMTP 已在本地验证；
- [ ] 生产管理员邮箱和一次性密码已准备。

## 二、首次启动顺序

必须按照以下顺序执行：

1. 拉取目标代码版本；
2. 检查 `.env.prod`；
3. 构建并启动 Compose；
4. 检查 PostgreSQL、Redis、server、worker、Nginx；
5. 执行 `prisma migrate deploy`；
6. 执行生产基线 seed；
7. 执行 `bootstrap:super-admin`；
8. 管理员首次登录并立即改密；
9. 将 `/data/personal-hub/content-local/` 临时只读挂载到导入容器；
10. 执行小册导入 dry-run；
11. 确认无误后正式导入 COS；
12. 验证 COS、数据库元数据和阅读页面；
13. 解除临时挂载，按备份确认结果清理源文件。

所有命令见 [production-runbook.md](./production-runbook.md)。

## 三、首次上线验收

- [ ] `GET /api/v1/health/live` 返回 200；
- [ ] readiness 在 migration 后正常；
- [ ] 公网 IP 首页可以打开；
- [ ] 用户端和 `/admin` 管理端可以访问；
- [ ] 生产管理员可以登录和改密；
- [ ] 公开内容和小册章节可以阅读；
- [ ] COS 封面、附件和正文对象正常；
- [ ] 注册验证邮件可以收到；
- [ ] 忘记密码邮件可以收到；
- [ ] `/ai` 页面和 AI home 接口正常；
- [ ] `server-worker` 没有持续重启；
- [ ] 日志中没有密码、授权码或云服务密钥。

## 四、上线后记录

记录以下信息：

- 发布的 Git commit；
- 首次上线时间；
- `.env.prod` 使用的配置版本；
- 数据库 migration 结果；
- 小册导入数量；
- COS 验证结果；
- 邮件验证结果；
- 已知问题和后续处理项。
