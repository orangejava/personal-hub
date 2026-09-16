# 生产服务器软件安装与检查清单

> 状态：🟢 首版 Compose 上线前置清单（2026-09-15）
> 适用：腾讯云服务器、Ubuntu、`/opt/personal-hub/`、公网 IP + HTTP 首版
> 下一步：[首次上线检查清单](./prod-startup-order.md) · [生产操作手册](./production-runbook.md)

本文件只负责确认服务器基础环境，不负责应用发布、数据库迁移和业务验收。

## 1. 当前首版需要的软件

| 软件 / 能力 | 是否需要 | 用途 |
| --- | --- | --- |
| Ubuntu 服务器 | 必须 | 运行生产容器 |
| SSH + sudo | 必须 | 登录和初始化服务器 |
| Docker Engine | 必须 | 运行 PostgreSQL、Redis、Nest、Worker、Nginx |
| Docker Compose 插件 | 必须 | 执行 `docker compose` |
| Git | 必须 | 从 Gitee 拉取项目 |
| curl | 必须 | 健康检查和网络验证 |
| ca-certificates | 必须 | HTTPS、Docker 和 Git 证书校验 |
| openssl | 推荐 | 生成密码和 JWT 密钥 |
| rsync | 可选 | 从本地传输临时小册源文件 |

## 2. 当前首版不需要在宿主机安装的软件

以下软件由 Compose 或后续域名阶段负责，当前不要按旧 PM2 文档安装：

| 软件 | 当前是否安装 | 原因 |
| --- | --- | --- |
| Node.js / pnpm | 不需要 | Nest、Worker 和前端构建在 Docker 镜像内完成 |
| PM2 | 不需要 | 当前生产使用 Compose，不使用 PM2 |
| 宿主机 Nginx | 不需要 | Nginx 位于 `compose.prod.yml` 的 `nginx` 容器 |
| Certbot | 暂不需要 | 当前使用公网 IP + HTTP，没有域名和证书 |
| MinIO | 不需要 | 生产对象存储使用腾讯 COS |
| Mailpit | 不需要 | 生产邮件使用 QQ SMTP |
| PostgreSQL | 不需要单独安装 | 使用 Compose 的 PostgreSQL 容器 |
| Redis | 不需要单独安装 | 使用 Compose 的 Redis 容器 |

域名、HTTPS、Certbot 只在后续域名阶段再准备。阶段 A 的 PM2、Node 和本地小册
同步方案仅保留在 `old/`，不作为当前上线依据。

## 3. 服务器首次安装

以下命令在服务器执行。具体 Docker 官方仓库安装方式可能随 Ubuntu 版本变化，
安装后必须以版本检查结果为准。

```bash
sudo apt update
sudo apt install -y git curl ca-certificates openssl rsync
```

安装 Docker Engine 和 Compose 插件后检查：

```bash
docker --version
docker compose version
sudo systemctl is-enabled docker
sudo systemctl is-active docker
```

如果当前登录用户需要免 sudo 执行 Docker：

```bash
sudo usermod -aG docker "$USER"
```

执行后退出 SSH 并重新登录，再验证：

```bash
docker ps
```

不要把 Docker 组权限授予不可信用户。

## 4. 服务器资源检查

```bash
uname -a
cat /etc/os-release
whoami
pwd
free -h
df -h
```

检查项目目录和数据源目录：

```bash
ls -ld /opt /opt/personal-hub
ls -ld /data /data/personal-hub /data/personal-hub/content-local
```

当前目录约定：

```text
/opt/personal-hub/                 # 项目代码
/data/personal-hub/content-local/  # 一次性小册源文件
```

不要在 `/opt/personal-hub/content-local/` 创建小册实体副本。

## 5. 网络、安全组和端口

云安全组首版至少检查：

| 端口 | 用途 | 建议 |
| --- | --- | --- |
| 22 | SSH | 只允许自己的公网出口 IP |
| 80 | Nginx HTTP | 首版公网访问 |
| 443 | HTTPS | 当前暂不开放，域名和证书阶段再开 |
| 3001 | Nest 容器内部端口 | 不开放公网 |
| 5432 | PostgreSQL | 不开放公网 |
| 6379 | Redis | 不开放公网 |
| 8000 / 8001 | 阶段 A 前端 | 当前 Nest 生产不开放 |

服务器内检查监听端口：

```bash
sudo ss -lntp
curl -I http://127.0.0.1
```

`5432`、`6379`、`3001` 不应成为公网访问入口。

## 6. Git 和项目目录检查

```bash
sudo mkdir -p /opt/personal-hub
sudo chown -R "$USER:$USER" /opt/personal-hub
cd /opt/personal-hub
```

首次拉取：

```bash
git clone https://gitee.com/oralemon/personal-hub.git .
git status
git log -1 --oneline
```

已有项目则检查：

```bash
cd /opt/personal-hub
git status --short
git remote -v
git pull --ff-only
```

生产服务器不要保存真实 `.env.prod` 到 Git，也不要把 `.env.prod` 放进镜像构建上下文
之外可公开读取的位置。

## 7. Compose 和镜像构建前检查

```bash
cd /opt/personal-hub
test -f compose.prod.yml
test -f apps/server/Dockerfile
test -f deploy/nginx/Dockerfile
test -f .env.prod
chmod 600 .env.prod
docker compose --env-file .env.prod -f compose.prod.yml config --quiet
```

检查通过只表示 Compose 文件和变量插值有效，不代表 COS、SMTP 或 AI 网络已经可用。

## 8. Docker 镜像源故障

如果构建出现以下错误：

```text
failed size validation
failed to copy ... EOF
```

优先判断为 Docker Registry mirror 或网络缓存异常，不要先修改应用 Dockerfile。检查当前
Docker 镜像源：

```bash
docker info | grep -A5 -i "registry mirrors"
docker pull node:22-bookworm-slim
docker pull nginx:1.27-alpine
```

处理方式按服务器环境选择其一：

1. 切换到稳定的 Docker Hub 网络或企业镜像仓库；
2. 更换可用的 Registry mirror 后重启 Docker；
3. 在网络正常的机器预拉取并推送到自己的镜像仓库，再让服务器从该仓库构建或拉取。

只有基础镜像能够稳定 `docker pull` 后，才重新执行生产 Compose 构建。

## 9. 上线前必须确认的外部服务

- COS Bucket、地域、CAM 子用户权限；
- QQ SMTP 授权码；
- `MAIL_FROM` 与 QQ 发件地址一致；
- `PUBLIC_APP_ORIGIN` 为公网 IP；
- `COOKIE_SECURE=false` 用于当前 HTTP 首版；
- 真实 AI 的 Provider、Base URL、API Key、模型名；
- 服务器可访问 COS、QQ SMTP 和 AI 厂商地址。

外部服务的具体验证见：

- [腾讯云准备](./tencent-cloud-prep.md)；
- [生产操作手册](./production-runbook.md)；
- [COS 与真实 AI 联测](./production-runbook.md#7-cos与真实-ai联测)。
