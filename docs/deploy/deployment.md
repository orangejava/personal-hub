# 部署方案

> 状态：🟢 长期 Nest 生产入口；文末旧草案仅供追溯
> 最后更新：2026-08-29
> 当前依据：[Nest Compose 策略](./nest-compose-strategy.md)

> **权威提示**：Nest 生产部署唯一依据是 [Nest Compose 策略](./nest-compose-strategy.md)。当前后端为 `apps/server`，生产 API 位于 `/api/v1`，认证为 JWT-only + Argon2id，生产对象存储唯一使用腾讯 COS。
>
> **完整路线图（阶段 A/B/C、Gitee、目录约定）** → [deployment-plan.md](./deployment-plan.md)
> **个人远程阅读 + COS** → [personal-remote-reading.md](./personal-remote-reading.md)
> **一页速查** → [server-deployment-guide.md](./server-deployment-guide.md)

---

## 当前阶段：本地开发

日常联调是三个宿主机进程 + Compose 依赖，不是 PM2：

| 项     | 方式                                                                                    |
| ------ | --------------------------------------------------------------------------------------- |
| 用户端 | `pnpm dev:react` → http://localhost:8000                                                |
| 管理端 | `pnpm dev:admin` → http://localhost:8001                                                |
| API    | `pnpm dev:server` → http://localhost:3001/api/v1                                        |
| 依赖   | `compose.dev.yml`：PostgreSQL、Redis、MinIO、Mailpit                                    |

生产不要把管理端加进 `ecosystem.config.js`；拓扑见 [Nest Compose 策略](./nest-compose-strategy.md)。**当前不必按生产拓扑搭建本地环境。**

---

## Nest 生产收口

| 项目         | 当前约定                                                                                                                                                                   |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 服务         | Compose 编排 Nginx（用户端静态 + 管理端静态）、`server`、`server-worker`、PostgreSQL、Redis；Nginx 是唯一公网入口 |
| 应用职责     | `server` 提供 `/api/v1` HTTP；`server-worker` 独立运行 Outbox dispatcher 与 BullMQ worker                                                                                  |
| 存储         | 本地 Compose 用 MinIO；生产业务对象仅腾讯 COS，统一 AWS SDK v3 S3 Provider                                                                                                 |
| Redis / 队列 | `ioredis` 封装；通用限流通过项目自定义 `ThrottlerStorage`；关键异步使用 Outbox + BullMQ                                                                                    |
| 备份         | PostgreSQL 每日逻辑备份保留 14 天；部署、迁移前额外备份；上线前和重大迁移前进行隔离恢复演练                                                                                |
| 发布         | 构建并推送目标镜像后，短维护窗口内停止 `server` / `server-worker`、备份、`prisma migrate deploy`、启动与 readiness/关键 API/队列检查；应用镜像可回滚，数据库迁移默认只前进 |
| 告警         | 最低事件、渠道占位、阈值与恢复责任见 [Compose 策略 §5.1](./nest-compose-strategy.md#51-最低告警与巡检上线前必须落位)                                                       |

不得在本文或实施配置中猜测服务器地址、镜像仓库、域名或密钥；这些只在实际部署时由受控运维配置提供。

---

## 已归档的早期 Docker / Nginx / CI 草案（不可执行）

> 本节及其后续示例中出现的 `apps/web`、`apps/api`、`/api`、PM2 API、生产 MinIO、7 天备份、对象存储备份数据库和示例镜像名均已废弃，**不得复制执行**。保留文字仅用于理解历史迁移背景；当前实现请回到上方“ Nest 生产收口”及 [Nest Compose 策略](./nest-compose-strategy.md)。

### 本地开发（Docker Compose，历史草案）

```yaml
# docker-compose.yml（开发环境）
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: personal_hub
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev123
    ports: ['5432:5432']
    volumes: ['postgres_data:/var/lib/postgresql/data']

  redis:
    image: redis:7-alpine
    ports: ['6379:6379']

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports: ['9000:9000', '9001:9001']
    volumes: ['minio_data:/data']

  meilisearch:
    image: getmeili/meilisearch:v1.7
    ports: ['7700:7700']
    environment:
      MEILI_MASTER_KEY: devmasterkey
    volumes: ['meili_data:/meili_data']
```

- **React-first 阶段**：`user-web` 在宿主机运行（`pnpm dev:react`），不进 Docker
- **长期全栈阶段**：`web`（Next.js）和 `api`（NestJS）直接在宿主机运行（`pnpm dev`），不进 Docker，保持热更新体验
- MinIO 和 Meilisearch 首版开发阶段可选启动，不是必须依赖

---

## 服务器配置与选型

**首版生产环境（个人/初期）**：

| 项目     | 规格                                             |
| -------- | ------------------------------------------------ |
| 云服务商 | 阿里云（优先）或腾讯云                           |
| 实例规格 | 2 核 4GB 内存（可从 2 核 2GB 起步）              |
| 磁盘     | 系统盘 40GB SSD + 数据盘 100GB（挂载到 `/data`） |
| 带宽     | 按量计费，5Mbps 基础带宽                         |
| 操作系统 | Ubuntu 22.04 LTS                                 |
| 估算费用 | ≈ ¥100-200/月（按量或包年）                      |

---

## 生产部署结构

```
外部请求
    ↓
Nginx（80/443）
    ├── / → react-web dist（阶段 B；长期可含 next-web）
    ├── /api → NestJS apps/api（端口 3001）
    └── /minio → MinIO（端口 9000，可选）

本机服务
    ├── PostgreSQL（端口 5432，仅内网，数据卷 /data/personal-hub/postgres）
    ├── Redis（端口 6379，仅内网，数据卷 /data/personal-hub/redis）
    ├── MinIO（端口 9000/9001）
    └── Meilisearch（端口 7700，仅内网，后续）
```

代码仓库固定 **`/opt/personal-hub`**；持久化数据 **`/data/personal-hub`**。详见 [deployment-plan.md §2](./deployment-plan.md#2-代码与数据分开还是放同一项目下)。

所有服务通过 Docker Compose 管理，Nginx 运行在宿主机（非容器）。

---

## 生产 docker-compose.yml 结构

```yaml
services:
  web:
    image: personal-hub-web:latest
    build: ./apps/web
    environment:
      - NEXT_PUBLIC_API_URL=https://api.yourdomain.com
    ports: ['3000:3000']
    restart: unless-stopped

  api:
    image: personal-hub-api:latest
    build: ./apps/api
    environment:
      - DATABASE_URL=postgresql://...
      - REDIS_URL=redis://redis:6379
    ports: ['3001:3001']
    depends_on: [postgres, redis]
    restart: unless-stopped

  postgres:
    image: postgres:16
    volumes: ['/data/postgres:/var/lib/postgresql/data']
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes: ['/data/redis:/data']
    restart: unless-stopped

  minio:
    image: minio/minio
    volumes: ['/data/minio:/data']
    restart: unless-stopped
```

---

## CI/CD 流程

**当前推荐（个人项目）：** 本地 push **Gitee** → 服务器 SSH 上 `git pull` + 构建 + PM2 重启（见 [deployment-plan.md §8](./deployment-plan.md#8-日常运维速查)）。

**自动化（可选）：** Gitee Webhook / Gitee Go 触发服务器部署脚本，步骤与下方 GitHub Actions 类似。

**长期模板：GitHub Actions + SSH 部署**（若恢复 GitHub 可达或双 CI）

### 工作流（`.github/workflows/deploy.yml`）

```
触发条件：push 到 main 分支

1. checkout 代码
2. pnpm install
3. pnpm run lint（ESLint 检查）
4. pnpm run build（Turborepo 并行构建 web + api）
5. 构建 Docker 镜像（web + api）
6. 推送镜像到 GitHub Container Registry（ghcr.io）
7. SSH 连接服务器
8. 拉取最新镜像
9. docker compose up -d --no-deps web api
10. docker system prune -f（清理旧镜像）
```

### 环境变量管理

- 开发：`.env.local`（不提交 Git）
- 生产：**`/etc/personal-hub/.env`**（手动维护，软链到 `/opt/personal-hub/.env`）
- 阶段 A：mock 模式几乎不需要生产 `.env`
- 阶段 B 起：`DATABASE_URL`、`REDIS_URL`、`COS_*`、`JWT_SECRET` 等见 [personal-remote-reading.md §6.5](./personal-remote-reading.md#65-配置环境变量)
- CI/CD Secrets：`SSH_HOST`、`SSH_USER`、`SSH_KEY`（Gitee Go / GitHub Actions 共用）

---

## Nginx 配置要点

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    # SSL 证书
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Next.js 前端
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # NestJS API（SSE 需要关闭缓冲）
    location /api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding on;
        proxy_buffering off;
        proxy_cache off;
    }
}

# HTTP 强制跳转 HTTPS
server {
    listen 80;
    return 301 https://$host$request_uri;
}
```

---

## HTTPS 证书管理

- **工具**：Let's Encrypt + Certbot
- **自动续期**：`certbot renew --quiet`，通过 crontab 每天执行两次检查
  ```
  0 3,15 * * * certbot renew --quiet && nginx -s reload
  ```
- **证书有效期**：90 天，Certbot 在到期前 30 天自动续期

---

## 数据备份策略

### PostgreSQL 备份

```bash
# /opt/scripts/backup-postgres.sh
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U prod personal_hub | gzip > /data/backups/postgres_$DATE.sql.gz

# 保留最近 7 天
find /data/backups -name "postgres_*.sql.gz" -mtime +7 -delete
```

- **执行频率**：每天凌晨 2:00
- **保留策略**：本地保留 7 天，每周一份同步到对象存储（OSS/COS）保留 30 天
- **crontab**：`0 2 * * * /opt/scripts/backup-postgres.sh`

### 文件备份

- `/data/uploads`（用户上传文件）每天 rsync 到备用路径或对象存储
- 首版简化：每周手动备份到本地

### Redis 备份

- Redis 开启 RDB 持久化（`save 900 1`），已落盘，随磁盘快照备份
- 数据为缓存+Session，丢失可接受，不单独备份

---

## 监控（后续）

- 首版：无独立监控，依赖 Nginx access log + Docker 容器日志
- 后续接入：Uptime Kuma（可用性监控）+ Loki + Grafana（日志聚合）
