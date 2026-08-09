# 部署与运维文档

> 本目录由原 `docs/operations/` 更名为 `docs/deploy/`。
> 文档放置规则见 [../README.md](../README.md)。

| 文档                                                       | 用途                                                                       | 何时读                         |
| ---------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------ |
| [deployment-plan.md](./deployment-plan.md)                 | **完整部署总览**（阶段 A/B/C、目录约定、Gitee、NestJS 演进、手动上传迁移） | 首次规划或升级部署方式时先读   |
| [pm2-deployment.md](./pm2-deployment.md)                   | **PM2 部署权威**（阶段 A：dev + mock + :8000，排障对照）                   | 服务器 PM2 启动失败 / 首次上线 |
| [server-deployment-guide.md](./server-deployment-guide.md) | **React mock + PM2 一页速查**                                              | 阶段 A 只想复制命令            |
| [personal-remote-reading.md](./personal-remote-reading.md) | **阶段 A/B 细节**（mock、COS、缓存、API 改造清单）                         | 小册/COS/缓存/NestJS 改造      |
| [deployment.md](./deployment.md)                           | 长期生产：Docker / Nginx / CI/CD / 备份                                    | NestJS 正式对外之后            |
| [nest-compose-strategy.md](./nest-compose-strategy.md)     | Nest 本地依赖 Compose、生产全栈 Compose、COS 对象存储、备份与发布原则      | Nest 生产部署规划前            |

**推荐阅读顺序：**

1. [deployment-plan.md](./deployment-plan.md) — 代码/数据目录、Gitee 策略、NestJS 演进
2. [pm2-deployment.md](./pm2-deployment.md) — PM2 启动与排障（阶段 A 实操）
3. [server-deployment-guide.md](./server-deployment-guide.md) — 日常 `pnpm deploy:server` 速查

Nest 本地启动不使用上述 PM2 速查：按 [`apps/server/README.md`](../../apps/server/README.md) 运行 `compose.dev.yml` 与 `pnpm dev:server`；生产目前仅有 [Compose 策略](./nest-compose-strategy.md)，尚未形成可执行发布速查。

## 当前阶段结论

- 阶段 A 必须运行 `react-web` 的 Umi dev 才能保留 mock API，统一使用 `pm2 start ecosystem.config.js --only personal-hub-dev`。
- 服务器内通过 `127.0.0.1:8000` 验证应用；公网通过 `http://<服务器公网 IPv4>:8000` 访问，并额外受云安全组控制。
- 安全组来源优先使用客户端真实公网出口 IP `/32`；`0.0.0.0/0` 仅用于短时排障，不能作为 dev + mock 的长期开放策略。
