# 生产服务器软件安装与检查清单

> 状态：🟢 首版 Compose 上线前置清单（2026-09-16）
> 适用：腾讯云服务器、Ubuntu 22.04 / 24.04、`/opt/personal-hub/`、公网 IP + HTTP 首版
> 下一步：[首次上线检查清单](./prod-startup-order.md) · [生产操作手册](./production-runbook.md)

本文件只负责确认服务器基础环境，不负责应用发布、数据库迁移和业务验收。

软件按「先检查 → 对照通过标准 → 不通过再安装 → 再检查一次」处理。不要先盲装。

## 1. 当前首版需要的软件

| 软件 / 能力         | 是否需要 | 用途                                        | 检查与安装                     |
| ------------------- | -------- | ------------------------------------------- | ------------------------------ |
| Ubuntu 服务器       | 必须     | 运行生产容器                                | [3.1](#31-ubuntu-系统)         |
| SSH + sudo          | 必须     | 登录和初始化服务器                          | [3.2](#32-ssh-与-sudo)         |
| Git                 | 必须     | 从 Gitee 拉取项目                           | [3.3](#33-git)                 |
| curl                | 必须     | 健康检查和网络验证                          | [3.4](#34-curl)                |
| ca-certificates     | 必须     | HTTPS、Docker 和 Git 证书校验               | [3.5](#35-ca-certificates)     |
| openssl             | 推荐     | 生成密码和 JWT 密钥                         | [3.6](#36-openssl)             |
| rsync               | 可选     | 从本地传输临时小册源文件                    | [3.7](#37-rsync)               |
| Docker Engine       | 必须     | 运行 PostgreSQL、Redis、Nest、Worker、Nginx | [3.8](#38-docker-engine)       |
| Docker Compose 插件 | 必须     | 执行 `docker compose`                       | [3.9](#39-docker-compose-插件) |

## 2. 当前首版不需要在宿主机安装的软件

以下软件由 Compose 或后续域名阶段负责，当前不要按旧 PM2 文档安装：

| 软件           | 当前是否安装   | 原因                                          |
| -------------- | -------------- | --------------------------------------------- |
| Node.js / pnpm | 不需要         | Nest、Worker 和前端构建在 Docker 镜像内完成   |
| PM2            | 不需要         | 当前生产使用 Compose，不使用 PM2              |
| 宿主机 Nginx   | 不需要         | Nginx 位于 `compose.prod.yml` 的 `nginx` 容器 |
| Certbot        | 暂不需要       | 当前使用公网 IP + HTTP，没有域名和证书        |
| MinIO          | 不需要         | 生产对象存储使用腾讯 COS                      |
| Mailpit        | 不需要         | 生产邮件使用 QQ SMTP                          |
| PostgreSQL     | 不需要单独安装 | 使用 Compose 的 PostgreSQL 容器               |
| Redis          | 不需要单独安装 | 使用 Compose 的 Redis 容器                    |

域名、HTTPS、Certbot 只在后续域名阶段再准备。阶段 A 的 PM2、Node 和本地小册
同步方案仅保留在 `old/`，不作为当前上线依据。

服务器上如果还在跑阶段 A 的 `pm2`（进程名通常是 `personal-hub-dev`，端口 8000），
先按 [生产操作手册 3.0](./production-runbook.md#30-停掉旧-pm2再清理代码目录) 停掉并清理
`/opt/personal-hub`，再安装 Docker 和重新 clone。不要删 `/data/personal-hub/`。

## 3. 软件检查与安装

以下命令默认在服务器上执行。`apt update` 很慢或失败时，先把 Ubuntu 软件源换成腾讯云镜像，
再继续安装；不要同时安装 `docker-ce` 和 Ubuntu 自带的 `docker.io`。

### 3.0 一次跑完基础检查

先整段执行，对照后面各节判断缺什么：

```bash
echo "=== OS ==="
(. /etc/os-release && echo "$ID $VERSION_ID $(uname -m)")  # 子 shell 读取，避免污染当前环境变量

echo "=== user / sudo / ssh ==="
whoami
id  # 看是否在 sudo / docker 组
sudo -n true && echo "sudo: ok" || echo "sudo: need password or missing"  # -n 不弹密码；失败只说明需要密码或没有 sudo
systemctl is-active ssh 2>/dev/null || systemctl is-active sshd 2>/dev/null || echo "ssh: not active"  # Ubuntu 服务名可能是 ssh 或 sshd

echo "=== packages ==="
git --version
curl --version | head -n1
dpkg -s ca-certificates | awk '/^Status:|^Version:/ {print}'  # 看包是否真正安装，不要只看命令在不在
openssl version
rsync --version | head -n1  # 可选，未安装可忽略

echo "=== docker ==="
docker --version
docker compose version  # 必须是带空格的 Compose V2，不是 docker-compose
sudo systemctl is-enabled docker  # 开机是否自启
sudo systemctl is-active docker   # 当前是否在跑
```

某项输出 `command not found`、`inactive` 或证书错误，就按对应小节安装，不要跳过复查。
`rsync` 是可选的，未安装可以先忽略。

### 3.1 Ubuntu 系统

检查：

```bash
cat /etc/os-release  # 看 ID 和 VERSION_ID
uname -m             # 应为 x86_64
```

通过标准：

- `ID=ubuntu`
- `VERSION_ID` 为 `22.04` 或 `24.04`
- 架构为 `x86_64`

失败后：

- 不是 Ubuntu，或大版本不是 22.04 / 24.04：不要按本文继续装 Docker。到腾讯云控制台重装为 Ubuntu 22.04 或 24.04 公共镜像。
- 重装系统盘会清空系统盘数据。数据盘上的 `/data` 一般还在，但 `/opt` 若在系统盘上会丢失。
- 架构不是 `x86_64`：当前生产文档未覆盖，先停下来另评估。

### 3.2 SSH 与 sudo

检查：

```bash
whoami
id          # 确认在 sudo 组
sudo -v     # 刷新 sudo 凭证，会要一次密码
systemctl is-active ssh || systemctl is-active sshd
```

通过标准：

- 能用 SSH 登录这台服务器
- `sudo -v` 输入当前用户密码后成功（不要求免密 sudo）
- ssh 服务为 `active`

失败后：

- 完全连不上 SSH：用腾讯云控制台「登录」/ VNC，先修网络和安全组 22 端口，再查 ssh 服务。
- 没有 sudo：用 root 执行 `usermod -aG sudo <用户名>`，然后重新登录。
- ssh 服务未安装或未启动：

```bash
sudo apt update
sudo apt install -y openssh-server
sudo systemctl enable --now ssh  # 立即启动并设为开机自启
sudo systemctl is-active ssh || sudo systemctl is-active sshd
```

### 3.3 Git

检查：

```bash
command -v git  # 在 PATH 中才算装好
git --version
```

通过标准：输出 `git version 2.x`。

失败后：

```bash
sudo apt update
sudo apt install -y git
git --version
```

装好后再测能否访问代码仓库：

```bash
git ls-remote https://gitee.com/oralemon/personal-hub.git HEAD  # 只探测仓库可达，不拉取代码
```

这里失败通常是网络、DNS 或证书问题，不是 Git 没装好。证书问题转到 [3.5](#35-ca-certificates)。

### 3.4 curl

检查：

```bash
command -v curl
curl --version | head -n1
curl -I https://gitee.com  # 只取响应头，验证 HTTPS 和 DNS
```

通过标准：

- 能打印版本
- `curl -I https://gitee.com` 返回 HTTP 状态，而不是 `Could not resolve host` 或证书错误

失败后：

```bash
sudo apt update
sudo apt install -y curl
curl --version | head -n1
```

`curl` 已安装但仍证书失败，转到 [3.5](#35-ca-certificates)。

### 3.5 ca-certificates

检查：

```bash
dpkg -s ca-certificates
curl -I https://gitee.com
curl -I https://mirrors.cloud.tencent.com  # 同时验证系统证书和腾讯云镜像 HTTPS
```

通过标准：

- `Status: install ok installed`
- HTTPS 请求没有 `certificate problem` / `unable to get local issuer certificate`

失败后：

```bash
sudo apt update
sudo apt install -y ca-certificates
sudo update-ca-certificates  # 把证书装进系统信任库
curl -I https://gitee.com
```

### 3.6 openssl

检查：

```bash
command -v openssl
openssl version
openssl rand -hex 32  # 生成 32 字节随机串，可作 JWT / 数据库密码
```

通过标准：能打印版本，并能生成一段十六进制随机串。

失败后：

```bash
sudo apt update
sudo apt install -y openssl
openssl version
```

当前首版用它生成数据库密码和 JWT 密钥。未安装时不要用可预测的短字符串代替。

### 3.7 rsync

可选。只有需要从本地把小册源文件传到 `/data/personal-hub/content-local/` 时才装。

检查：

```bash
command -v rsync  # 未安装可忽略，不影响 Compose 启动
rsync --version | head -n1
```

通过标准：能打印版本。

失败后：

```bash
sudo apt update
sudo apt install -y rsync
rsync --version | head -n1
```

不装 rsync 也可以用 `scp` 传文件，不影响 Compose 启动。

### 3.8 Docker Engine

检查：

```bash
command -v docker
docker --version
sudo systemctl is-enabled docker
sudo systemctl is-active docker
sudo docker info >/dev/null && echo "docker info: ok"  # 引擎真正可用，不只是有 docker 命令
```

通过标准：

- 能打印 `Docker version`，建议 24 或更高
- `is-enabled` 为 `enabled`
- `is-active` 为 `active`
- `sudo docker info` 成功

常见失败：

| 现象                      | 原因                     | 处理                                          |
| ------------------------- | ------------------------ | --------------------------------------------- |
| `command not found`       | 未安装                   | 按下面安装                                    |
| `inactive` / `disabled`   | 已安装但未启动           | 见 [3.10](#310-docker-开机自启与当前用户权限) |
| `permission denied`       | 当前用户不在 `docker` 组 | 见 [3.10](#310-docker-开机自启与当前用户权限) |
| `docker compose` 不是命令 | 缺 Compose 插件          | 见 [3.9](#39-docker-compose-插件)             |

安装前先看是否已经有一套 Docker，避免混装：

```bash
dpkg -l | awk '/docker|containerd/ {print $1, $2, $3}'  # 看是否已有 docker-ce 或 docker.io，避免混装
```

选定下面两种方式之一，不要两种都装。

**方式 A（推荐，腾讯云 CVM）：Docker CE + 腾讯云镜像**

```bash
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings  # 存放 Docker 仓库签名密钥
sudo curl -fsSL https://mirrors.cloud.tencent.com/docker-ce/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc  # 腾讯云镜像的 Docker CE 公钥
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://mirrors.cloud.tencent.com/docker-ce/linux/ubuntu \
  $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
# 写入 Docker CE apt 源；国内 CVM 不要用 download.docker.com

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin  # Engine 和 Compose V2 一起装
sudo systemctl enable --now docker  # 立即启动并开机自启
docker --version
docker compose version
sudo systemctl is-active docker
```

如果 `curl` 拉 GPG 失败，先确认 [3.4](#34-curl) 和 [3.5](#35-ca-certificates) 已通过，再重试。

**方式 B（备选）：Ubuntu 仓库** `docker.io`

官方 CE 源不可用，且这是空的新机器时再用：

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2  # Ubuntu 仓库备选；不要再同时装 docker-ce
sudo systemctl enable --now docker
docker --version
docker compose version
sudo systemctl is-active docker
```

不要用 `snap install docker`。也不要为了「再装一份」同时保留 `docker-ce` 和 `docker.io`。

如果机器上已经有 `docker.io` 且容器正在跑，先停下来确认没有要保留的数据，再改成方式 A。

安装后必须再跑本节开头的检查命令。`hello-world` 镜像依赖 Docker Hub，国内可能拉不下来，不能单独用它判断 Docker 是否装好；以 `docker --version` 和 `sudo docker info` 为准。基础镜像拉取见 [第 8 节](#8-docker-镜像源故障)。

### 3.9 Docker Compose 插件

检查：

```bash
docker compose version
```

注意是带空格的 `docker compose`，不是旧命令 `docker-compose`。

通过标准：输出 `Docker Compose version v2.x`。

失败后：

- 已按方式 A 安装 Docker CE：

```bash
sudo apt update
sudo apt install -y docker-compose-plugin  # Docker CE 对应的 Compose V2 插件
docker compose version
```

- 已按方式 B 安装 `docker.io`：

```bash
sudo apt update
sudo apt install -y docker-compose-v2  # docker.io 对应的 Compose V2 包
docker compose version
```

- 只有旧的 `docker-compose`（带连字符）且版本是 1.x：不要继续用它发生产。装上面的 Compose V2 插件，之后统一用 `docker compose`。

### 3.10 Docker 开机自启与当前用户权限

检查：

```bash
sudo systemctl is-enabled docker
sudo systemctl is-active docker
groups | grep docker || true  # 当前会话看不到新组时，需要重新登录
docker ps
```

通过标准：

- Docker 开机自启且当前为 `active`
- 当前用户执行 `docker ps` 不需要 sudo，也不报 `permission denied`

失败后，先启动服务：

```bash
sudo systemctl enable --now docker  # 立即启动并开机自启
sudo systemctl is-active docker
```

如果 `docker ps` 报权限错误，把当前用户加入 `docker` 组：

```bash
sudo usermod -aG docker "$USER"  # -a 追加组，不要丢掉用户已有组
```

执行后必须退出 SSH 并重新登录，再验证：

```bash
groups | grep docker
docker ps  # 不报 permission denied 才算生效
```

不要把 Docker 组权限授予不可信用户。

### 3.11 安装后总复查

缺什么装什么之后，再跑一遍 [3.0](#30-一次跑完基础检查)。全部通过后，才进入第 4 节资源和目录检查。

## 4. 服务器资源检查

```bash
uname -a
cat /etc/os-release
whoami
pwd
free -h  # 内存；2C4G 机器启动全部容器后剩余不要长期接近 0
df -h    # 磁盘；重点看 / 和 /data
```

检查项目目录和数据源目录：

```bash
ls -ld /opt /opt/personal-hub  # 代码目录；不存在时下一节再创建
ls -ld /data /data/personal-hub /data/personal-hub/content-local  # 小册源在数据盘，不要放到 /opt 下
```

当前目录约定：

```text
/opt/personal-hub/                 # 项目代码
/data/personal-hub/content-local/  # 一次性小册源文件
```

不要在 `/opt/personal-hub/content-local/` 创建小册实体副本。

## 5. 网络、安全组和端口

云安全组首版至少检查：

| 端口        | 用途              | 建议                             |
| ----------- | ----------------- | -------------------------------- |
| 22          | SSH               | 只允许自己的公网出口 IP          |
| 80          | Nginx HTTP        | 首版公网访问                     |
| 443         | HTTPS             | 当前暂不开放，域名和证书阶段再开 |
| 3001        | Nest 容器内部端口 | 不开放公网                       |
| 5432        | PostgreSQL        | 不开放公网                       |
| 6379        | Redis             | 不开放公网                       |
| 8000 / 8001 | 阶段 A 前端       | 当前 Nest 生产不开放             |

服务器内检查监听端口：

```bash
sudo ss -lntp  # 看谁在监听；5432 / 6379 / 3001 不应对公网
curl -I http://127.0.0.1  # 本机 80；首次装完、Compose 未启动前失败是正常的
```

`5432`、`6379`、`3001` 不应成为公网访问入口。

## 6. Git 和项目目录检查

```bash
sudo mkdir -p /opt/personal-hub
sudo chown -R "$USER:$USER" /opt/personal-hub  # 后续 git 用当前用户，不要一直 sudo
cd /opt/personal-hub
```

首次拉取：

```bash
git clone https://gitee.com/oralemon/personal-hub.git .  # 点号表示克隆进当前目录，不要再套一层子目录
git status
git log -1 --oneline
```

已有项目则检查：

```bash
cd /opt/personal-hub
git status --short  # 工作区应干净
git remote -v
git pull --ff-only  # 只快进，避免生产产生合并提交
```

生产服务器不要保存真实 `.env.prod` 到 Git，也不要把 `.env.prod` 放进镜像构建上下文
之外可公开读取的位置。

如果 `git pull` 报 `detected dubious ownership in repository`：

```bash
whoami                          # 应为日常操作用户，例如 deploy
ls -ld /opt/personal-hub        # 看目录属主；常见是 root 建目录、deploy 去 pull
ls -ld /opt/personal-hub/.git
sudo chown -R "$USER:$USER" /opt/personal-hub  # 把代码目录交给当前用户
chmod 600 /opt/personal-hub/.env.prod 2>/dev/null || true  # chown 后重新收紧密钥权限
git status --short
git pull --ff-only
```

不要用 `sudo git pull`。也不要先执行 Git 提示的 `safe.directory`：那只是绕过属主检查，
目录仍可能无法写入。只有属主必须保持为 root、且当前用户只读操作时，才考虑：

```bash
git config --global --add safe.directory /opt/personal-hub  # 仅无法 chown 时的兜底
```

## 7. Compose 和镜像构建前检查

```bash
cd /opt/personal-hub
test -f compose.prod.yml          # 文件不存在时退出码非 0
test -f apps/server/Dockerfile
test -f deploy/nginx/Dockerfile
test -f .env.prod
chmod 600 .env.prod               # 仅当前用户可读写密钥
docker compose --env-file .env.prod -f compose.prod.yml config --quiet  # 校验变量插值；成功无输出，不要去掉 --quiet
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
docker info | grep -A5 -i "registry mirrors"  # 看当前镜像加速器
docker pull node:22-bookworm-slim             # 先验证基础镜像能拉，再构建业务镜像
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
