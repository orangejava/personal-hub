# 部署方案

> 状态：已完成细化（含 React-first 当前阶段说明）
> 最后更新：2026-07-21
>
> **个人远程阅读 + COS 小册方案**（Ubuntu 24.04 / 生产级架构适配）见 [personal-remote-reading.md](./personal-remote-reading.md)；一页速查见 [server-deployment-guide.md](./server-deployment-guide.md)。  
> 本目录由 `docs/operations/` 更名为 `docs/deploy/`。

---

## 当前阶段：React-first 本地开发

在 **阶段 6 接入 NestJS 之前**，日常开发以 `apps/react-web` 为主：

| 项 | 方式 |
|---|---|
| 启动 | 仓库根目录 `pnpm dev:react`（或 `pnpm --filter react-web dev`） |
| 数据 | Umi mock，无需 PostgreSQL |
| Docker | **可选**；仅当提前演练文件/搜索时再启 MinIO、Meilisearch |

长期生产结构（Next.js + NestJS + Docker）见下文；**当前不必按生产拓扑搭建本地环境**。

---

## 本地开发（Docker Compose，长期全栈）

```yaml
# docker-compose.yml（开发环境）
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: personal_hub
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev123
    ports: ["5432:5432"]
    volumes: ["postgres_data:/var/lib/postgresql/data"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports: ["9000:9000", "9001:9001"]
    volumes: ["minio_data:/data"]

  meilisearch:
    image: getmeili/meilisearch:v1.7
    ports: ["7700:7700"]
    environment:
      MEILI_MASTER_KEY: devmasterkey
    volumes: ["meili_data:/meili_data"]
```

- **React-first 阶段**：`react-web` 在宿主机运行（`pnpm dev:react`），不进 Docker
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
    ├── / → Next.js（端口 3000）
    ├── /api → NestJS（端口 3001）
    └── /minio → MinIO（端口 9000，可选）

本机服务
    ├── PostgreSQL（端口 5432，仅内网）
    ├── Redis（端口 6379，仅内网）
    ├── MinIO（端口 9000/9001）
    └── Meilisearch（端口 7700，仅内网，后续）
```

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
    ports: ["3000:3000"]
    restart: unless-stopped

  api:
    image: personal-hub-api:latest
    build: ./apps/api
    environment:
      - DATABASE_URL=postgresql://...
      - REDIS_URL=redis://redis:6379
    ports: ["3001:3001"]
    depends_on: [postgres, redis]
    restart: unless-stopped

  postgres:
    image: postgres:16
    volumes: ["/data/postgres:/var/lib/postgresql/data"]
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes: ["/data/redis:/data"]
    restart: unless-stopped

  minio:
    image: minio/minio
    volumes: ["/data/minio:/data"]
    restart: unless-stopped
```

---

## CI/CD 流程

**工具：GitHub Actions + SSH 部署**

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
- 生产：服务器上 `/opt/personal-hub/.env`（手动维护）
- GitHub Actions 需要的 Secrets：`SSH_HOST`、`SSH_USER`、`SSH_KEY`

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
