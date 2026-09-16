# 历史部署文档

这些文档保留用于追溯阶段 A、旧部署路线和历史决策，不作为当前生产操作依据。

当前首版上线和服务器运维统一以：

- [../production-runbook.md](../production-runbook.md)：生产实际终端操作；
- [../prod-startup-order.md](../prod-startup-order.md)：首次上线检查清单；
- [../nest-compose-strategy.md](../nest-compose-strategy.md)：Compose 架构原则。

本目录中的旧文档可能包含已经废弃的 PM2、`apps/api`、旧 `/api/*` 或生产 MinIO
方案。复制命令前必须先确认它是否属于当前 Nest Compose 主线。文档目录规范见
[../../README.md](../../README.md)。
