# 部署与运维文档

> 本目录由原 `docs/operations/` 更名为 `docs/deploy/`。
> 文档放置规则见 [../README.md](../README.md)。

| 文档 | 用途 | 何时读 |
| --- | --- | --- |
| [go-live-mainline.md](./go-live-mainline.md) | **当前主线**：首版上线（公网 IP + Compose，不做 M7） | 现在要上线时先读 |
| [prod-env-worksheet.md](./prod-env-worksheet.md) | 当前生产配置与 `.env.prod` 填写表 | 准备生产环境时 |
| [production-prerequisites.md](./production-prerequisites.md) | 服务器软件安装、资源、安全组和 Compose 前检查 | 第一次准备服务器时 |
| [production-runbook.md](./production-runbook.md) | **生产服务器实际操作总手册**：发布、日常运维、排障、备份、恢复 | 登录服务器操作时 |
| [production-verification.md](./production-verification.md) | 上线后的真实环境验收：服务、登录、邮件、COS、AI、Worker、备份 | 部署完成后 |
| [prod-startup-order.md](./prod-startup-order.md) | 首次上线检查清单 | 第一次上线时 |
| [tencent-cloud-prep.md](./tencent-cloud-prep.md) | 腾讯云：COS、SMTP、域名、HTTPS | 控制台准备时 |
| [nest-compose-strategy.md](./nest-compose-strategy.md) | Compose 拓扑、COS、Worker、备份与发布原则 | 了解架构时 |
| [old/README.md](./old/README.md) | 阶段 A 和旧部署方案索引 | 追溯历史时 |

本地开发是两个 Origin（`:8000` / `:8001`）。**生产不要再为管理端加 PM2**：前端由 Nginx 同站托管两份静态资源，Nest 用 Compose 的 `server` + `server-worker`。可执行骨架：仓库根 `compose.prod.yml`（密钥用 `.env.prod.example` 复制为 `.env.prod`）。详见 [nest-compose-strategy.md](./nest-compose-strategy.md)。

**服务器目录口径：**项目代码位于 `/opt/personal-hub/`；现有小册源文件位于 `/data/personal-hub/content-local/`。首版生产导入时，该目录只作为一次性导入源，导入成功后以腾讯 COS 为长期内容存储，不在项目目录下维护 `content-local` 实体副本。

**推荐阅读顺序：**

1. [go-live-mainline.md](./go-live-mainline.md) — 主线边界
2. [prod-env-worksheet.md](./prod-env-worksheet.md) — 先填 `.env.prod`
3. [production-prerequisites.md](./production-prerequisites.md) — 安装并检查服务器
4. [prod-startup-order.md](./prod-startup-order.md) — 再按序启动
5. [tencent-cloud-prep.md](./tencent-cloud-prep.md) — COS / SMTP / 域名证书
6. [production-runbook.md](./production-runbook.md) — 首次上线和服务器命令
7. [production-verification.md](./production-verification.md) — 上线后的真实环境验收
8. [../engineering/dev-local.md](../engineering/dev-local.md) — 本地开发命令
9. [nest-compose-strategy.md](./nest-compose-strategy.md) — 拓扑与发布原则

Nest 本地启动不使用旧 PM2 文档：按 [`apps/server/README.md`](../../apps/server/README.md) 运行 `compose.dev.yml` 与 `pnpm dev:server`；生产服务器命令统一见 [production-runbook.md](./production-runbook.md)。

## 当前阶段结论

- **当前主线（2026-09-15）**：把 Nest M0–M6 用 `compose.prod.yml` 发布到个人服务器，浏览器走 `http://<公网IPv4>/`（不要先买域名）。见 [go-live-mainline.md](./go-live-mainline.md)。
- **阶段 A（个人远程阅读）**：必须跑 `user-web` 的 Umi dev 才能保留 mock，使用 `pm2 start ecosystem.config.js --only personal-hub-dev`。这一套**不包含**管理端，也不适用于 Nest 生产；Nest 发布成功前可以继续用，不要和 Compose 抢同一端口。
- **Nest / 生产**：Compose 编排 Nginx + 用户端静态 + 管理端静态 + `server` + `server-worker`；不要用 PM2 起第二套前端。策略见 [nest-compose-strategy.md](./nest-compose-strategy.md)，骨架见 `compose.prod.yml`。`server-worker` **不是 stub**：独立进程运行 Outbox dispatcher 与 BullMQ。
- 阶段 A 公网形态是 `http://<公网 IPv4>:8000`；Nest 首版公网形态是 `http://<公网 IPv4>/`（Nginx :80）。
- 安全组来源优先使用客户端真实公网出口 IP `/32`；`0.0.0.0/0` 仅用于短时排障。
