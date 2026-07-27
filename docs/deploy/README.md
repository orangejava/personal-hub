# 部署与运维文档

> 本目录由原 `docs/operations/` 更名为 `docs/deploy/`。  
> 文档放置规则见 [../README.md](../README.md)。

| 文档 | 用途 | 何时读 |
| --- | --- | --- |
| [pm2-deployment.md](./pm2-deployment.md) | **PM2 部署权威**（阶段 A：dev + mock + :8000） | 服务器部署失败 / 首次 PM2 上线 |
| [server-deployment-guide.md](./server-deployment-guide.md) | **一页速查** | 已熟悉流程，只想复制命令 |
| [personal-remote-reading.md](./personal-remote-reading.md) | **阶段 A/B 完整方案**（目录、白名单、dev 启动、COS 规划） | 首次上服务器 / 个人远程读小册 |
| [deployment.md](./deployment.md) | 长期生产：Docker / Nginx / CI/CD / 备份 | NestJS 正式对外之后 |

**当前推荐路径（个人读小册）：** [pm2-deployment.md](./pm2-deployment.md) → 日常更新 `pnpm deploy:server` → 速查 [server-deployment-guide.md](./server-deployment-guide.md)。
