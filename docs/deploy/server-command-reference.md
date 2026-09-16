# 服务器命令参考手册

> 状态：当前 Compose 首版的命令聚合说明（2026-09-16）
> 适用：Ubuntu 22.04 / 24.04、`/opt/personal-hub/`、Docker Compose、公网 IP + HTTP 首版
> 上线顺序仍以 [production-runbook.md](./production-runbook.md) 为准；本页解释命令，不替代发布步骤。

本页聚合当前有效部署文档中出现的服务器命令，按工具、用途和风险说明它们的含义。`docs/deploy/old/` 与 `scripts/deploy-server.sh` 的 PM2 命令属于阶段 A，只用于识别、停止旧服务，不能用于当前 Nest Compose 生产发布。

## 1. 风险标记与固定前缀

| 标记 | 含义 | 示例 |
| --- | --- | --- |
| 只读 | 查看状态，不启动、不写入、不删除 | `docker compose ps`、`docker volume ls`、`curl -I` |
| 改运行状态 | 启动、停止或重启服务，通常保留数据 | `docker compose up`、`restart`、`down` |
| 写入数据 | 写数据库、COS 或宿主机文件 | migration、seed、备份、正式导入 |
| 高风险 | 可能删除数据、配置或代码 | `down -v`、`docker volume prune`、`rm -rf` |

生产 Compose 命令默认在服务器项目目录执行：

```bash
cd /opt/personal-hub
export COMPOSE="docker compose --env-file .env.prod -f compose.prod.yml"
```

`--env-file .env.prod` 读取生产密钥，`-f compose.prod.yml` 选择生产编排文件。`export` 仅在当前终端会话有效，之后可用 `$COMPOSE ps` 代替完整命令。

## 2. Shell、文件与系统检查

| 命令 | 作用 | 风险 / 使用时机 |
| --- | --- | --- |
| `pwd` | 显示当前目录 | 只读；clone、删除前先确认位置 |
| `cd /opt/personal-hub` | 切换到项目目录 | 不修改文件 |
| `whoami` / `id` / `groups` | 查看当前用户、用户组与权限 | 只读；排查 sudo / Docker 权限 |
| `sudo -v` | 验证并刷新 sudo 凭证 | 会要求输入密码，不改业务配置 |
| `cat /etc/os-release` / `uname -m` | 查看 Ubuntu 版本与 CPU 架构 | 只读；当前文档按 Ubuntu x86_64 编写 |
| `free -h` / `df -h` | 查看内存 / 磁盘 | 只读；重点看 `/`、`/data` |
| `du -sh /opt/personal-hub /data/personal-hub` | 汇总代码和数据目录大小 | 只读；磁盘排障 |
| `ls -ld <路径>` / `ls -la <路径>` | 查看路径存在性、属主、权限、内容 | 只读 |
| `test -f <文件>` | 判断文件是否存在 | 只读；存在时退出码为 0 |
| `find <目录> -maxdepth 2 -type f \| head -20` | 预览前 20 个文件 | 只读；用于检查小册导入源 |

### 2.1 Shell 组合符号

部署文档中的以下写法用于控制命令输出和失败行为，本身不是新的服务：

| 写法 | 含义 | 本项目中的用途 |
| --- | --- | --- |
| `cmd1 \| cmd2` | 将左边标准输出传给右边 | `grep` 过滤端口、`awk` 筛选非敏感环境变量、`tee` 写软件源 |
| `cmd1 && cmd2` | 只有 `cmd1` 成功才执行 `cmd2` | 检查 `.env.prod` 存在后再备份 |
| `cmd1 \|\| cmd2` | 左边失败时执行右边 | 尝试 `ssh` 服务名后再尝试 `sshd`；允许可选检查失败 |
| `2>/dev/null` | 丢弃标准错误输出 | 对可选旧服务、可能不存在的文件保持脚本安静 |
| `> 文件` | 将标准输出写入文件，已有文件会覆盖 | 将 `pg_dump` 输出写入新的带时间戳备份文件 |
| `$(cmd)` | 用命令输出替换当前位置 | 生成备份时间戳、读取系统架构或 Ubuntu 代号 |
| `head -n1` / `grep` / `awk` | 截断或过滤输出 | 只显示版本第一行、过滤端口和敏感变量；不会改原始数据 |
| `true` | 总是以成功退出 | 与 `\|\| true` 配合，让“没有匹配结果”不阻断后续检查 |

### 2.2 环境文件和随机密钥

```bash
cp -a .env.prod ~/env.prod.before-first-compose.bak
cp .env.prod.example .env.prod
chmod 600 .env.prod
openssl rand -hex 32
vi .env.prod
```

| 命令 | 作用 | 注意 |
| --- | --- | --- |
| `cp -a` | 备份 `.env.prod`，保留权限和时间属性 | 会创建备份；不要提交 Git |
| `cp .env.prod.example .env.prod` | 根据模板创建生产环境文件 | 会覆盖同名文件；只有 `.env.prod` 尚不存在时才能执行 |
| `chmod 600` | 仅当前用户可读写密钥文件 | 会改变权限；生产必须执行 |
| `openssl rand -hex 32` | 生成 32 字节随机十六进制文本 | 每个密码 / JWT 密钥使用不同结果；hex 可直接放入连接串 |
| `vi .env.prod` | 编辑生产配置 | 会修改文件；不要发送文件内容 |

`POSTGRES_PASSWORD` 与 `DATABASE_URL` 必须使用同一个值，`REDIS_PASSWORD` 与 `REDIS_URL` 同理；数据库、Redis、两个 JWT 密钥应分别生成。

## 3. Git 与代码目录

```bash
git status --short
git log -1 --oneline
git remote -v
git pull --ff-only
git clone https://gitee.com/oralemon/personal-hub.git .
```

| 命令 | 作用 | 注意 |
| --- | --- | --- |
| `git status --short` | 简洁显示工作区改动 | 只读；发布前应干净，`.env.prod` 不应出现 |
| `git log -1 --oneline` | 显示当前部署 commit | 只读；发布和回滚记录它 |
| `git rev-parse --short HEAD` | 只输出当前 `HEAD` 的短 commit ID | 只读；上线验收时确认访问的代码版本 |
| `git remote -v` | 显示 Gitee / GitHub 远程地址 | 只读 |
| `git ls-remote <仓库> HEAD` | 只探测远程仓库及网络是否可达 | 只读；不下载代码 |
| `git pull --ff-only` | 仅快进方式更新代码 | 会更新代码；有分叉时停止，不在生产自动合并 |
| `git clone ... .` | 第一次将代码克隆进当前目录 | 会写代码；末尾 `.` 防止多套一层目录，已有 `.git` 时不可重复执行 |

属主导致 `dubious ownership` 时：

```bash
ls -ld /opt/personal-hub /opt/personal-hub/.git
sudo chown -R "$USER:$USER" /opt/personal-hub
git config --global --add safe.directory /opt/personal-hub
```

第一条只读。`chown -R` 会递归修改项目属主，用于修复 root 创建、deploy 更新代码的问题。`safe.directory` 只是 Git 信任兜底，不能解决写权限，只有目录必须保持 root 属主时才用。

## 4. Ubuntu 与 Docker Engine

### 4.1 软件、网络和证书检查

```bash
command -v git
git --version
curl --version | head -n1
curl -I https://gitee.com
dpkg -s ca-certificates
openssl version
rsync --version | head -n1
```

这些均是只读检查：`command -v` 判断命令是否在 PATH；`curl -I` 只获取 HTTP Header，用于验证 DNS、网络和证书；`dpkg -s` 显示软件包安装状态。`rsync` 仅在上传小册源文件时需要。

```bash
sudo apt update
sudo apt install -y git curl ca-certificates openssl
sudo apt install -y rsync
```

`apt update` 刷新包索引，`apt install` 会安装或升级软件，均会改变系统状态。Docker CE 的 apt 源、公钥与 `docker.io` 备选方案以 [production-prerequisites.md](./production-prerequisites.md#38-docker-engine) 为准；不要混装 `docker-ce` 和 `docker.io`。

### 4.2 首次配置 Docker CE 软件源

首次安装且已经确认机器上没有另一套 Docker 时，前置文档会使用下面这组命令。它们只用于安装 Docker，不属于日常发布命令。

```bash
sudo update-ca-certificates
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://mirrors.cloud.tencent.com/docker-ce/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] ..." \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

| 命令 / 参数 | 作用 | 风险 / 注意 |
| --- | --- | --- |
| `update-ca-certificates` | 将已安装的 CA 证书更新到系统信任库 | 改变系统证书缓存；仅在证书包安装或修复后使用 |
| `install -m 0755 -d` | 创建 keyring 目录并设定目录权限 | 会写入 `/etc/apt`；不是安装应用程序 |
| `curl -fsSL ... -o docker.asc` | 下载 Docker CE 仓库的 GPG 公钥到指定文件 | `-f` 将 HTTP 失败视为错误，`-sS` 降低正常输出但保留错误，`-L` 跟随重定向；需要核对来源与路径 |
| `chmod a+r docker.asc` | 允许 apt 读取公钥 | 会修改文件权限；只针对公钥文件 |
| `dpkg --print-architecture` | 输出当前 Debian/Ubuntu 包架构，例如 `amd64` | 只读；用于生成与机器匹配的软件源行 |
| `echo ... \| sudo tee ... > /dev/null` | 以 sudo 将 Docker 软件源行写进 `/etc/apt/sources.list.d/docker.list` | 会覆盖该文件；`tee` 必须在 sudo 后，末尾重定向仅隐藏回显，不会取消写入 |

先用 `dpkg -l | awk '/docker|containerd/ {print $1, $2, $3}'` 查看已安装的 Docker / containerd 包。`awk` 按匹配行提取列，只读；若已有正在使用的 `docker.io` 或 `docker-ce`，不要直接追加另一套软件源或混装软件包。

### 4.3 Docker / Compose 检查与服务管理

```bash
docker --version
docker compose version
sudo systemctl is-enabled docker
sudo systemctl is-active docker
sudo docker info >/dev/null && echo "docker info: ok"
docker ps
docker ps -a
docker volume ls
```

以上命令分别检查 Docker CLI、Compose V2、开机自启、daemon 当前状态、引擎连通性、全部容器及数据卷，均不会启动项目服务。

```bash
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
```

前者立即启动 Docker 并设为开机自启；后者把当前用户加入 Docker 组。执行后者必须退出 SSH 再登录。Docker 组拥有较高系统权限，不应授予不可信用户。

## 5. Docker Compose 命令字典

当前服务为 `postgres`、`redis`、`server`、`server-worker`、`nginx`：前两个是依赖，`server` 是 Nest HTTP API，`server-worker` 消费后台任务，Nginx 是唯一公网入口。

### 5.1 只读命令

```bash
$COMPOSE config --quiet
$COMPOSE ps
$COMPOSE ps -a
$COMPOSE top
$COMPOSE logs --tail=200 server
$COMPOSE logs -f server-worker
docker stats --no-stream
docker system df
```

| 命令 | 作用 | 是否启动服务 |
| --- | --- | --- |
| `config --quiet` | 校验 Compose YAML 和环境变量能否插值；成功无输出 | 否 |
| `ps` | 列出当前 Compose 服务状态 | 否 |
| `ps -a` | 连已停止的 Compose 容器也列出 | 否 |
| `top` | 显示容器内进程 | 否 |
| `logs --tail=200 <服务>` | 显示最近 200 行日志 | 否 |
| `logs -f <服务>` | 持续跟踪日志；`Ctrl+C` 只退出日志 | 否 |
| `docker stats --no-stream` | 输出一次 CPU / 内存快照 | 否 |
| `docker system df` | 汇总镜像、容器、构建缓存占用 | 否 |

不要执行不带 `--quiet` 的 `docker compose config` 并把输出发送出去，它会展开 `.env.prod` 内的密钥。

### 5.2 启动、构建、重启

```bash
$COMPOSE up -d
$COMPOSE up --build -d
$COMPOSE up --build -d postgres redis server
$COMPOSE up --build -d server-worker nginx
$COMPOSE restart server
$COMPOSE restart server-worker
$COMPOSE restart nginx
$COMPOSE up -d --force-recreate server server-worker
```

| 命令 | 作用 | 适用时机 |
| --- | --- | --- |
| `up -d` | 按当前配置后台启动或更新服务 | 普通重启，不需要重建镜像 |
| `up --build -d` | 重建镜像后启动全部服务 | Dockerfile、依赖或前端构建变化后 |
| `up --build -d postgres redis server` | 仅启动依赖与 HTTP API | 首次迁移前的第一阶段 |
| `up --build -d server-worker nginx` | 启动 Worker 与公网入口 | migration、seed、bootstrap 成功后 |
| `restart <服务>` | 重启一个已存在容器，保留 volume | 单服务异常或配置未改变时 |
| `up -d --force-recreate ...` | 重建指定容器以读取新环境变量 | 修改 `.env.prod` 后；不删除数据卷 |

首次空数据库必须先启动 `postgres redis server`，完成 migration、seed 和管理员创建后，才启动 Worker 与 Nginx。Nginx 依赖 `server` 健康，不能在 migration 前作为健康检查入口。

### 5.3 停止与删除边界

```bash
$COMPOSE down
$COMPOSE down -v
docker volume prune
docker system prune --volumes
```

| 命令 | 作用 | 风险 |
| --- | --- | --- |
| `down` | 停止并删除 Compose 容器和网络，保留 named volume | 可用于普通停止 |
| `down -v` | 同时删除 Compose 管理的数据卷 | 高风险，会删除 PostgreSQL / Redis 数据 |
| `docker volume prune` | 删除所有未被容器引用的数据卷 | 高风险，范围不只本项目 |
| `docker system prune --volumes` | 清理未使用镜像、容器、网络和数据卷 | 高风险，范围不只本项目 |

生产环境未经明确恢复方案不得执行后三条。

## 6. 容器内任务：`exec` 与 `run`

`exec` 在已运行容器内执行一次命令，目标服务必须已启动：

```bash
$COMPOSE exec server npx prisma migrate deploy
$COMPOSE exec server npx tsx prisma/seed.ts
$COMPOSE exec -e SUPER_ADMIN_EMAIL='<生产管理员邮箱>' \
  -e SUPER_ADMIN_TEMP_PASSWORD='<一次性强密码>' \
  server npx tsx src/cli/bootstrap-super-admin.ts
```

| 命令 | 作用 | 写入影响 |
| --- | --- | --- |
| `prisma migrate deploy` | 应用已有 migration | 写数据库结构和 migration 记录，不重置数据库 |
| `tsx prisma/seed.ts` | 写生产基线角色、菜单和样例内容 | 写数据库；禁止使用 `seed:local-users` |
| `bootstrap-super-admin.ts` | 创建或受控提升生产超级管理员 | 写数据库；`-e` 仅传给本次进程，不写入镜像 |

`run` 创建临时容器，适合一次性导入：

```bash
$COMPOSE run --rm --no-deps \
  -v /data/personal-hub/content-local:/var/import/content-local:ro \
  server npx tsx src/cli/import-local-booklets.ts \
  --source /var/import/content-local \
  --owner-email '<生产管理员邮箱>' \
  --dry-run
```

| 参数 | 含义 |
| --- | --- |
| `--rm` | 命令结束后删除临时容器 |
| `--no-deps` | 不自动启动或重启数据库、Redis 等依赖 |
| `-v 宿主机:容器内:ro` | 只读挂载小册源，防止脚本改源文件 |
| `--dry-run` | 只扫描和报告，不写 COS / 数据库 |
| `--execute` | 正式导入，会写 COS 与数据库；仅 dry-run 确认后使用 |

正式导入只将 `--dry-run` 改为 `--execute`。导入前确认 `server-worker` 正常、`ready` 为 200。

## 7. 健康检查、端口与旧服务

```bash
curl -sS http://127.0.0.1/api/v1/health/live
curl -sS http://127.0.0.1/api/v1/health/ready
curl -i http://127.0.0.1/api/v1/health/ready
curl -I http://<公网IP>/
curl -I http://<公网IP>/admin/
sudo ss -lntp
sudo ss -lntp | grep -E ':80 |:8000 |:3001 |:5432 |:6379 ' || true
systemctl is-active nginx postgresql redis-server
```

`live` 只确认 Nest HTTP 进程存活；`ready` 同时检查 PostgreSQL、Redis、COS，任一异常返回 503。`curl -sS` 适合快速查看 JSON，`-i` 显示状态和 Header，`-I` 只请求 Header。迁移前 `ready` 为 503 属于预期；第二阶段后两项都应为 200。

`ss`、`systemctl is-active` 是只读检查。生产不应对公网暴露 `3001`、`5432`、`6379`。宿主机 Nginx 若占用 80，才使用：

```bash
sudo systemctl stop nginx
sudo systemctl disable nginx
sudo fuser -vm /opt/personal-hub
ps -o pid,ppid,user,cmd -fp <PID>
```

`stop/disable` 会停止并取消宿主机 Nginx 开机自启；`fuser` 与 `ps` 用于先识别占用目录或端口的进程。

```bash
pm2 status
sudo pm2 status
sudo pm2 stop all
sudo pm2 delete all
sudo pm2 save --force
sudo pm2 unstartup
```

前两条只读取旧 PM2 状态，其余会停止和取消旧阶段 A 进程恢复。仅在确认仍有 `personal-hub-dev` 时使用；不要用 PM2 启动当前 Compose 生产服务。

## 8. 非敏感配置、备份与外部资源

### 8.1 检查容器收到的配置

```bash
$COMPOSE exec server env | awk -F= '/^SMTP_(HOST|PORT|SECURE|USER)=/ {print $1 "=" $2}'
$COMPOSE exec server env | awk -F= '/^MINIO_(ENDPOINT|ACCESS_KEY|BUCKET)=/ {print $1 "=" $2}'
$COMPOSE exec server env | awk -F= '/^AI_(TEXT_PROVIDER|OPENAI_BASE_URL|OPENAI_MODEL|OPENAI_TIMEOUT_MS)=/ {print $1 "=" $2}'
```

`env` 会输出环境变量，`awk` 仅保留白名单字段。不要直接执行无筛选 `env`，也不要输出 `SMTP_PASSWORD`、`MINIO_SECRET_KEY`、`JWT_*`、`AI_OPENAI_API_KEY`。

### 8.2 PostgreSQL 逻辑备份

```bash
backup_dir="/data/personal-hub/backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup_dir"
$COMPOSE exec -T postgres sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  > "$backup_dir/personal_hub.sql"
chmod 600 "$backup_dir/personal_hub.sql"
ls -lh "$backup_dir/personal_hub.sql"
```

`mkdir -p` 创建带时间戳的备份目录；`exec -T` 在数据库容器内无交互执行 `pg_dump`；`>` 将 SQL 写到宿主机 `/data`；最后两条收紧权限并检查文件大小。备份会创建文件但不修改数据库，恢复必须在隔离实例演练。

### 8.3 镜像、源文件与 COS

```bash
docker info | grep -A5 -i "registry mirrors"
docker pull node:22-bookworm-slim
docker pull nginx:1.27-alpine
rsync -avz --progress <本地目录>/ deploy@<服务器IP>:/data/personal-hub/content-local/
```

`docker info` 是只读；`docker pull` 下载镜像但不启动容器；`rsync` 会把小册源写入服务器数据盘，仅用于一次性导入源。COS、SMTP、域名和 HTTPS 的控制台配置见 [tencent-cloud-prep.md](./tencent-cloud-prep.md)；生产不运行 MinIO，`MINIO_*` 实际填写 COS 信息。

Docker 镜像已拉取、构建却停在容器内 `apt-get` 时，Docker Registry mirror 不会生效，因为 apt
访问的是 Debian 软件源。生产 Dockerfile 会先将容器内的 `deb.debian.org` 改为腾讯云镜像并写入
`Acquire::ForceIPv4` 配置；后续原有的 `apt-get update/install` 命令仍保留。这个改动只在镜像构建层内
生效，不会改宿主机的软件源。

## 9. 快速排障组合

### 网站打不开或 502

```bash
$COMPOSE ps
$COMPOSE logs --tail=200 nginx
$COMPOSE logs --tail=200 server
curl -v http://127.0.0.1/api/v1/health/live
sudo ss -lntp
```

按安全组、80 端口、Nginx、`server` 的顺序排查，不要先重建全部服务。

### Worker、COS 或镜像异常

```bash
$COMPOSE ps server-worker
$COMPOSE logs --tail=200 server-worker
curl -i http://127.0.0.1/api/v1/health/ready
df -h
docker pull node:22-bookworm-slim
docker info | grep -A5 -i "registry mirrors"
```

`ready` 的 `objectStorage` 为 `down` 时，先检查 COS Endpoint、Bucket、CAM 权限和服务器出网。基础镜像出现 `EOF`、`failed size validation` 时优先排查网络或 Registry mirror，不要先修改 Dockerfile。

## 10. 当前不应使用的旧命令

```bash
pm2 start ecosystem.config.js --only personal-hub-dev
pm2 restart personal-hub-dev
pnpm deploy:server
docker-compose up
```

前三条属于旧 Umi mock / PM2 路径；`docker-compose`（带连字符）是 Compose V1。当前生产统一使用 `docker compose`（带空格）管理 Nginx、`server`、`server-worker`、PostgreSQL 与 Redis。
