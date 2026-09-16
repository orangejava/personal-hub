# NestJS Docker Compose 开发与生产策略

> 状态：🟡 本地 `compose.dev.yml` 已落地；生产骨架 `compose.prod.yml` + Dockerfile 已写入仓库，尚未对真实机器发布。当前主线按公网 IP 发布，见 [go-live-mainline.md](./go-live-mainline.md)
> 最后更新：2026-09-13
> 关联：[后端实现约定](../backend/conventions.md)、[小册与文件 PRD](../prd/long-term/content-booklet-file-prd.md)

---

## 1. 目标

统一使用 Docker Compose 管理依赖，避免“本地一种数据库、服务器另一种数据库”的差异；同时保留 Nest 本地热更新效率。

| 环境       | 容器化范围                                                        |
| ---------- | ----------------------------------------------------------------- |
| 本地开发   | PostgreSQL、Redis、MinIO、Mailpit；Nest 运行在宿主机              |
| 自动化测试 | Testcontainers 临时 PostgreSQL/Redis，不复用开发数据              |
| 生产       | Nginx、Nest、PostgreSQL、Redis 使用 Compose；对象存储使用腾讯 COS |

## 2. 本地开发

已落地的 `compose.dev.yml`：

| 服务           | 作用                                |
| -------------- | ----------------------------------- |
| PostgreSQL 16  | 业务数据、审计、outbox、AI 账本     |
| Redis 7        | 会话、缓存、限流、BullMQ            |
| MinIO          | S3 兼容的 COS 本地模拟              |
| MinIO init job | 创建受控 Bucket 和初始策略          |
| Mailpit        | 捕获验证/重置邮件，不发真实公网邮件 |

Nest 以宿主机 `pnpm --filter server dev` 热更新，并由 `.env.local` 连接映射后的本地端口。

- 本地数据库、Redis、MinIO、Mailpit 数据都使用具名 Docker volume。
- `.env.local` 不提交；提供 `.env.example` 只列变量名和安全说明。
- 启动成功不等于迁移成功：开发流程需显式执行 Prisma migration/seed。

## 3. 生产 Compose

生产单服务器首版服务（**不要用 PM2 再起一套前端**。PM2 只属于阶段 A 的 Umi mock 远程阅读，历史说明见 [old/pm2-deployment.md](./old/pm2-deployment.md)）：

```text
Internet
  ↓ HTTPS
Nginx（唯一公网入口）
  ├─ /          → 用户端静态（apps/user-web 构建产物）
  ├─ /admin     → 管理端静态（apps/admin-web 构建产物，publicPath=/admin/）
  └─ /api/v1    → Nest `server`
       ├─ PostgreSQL volume
       ├─ Redis volume
       └─ 腾讯 COS（外部私有 Bucket）
Nest `server-worker` → Redis / PostgreSQL / 腾讯 COS
```

这里的「双进程」是 Nest 的 **`server`（HTTP）+ `server-worker`（Outbox / BullMQ）**，两者同一镜像、独立 Compose 服务。前端是 Nginx 托管的两份静态资源，不是两个 Node 长驻进程，也不是第二套 PM2。

后续公开页迁到 Next 时，用 Next 替换 `/` 的用户端静态即可；`/admin` 仍由 `apps/admin-web` 承担。

- Nginx 是唯一公网入口；PostgreSQL、Redis、MinIO 管理端不暴露公网。
- `server` 仅接收 HTTP 流量；Outbox dispatcher 与 BullMQ worker 在独立 Compose `server-worker` 服务运行。两者使用同一镜像/构建产物但可独立扩缩、重启和观测，worker 不作为 server 容器内的附属线程。
- Nest、PostgreSQL、Redis 使用独立 Compose volume；不把数据库目录挂到任意应用工作目录。
- 生产不运行 MinIO 作为业务源数据；COS 是 FileAsset 的唯一对象源。
- 用户端、管理端与 Nest **同站路径分流**（同一 Origin 的 `/`、`/admin`、`/api/v1`）。Refresh Cookie 走宿主 Cookie，生产业务 API **不开放 CORS**。开发环境才对 `localhost:8000` / `localhost:8001` 开放凭据请求。
- 管理端生产构建必须带 `PUBLIC_PATH=/admin/`，否则 JS/CSS 会落到站点根路径，和用户端静态资源撞车。本地独立 Origin（`:8001`）继续用默认 `/`。
- 项目目录的 `.env.prod` 存部署密钥，由 `docker compose --env-file .env.prod` 注入；绝不提交 Git、写入镜像层或回显日志。骨架见仓库根 `compose.prod.yml` 与 `.env.prod.example`。
- API Key、SMTP、JWT、COS 凭证都仅来自环境变量/密钥管理。
- 生产 Dockerfile / `compose.prod.yml` 骨架已在仓库根与 `apps/server/Dockerfile`、`deploy/nginx/`；镜像仓库、域名、TLS 证书仍待实际部署时填写，不要把骨架当成已发布。

## 4. Nginx 与安全

- 强制 HTTPS，HTTP 重定向至 HTTPS。
- 生产将 `/`、`/admin`、`/api/v1` 反向代理至同一站点；Refresh Cookie 使用宿主 Cookie，不设置宽泛 `Domain`，并由 Nest 对 Cookie 鉴权 Auth 接口校验 `Origin` / `Referer`。
- Nginx 只接受来自客户端的原始连接信息，并覆盖写入 `X-Forwarded-For`、`X-Forwarded-Proto`；Nest 仅信任 Nginx 所在受控网络的这些转发头，禁止把客户端自带 Header 透传为可信 IP。
- SSE 路由关闭代理缓冲、使用足够长的读取超时；不得把 SSE 当普通短 HTTP 缓存。
- 设置请求体大小上限，上传大文件走对象存储预签名直传而非穿过 Nginx/Nest。
- 登录、注册、重置与 AI 除应用层 Redis 限流外，可增加 Nginx 通用连接/频率保护。

## 5. 健康检查与观测

- Nest 使用 `@nestjs/terminus` 提供：
  - liveness：进程可运行，供容器重启决策；
  - readiness：检查 PostgreSQL、Redis、对象存储等关键依赖，供是否接收流量决策。
- Docker Compose 为 server 配置 healthcheck；依赖服务也配置健康检查。
- 生产日志只输出 JSON stdout，由 Docker 日志轮转收集；使用 `requestId` 关联 API、outbox 和 Worker。

### 5.1 最低告警与巡检（上线前必须落位）

首版不预设具体监控厂商、聊天群、邮箱地址或值班人员；发布前必须在部署配置中填写实际告警渠道与责任人。至少覆盖：

| 事件                               | 初始阈值 / 判定                              | 最低渠道占位                                          | 首要责任            |
| ---------------------------------- | -------------------------------------------- | ----------------------------------------------------- | ------------------- |
| `server` 或 `server-worker` 不健康 | Compose healthcheck 连续 2 次失败或重启循环  | `ALERT_CHANNEL_CRITICAL`                              | 当次发布/运维责任人 |
| readiness 失败                     | PostgreSQL、Redis 或 COS 探测失败持续 5 分钟 | `ALERT_CHANNEL_CRITICAL`                              | 当次发布/运维责任人 |
| 队列最终失败 / outbox 堆积         | 任一最终失败；或未投递事件持续 15 分钟       | `ALERT_CHANNEL_OPERATIONS`                            | 后端模块责任人      |
| 数据库备份失败                     | 每日任务任一次失败                           | `ALERT_CHANNEL_CRITICAL`                              | 运维责任人          |
| 磁盘容量                           | 使用率达到 80% 告警、90% 紧急处置            | `ALERT_CHANNEL_OPERATIONS` / `ALERT_CHANNEL_CRITICAL` | 运维责任人          |
| 错误率                             | 5xx 比例连续 5 分钟高于 1%                   | `ALERT_CHANNEL_OPERATIONS`                            | 后端模块责任人      |

- `ALERT_CHANNEL_*` 只是待部署时注入的渠道配置占位，不表示具体产品、地址或密钥。
- 每个发布窗口的负责人负责确认告警可达；服务恢复后由触发事件的责任人关闭/记录事件，并补充原因和恢复时间。

## 6. 备份与恢复

### 6.1 PostgreSQL

- 每天在服务器本地执行 PostgreSQL 逻辑备份，保留 14 天；部署、迁移前额外生成一份备份。
- COS 只保存业务对象（多媒体、小册和其他 FileAsset），不承载数据库日常备份。
- 每周创建一次云服务器磁盘快照，作为服务器或磁盘整体故障时的异地恢复保障。
- 备份任务使用 BullMQ 持久化重复任务，不能依赖某次应用进程内 Cron 恰好运行。
- 本地备份目录与 PostgreSQL volume 分离，权限仅授予备份任务；备份不得被应用 HTTP 路由公开下载。

### 6.2 恢复演练

至少在上线前和数据库重大迁移前验证：

1. 从服务器本地备份目录取得指定日期逻辑备份，恢复到隔离 PostgreSQL 实例。
2. 运行只读一致性检查：用户、内容、会话、FileAsset objectKey、AI 账本。
3. 记录恢复耗时和缺失项；不得直接在生产库试恢复。

恢复演练由当次发布/运维责任人发起、后端模块责任人参与校验；演练记录至少包含备份日期、隔离实例、恢复耗时、校验结果、发现项与恢复结论。恢复演练失败不得在未修复或无明确豁免的情况下执行重大迁移。

COS 文件对象和云盘快照都不是单条数据误删的首选恢复方案：内容先在 30 天回收站恢复，文件先在 7 天回收窗口恢复。超过期限仅由管理员从隔离备份中按需提取数据，禁止为单条数据直接整库回滚。

## 7. 发布与回滚

首版采用手工 Compose 发布：

1. 本地/CI 通过格式、类型、测试和构建后构建并推送镜像。
2. SSH 到服务器，拉取目标镜像。
3. 开始短维护窗口：停止 API 和 Worker，运行迁移前本地逻辑备份。
4. 执行已审阅的 `prisma migrate deploy`，再启动目标镜像。
5. 检查 readiness、关键 Auth/公开内容 API、日志和队列后解除维护。

回滚原则：

- 应用镜像可回滚；数据库 migration 默认只前进，不以临时手改表回滚。
- 首版允许短维护窗口；重大破坏性迁移仍须采用 expand/migrate/contract 多步策略，并有恢复演练。
- 任何发布命令、服务器真实路径和镜像仓库地址在实际部署前另行写入具体运维文档，不在本策略中虚构。
