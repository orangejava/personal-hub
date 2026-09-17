# 生产服务器操作手册

> 状态：🟢 当前首版上线与日常运维权威手册（2026-09-16）
> 适用：腾讯云服务器、`/opt/personal-hub/`、Docker Compose、公网 IP + HTTP 首版
> 软件安装与检查：[production-prerequisites.md](./production-prerequisites.md)
> 首次上线清单：[prod-startup-order.md](./prod-startup-order.md)
> 环境变量：[prod-env-worksheet.md](./prod-env-worksheet.md)
> 架构原则：[nest-compose-strategy.md](./nest-compose-strategy.md)

本文件集中放置生产服务器的实际终端操作。生产长期内容存储在腾讯 COS；服务器上的
`/data/personal-hub/content-local/` 只作为阶段 A 或首版一次性导入源，不能当作生产正文的长期来源。

## 0. 服务器固定约定

```text
/opt/personal-hub/                  # 项目代码、Compose、部署脚本
/data/personal-hub/content-local/   # 现有小册源文件；一次性导入后可清理
/opt/personal-hub/.env.prod         # 生产密钥文件，不进 Git
Docker volumes                      # PostgreSQL、Redis 运行数据
腾讯 COS                             # 小册、封面、附件等长期对象存储
```

所有命令默认在服务器执行，并且先进入项目目录：

```bash
cd /opt/personal-hub
export COMPOSE="docker compose --env-file .env.prod -f compose.prod.yml"  # 后续可写 $COMPOSE ps，避免每次重复敲
```

如果当前 Shell 不支持把 Compose 命令保存为变量，直接展开为：

```bash
docker compose --env-file .env.prod -f compose.prod.yml ps  # 查看各容器是否 running / healthy
```

不要执行会回显密钥的命令，例如把完整 `docker compose config` 输出复制到聊天或日志。

---

## 1. 每次发布：最高频操作

### 1.1 发布前检查

```bash
cd /opt/personal-hub
git status --short          # 工作区应干净，尤其不能把 .env.prod 提交上去
git log -1 --oneline        # 记下当前 commit，回滚时用
git pull --ff-only          # 只允许快进；有分叉时停下来，不要在生产做合并提交
# 若报 dubious ownership，先把目录 chown 给当前用户，见第 4.6 节
chmod 600 .env.prod         # 仅当前用户可读写生产密钥
docker --version
docker compose version
docker compose --env-file .env.prod -f compose.prod.yml config --quiet  # 只校验变量能否插值；不要去掉 --quiet，以免打印密钥
```

`.env.prod` 只从 [prod-env-worksheet.md](./prod-env-worksheet.md) 准备，不能提交 Git。

### 1.2 构建、启动和检查

没有 Prisma migration 的普通发布可以直接更新全部运行服务：

```bash
docker compose --env-file .env.prod -f compose.prod.yml up --build -d  # --build 重建镜像；-d 后台运行
docker compose --env-file .env.prod -f compose.prod.yml ps
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=100 server  # 先看最近启动日志，不要一上来 -f 卡住终端
```

日常代码发布通常只需更新应用服务，不需要主动重建 PostgreSQL、Redis：

```bash
docker compose --env-file .env.prod -f compose.prod.yml up --build -d server server-worker nginx
# 同时更新 API、异步任务和容器内 Nginx（其中 Nginx 镜像包含用户端、管理端静态文件）
```

这条命令会为三个指定服务构建镜像，并替换镜像或配置已变化的目标容器；已有的 PostgreSQL、Redis
容器和它们的 named volume 不会被删除或重建。适用于一次提交同时改到后端、Worker 或 Web 前端的
场景。服务即使本次没有变更也可以包含在命令中，Compose 会保留无需替换的现有容器；若只改一个服务，
见第 2.2 节的“按变更范围更新”。

如果本次包含 Prisma migration，必须先只启动依赖和 HTTP `server`，执行迁移后再启动
`server-worker` 与 Nginx。`server` 的 `ready` 会查询已迁移的数据库，因此迁移前不能把
Nginx 当作健康检查入口：

```bash
docker compose --env-file .env.prod -f compose.prod.yml up --build -d postgres redis server
docker compose --env-file .env.prod -f compose.prod.yml exec server \
  npx prisma migrate deploy  # 只应用已有 migration，不会重置或删除数据
docker compose --env-file .env.prod -f compose.prod.yml up --build -d
```

只有修改前端构建、Dockerfile、依赖或任一服务的应用代码时才需要 `--build`。普通重启使用：

```bash
docker compose --env-file .env.prod -f compose.prod.yml up -d  # 不重建镜像，只按当前配置启动或更新容器
```

### 1.3 发布后检查

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1/api/v1/health/live   # Nginx 与 HTTP 进程可用时输出 200
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1/api/v1/health/ready  # migration 完成后，数据库、Redis、COS 均正常时输出 200
docker compose --env-file .env.prod -f compose.prod.yml ps
```

---

## 2. 日常重启、停止和日志

### 2.1 查看服务状态

```bash
docker compose --env-file .env.prod -f compose.prod.yml ps
docker compose --env-file .env.prod -f compose.prod.yml top  # 容器内进程，不是宿主机 top
docker stats --no-stream  # 打一次 CPU/内存快照后退出，避免一直刷屏
df -h
free -h
```

### 2.2 按变更范围更新或重启单个服务

`restart` 只重启现有容器，不会构建镜像、不会读取刚 `git pull` 的应用代码，也不会让 Nginx
获得新前端静态文件。因此它用于临时故障恢复，而不是代码发布。代码或镜像内容变更时使用
`up --build -d <服务>`；仅运行中的进程异常且镜像、环境变量均未变化时才使用 `restart <服务>`。

| 变更内容                                                                 | 执行命令                                                                                              | 说明                                                                                       |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 同时改后端、Worker、前端或 Nginx                                         | `docker compose --env-file .env.prod -f compose.prod.yml up --build -d server server-worker nginx`    | 常用完整应用发布；不重建 PostgreSQL/Redis。                                                |
| 只改 Nest API                                                            | `docker compose --env-file .env.prod -f compose.prod.yml up --build -d server`                        | 仅替换 API；Worker 仍运行旧代码。                                                          |
| 只改异步任务代码                                                         | `docker compose --env-file .env.prod -f compose.prod.yml up --build -d server-worker`                 | 仅替换 Worker。                                                                            |
| 只改用户端、管理端构建或 Nginx 配置                                      | `docker compose --env-file .env.prod -f compose.prod.yml up --build -d nginx`                         | Nginx 镜像包含 Web 静态文件，因此会发布前端。                                              |
| 只改 `.env.prod` 中 server/worker 使用的变量（不含 `PUBLIC_APP_ORIGIN`） | `docker compose --env-file .env.prod -f compose.prod.yml up -d --force-recreate server server-worker` | 必须重建容器读取新环境变量；不是 `restart`。                                               |
| 改 `PUBLIC_APP_ORIGIN`                                                   | `docker compose --env-file .env.prod -f compose.prod.yml up --build -d server server-worker nginx`    | 它既是 server/worker 运行时变量，也是用户端/管理端构建期跳转 Origin；必须重建 Nginx 镜像。 |
| 服务进程临时卡住，代码和配置未变                                         | `docker compose --env-file .env.prod -f compose.prod.yml restart <服务>`                              | 仅恢复指定旧容器进程。                                                                     |

```bash
docker compose --env-file .env.prod -f compose.prod.yml restart server          # 只重启 API，不碰数据库 volume
docker compose --env-file .env.prod -f compose.prod.yml restart server-worker  # 异步任务 / Outbox；只重启 server 不够
docker compose --env-file .env.prod -f compose.prod.yml restart nginx
```

### 2.3 查看日志

```bash
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=200 server
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=200 server-worker
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=200 nginx
docker compose --env-file .env.prod -f compose.prod.yml logs -f server  # Ctrl+C 只断开日志，不会停容器
```

停止服务但保留数据库和 Redis volume：

```bash
docker compose --env-file .env.prod -f compose.prod.yml down  # 停容器、保留 named volume；不要加 -v
```

**禁止随手执行 `docker compose down -v`。** `-v` 会删除 Compose 管理的持久化卷，可能造成生产数据丢失。

---

## 3. 首次上线：一次性完整流程

首次上线不能只执行 `compose up`。必须按下面顺序完成容器、数据库、管理员、小册和冒烟验证。

如果服务器上还在跑阶段 A 的 PM2（`personal-hub-dev`，端口 8000），先做 3.0，再做 3.1。
不要让 PM2 和 Compose 同时跑：PM2 会占内存，开机自启后还会把旧站点拉起来。

### 3.0 停掉旧 PM2，再清理代码目录

先看当前占用，不要直接删目录：

```bash
whoami
pwd
pm2 status                      # 常见进程名 personal-hub-dev；也可能叫 ecosystem.dev
sudo ss -lntp | grep -E ':80 |:8000 |:3001 |:5432 |:6379 ' || true
docker ps                       # 若已有旧 postgres/redis 容器，后面 Compose 可能抢端口
ls -ld /opt/personal-hub
```

停 PM2 时必须同时看当前用户和 root。阶段 A 经常是 `sudo pm2 start`，所以 `pm2 status` 为空、`sudo pm2 status` 里却还有 `personal-hub-dev`。
不要只 `kill` Node 进程：root 的 PM2 会立刻把它拉起来（`↺` 次数会往上加，CPU 也会升高）。

```bash
pm2 status                      # deploy 用户的列表
sudo pm2 status                 # root 的列表；常见还在跑 personal-hub-dev
sudo pm2 stop all
sudo pm2 delete all             # 从 root 的进程列表里去掉
sudo pm2 save --force           # 空列表也要写入 dump，否则重启可能复活旧进程
sudo pm2 unstartup              # 取消 root 的 systemd 开机拉起；若打印 sudo 命令就原样执行
sudo systemctl disable --now pm2-root "pm2-$(whoami)" 2>/dev/null || true
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
pm2 save 2>/dev/null || true
sudo pm2 status                 # 应没有 online 的应用
sudo ss -lntp | grep ':8000 ' || echo "8000 already free"
```

`unstartup` 若提示要带 systemd 参数，把终端打印的那条 `sudo ...` 原样执行。

`pm2 status` 为空、`pm2 stop all` 提示 `No process found` 时，只说明当前用户的 PM2 列表是空的。
旧的 Node、宿主机 Nginx、本机 PostgreSQL / Redis 仍可能占着端口，必须再查进程：

```bash
sudo ss -lntp | grep -E ':80 |:8000 |:3001 |:5432 |:6379 '
ps -o pid,ppid,user,cmd -fp <上面看到的pid>   # 例如 8000 上的 node
sudo -n pm2 status 2>/dev/null || sudo pm2 status   # root 的 PM2 列表可能还有进程
systemctl is-active nginx postgresql redis-server 2>/dev/null
```

Compose 的 Nginx 要绑宿主机 **80**，宿主机 Nginx 必须先停。8000 上的旧 Node 也要停。
本机 PostgreSQL / Redis 会占内存；生产库走 Compose 容器，不要继续用宿主机这套：

```bash
sudo systemctl stop nginx
sudo systemctl disable nginx
sudo systemctl stop postgresql redis-server 2>/dev/null || true
sudo systemctl disable postgresql redis-server 2>/dev/null || true
sudo ss -lntp | grep -E ':80 |:8000 |:5432 |:6379 ' || echo "ports freed"
```

8000 上的 Node 若属于 root 的 `personal-hub-dev`，用上面的 `sudo pm2 delete all`，不要单独 `kill`。

`docker ps` 若报 `permission denied ... docker.sock`，当前用户还不在 `docker` 组：

```bash
sudo usermod -aG docker "$USER"
```

执行后必须退出 SSH 再登录。未重新登录前可临时用 `sudo docker ps`。

删除 `/opt/personal-hub` 前必须离开该目录。人还在里面、旧 Node 还占着 `node_modules`，或属主是 root，都会删不掉。
不要删 `/data/personal-hub/`，小册源在数据盘。若已经有 `.env.prod`，先备份：

```bash
cd ~                            # 必须先离开 /opt/personal-hub，否则会 Device or resource busy
test -f /opt/personal-hub/.env.prod && cp -a /opt/personal-hub/.env.prod ~/env.prod.bak
sudo chown -R "$USER:$USER" /opt/personal-hub
sudo rm -rf /opt/personal-hub   # 连 .git 一起删；rm /opt/personal-hub/* 删不掉隐藏文件
sudo mkdir -p /opt/personal-hub
sudo chown "$USER:$USER" /opt/personal-hub
ls -ld /opt/personal-hub        # 应为空目录，属主是当前用户，例如 deploy
```

若 `rm` 仍失败，看是谁占用：

```bash
sudo fuser -vm /opt/personal-hub
```

有输出就先停掉对应进程，再重新 `sudo rm -rf /opt/personal-hub`。空目录建好后，按第 6 节重新 clone，见 [production-prerequisites.md](./production-prerequisites.md#6-git-和项目目录检查)。

### 3.1 服务器和代码准备

先完成 [production-prerequisites.md](./production-prerequisites.md)，确认 Docker、Compose、
Git、磁盘、安全组和目录都通过检查。刚清空过 `/opt/personal-hub` 时用 `git clone`，不要 `git pull`。

```bash
sudo apt update
sudo apt install -y git curl ca-certificates  # 完整安装步骤见 production-prerequisites.md
docker --version
docker compose version
cd /opt/personal-hub
if [ -d .git ]; then
  git pull --ff-only  # 已有仓库才只快进；有冲突先停
else
  git clone https://gitee.com/oralemon/personal-hub.git .  # 空目录首次拉取，末尾点号避免多套一层目录
fi
ls -la /data/personal-hub/content-local/  # 确认一次性小册源还在数据盘，不要复制进 /opt
```

确认安全组至少允许 SSH 和 HTTP 80。没有域名和证书前不要依赖 443。

### 3.2 准备生产环境

```bash
cd /opt/personal-hub
cp .env.prod.example .env.prod  # 已有填好的 .env.prod 时不要执行，以免覆盖真实密钥
chmod 600 .env.prod             # 仅当前用户可读写
${EDITOR:-vi} .env.prod         # 使用 $EDITOR；未设置则用 vi
docker compose --env-file .env.prod -f compose.prod.yml config --quiet  # 校验插值；成功应无输出
```

填写和检查项见 `prod-env-worksheet.md`，重点包括：

- `PUBLIC_APP_ORIGIN=http://<公网IP>`；
- PostgreSQL / Redis 密码；
- JWT 和其他随机密钥；
- 腾讯 COS Endpoint、Bucket、SecretId、SecretKey；
- QQ SMTP 用户、授权码、端口和 SSL；
- 超级管理员邮箱。

不要把真实密钥写入命令历史、镜像、Git 或日志。

### 3.3 第一阶段：启动依赖和 HTTP server

```bash
docker compose --env-file .env.prod -f compose.prod.yml up --build -d postgres redis server
docker compose --env-file .env.prod -f compose.prod.yml ps
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=100 server
```

首次空数据库在 migration 前会使 `server` 的 `ready` 为 503，因而 Nginx 还不会启动。这是
预期行为；此阶段只通过 `docker compose exec server` 运行迁移，不要访问 `127.0.0.1` 的 Nginx 入口。

### 3.4 数据库迁移和基线 seed

```bash
docker compose --env-file .env.prod -f compose.prod.yml exec server \
  npx prisma migrate deploy  # 应用仓库里已有的 migration，不重置库

docker compose --env-file .env.prod -f compose.prod.yml exec server \
  npx tsx prisma/seed.ts  # 生产基线内容；禁止改用 seed:local-users
```

生产禁止执行 `seed:local-users`，也不能使用开发密码 `HubDev!234`。

如果容器中找不到 `tsx`：

```bash
docker compose --env-file .env.prod -f compose.prod.yml exec server \
  ls node_modules/.bin/tsx  # 只确认二进制存在；不要在生产容器里临时 npm i
```

记录错误后停止导入，不要在生产容器里临时安装未知依赖。

### 3.5 创建生产超级管理员

只在当前命令中传入一次性密码，不写入镜像：

```bash
docker compose --env-file .env.prod -f compose.prod.yml exec \
  -e SUPER_ADMIN_EMAIL='生产管理员邮箱' \
  -e SUPER_ADMIN_TEMP_PASSWORD='一次性强密码' \
  server npx tsx src/cli/bootstrap-super-admin.ts  # -e 只注入这一次进程，不写入镜像
```

使用公网 IP 登录后，立即修改一次性密码。该命令重复执行通常会因为已有 active
super admin 而失败。新版本会在同一事务中为该账号补齐角色的首次 AI 额度。

如果超级管理员是在旧版本部署时已经创建，并且页面显示 `0 Token`，不要重置密码或重跑完整
seed。更新镜像后，仅执行以下幂等修复一次；它只会为指定 active super_admin 补缺失的首发
额度，重复执行不会再次赠送：

```bash
docker compose --env-file .env.prod -f compose.prod.yml exec \
  -e SUPER_ADMIN_EMAIL='<生产超级管理员邮箱>' \
  server npx tsx src/cli/repair-super-admin-ai-quota.ts
```

### 3.6 第二阶段：启动 worker 与 Nginx

迁移、基线 seed 和管理员 bootstrap 全部成功后，才启动会消费异步任务的 worker 和公网入口：

```bash
docker compose --env-file .env.prod -f compose.prod.yml up --build -d server-worker nginx
docker compose --env-file .env.prod -f compose.prod.yml ps
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1/api/v1/health/live
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1/api/v1/health/ready
```

两条命令应各输出一行 `200`；`ready` 失败时先检查 COS、PostgreSQL、Redis 和 `server` 日志，
不要继续小册导入。

### 3.7 一次性导入小册到 COS

服务器源目录固定为：

```text
/data/personal-hub/content-local/
```

不要把它直接当作容器路径，也不要把它复制进 `/opt/personal-hub/`。导入 CLI 会启动 Nest 应用，生产必须运行镜像构建时已生成的 `dist/cli` 文件；不要用 `npx tsx` 直接运行源码，否则缺少 Nest 装饰器元数据会导致依赖注入失败。使用一次性只读挂载运行导入容器：

```bash
docker compose --env-file .env.prod -f compose.prod.yml run --rm --no-deps \
  -v /data/personal-hub/content-local:/var/import/content-local:ro \
  server node dist/cli/import-local-booklets.js \
  --source /var/import/content-local \
  --owner-email '<生产超级管理员邮箱>' \
  --dry-run
# --rm 跑完删临时容器；--no-deps 不连带重启 postgres；:ro 只读挂载；--owner-email 显式指定内容归属；--dry-run 不写 COS/数据库
```

确认 dry-run 输出后，执行正式导入：

```bash
docker compose --env-file .env.prod -f compose.prod.yml run --rm --no-deps \
  -v /data/personal-hub/content-local:/var/import/content-local:ro \
  server node dist/cli/import-local-booklets.js \
  --source /var/import/content-local \
  --owner-email '<生产超级管理员邮箱>' \
  --execute  # 确认 dry-run 无误后再跑；不要重复正式导入
```

导入前必须确认 `server-worker` 正常运行。导入后检查 COS 对象、数据库元数据和阅读页面，
确认无误后即可解除临时挂载；源目录是否删除由备份确认结果决定。

### 3.8 首次上线冒烟

依次验证：

1. `http://<公网IP>/` 能打开用户端；
2. 管理员能登录并修改密码；
3. `/admin` 能打开管理端；
4. 公开内容列表、详情和小册章节可读；
5. COS 封面和附件可访问；
6. 注册验证邮件能收到；
7. 忘记密码邮件能收到；
8. `/ai` 页面和 `GET /api/v1/public/ai/home` 返回 200；
9. `server-worker` 没有持续报错或重启；
10. 日志中没有 SMTP 授权码、COS SecretKey 或 JWT 密钥。

---

## 4. 常见排障

### 4.1 网站打不开或 502

```bash
docker compose --env-file .env.prod -f compose.prod.yml ps
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=200 nginx
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=200 server
curl -v http://127.0.0.1/api/v1/health/live  # -v 看完整握手，区分 Nginx 502 和后端没起来
sudo ss -lntp  # 确认 80 被 nginx 占用；5432/6379/3001 不应对公网
```

先区分安全组、Nginx、server 进程和数据库 readiness，不要直接重建全部服务。

### 4.2 登录失败

```bash
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=200 server
curl -i http://127.0.0.1/api/v1/health/ready  # 带响应头；503 时登录通常也会失败
```

IP + HTTP 首版若 Cookie 带不回，优先检查生产 Cookie 的 `Secure` 开关；有 HTTPS 后再固定为
Secure Cookie。

### 4.3 邮件发送失败

```bash
docker compose --env-file .env.prod -f compose.prod.yml exec server \
  env | awk -F= '/^SMTP_(HOST|PORT|SECURE|USER)=/ {print $1 "=" $2}'  # 故意不打印 SMTP_PASSWORD
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=200 server
```

不要通过 `env`、日志或截图输出 `SMTP_PASSWORD`。

### 4.4 COS 或小册导入失败

```bash
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=200 server
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=200 server-worker
ls -la /data/personal-hub/content-local/  # 源目录是否存在、权限是否可读
df -h  # 磁盘满会导致导入和上传失败
```

检查 Endpoint、Bucket、权限、预签名风格、网络和 Worker。不要重复执行正式导入，先确认脚本的幂等行为和失败位置。

### 4.5 Worker 不工作

```bash
docker compose --env-file .env.prod -f compose.prod.yml ps server-worker
docker compose --env-file .env.prod -f compose.prod.yml logs -f server-worker  # Ctrl+C 不断开容器
```

图像、视频、Outbox 和部分文件任务依赖 Worker；只重启 `server` 不能代替 Worker。

### 4.6 `git pull` 报 dubious ownership

Git 发现 `/opt/personal-hub` 的属主不是当前用户（常见：root 创建或 clone，却用 `deploy` 去 pull）。

先改属主，不要用 `sudo git pull`，也不要先加 `safe.directory`：

```bash
whoami
ls -ld /opt/personal-hub /opt/personal-hub/.git
sudo chown -R "$USER:$USER" /opt/personal-hub  # 代码目录交给当前用户，例如 deploy
chmod 600 /opt/personal-hub/.env.prod 2>/dev/null || true
git status --short
git pull --ff-only
```

只有目录必须保持 root 属主时，才用 Git 提示的兜底：

```bash
git config --global --add safe.directory /opt/personal-hub
```

完整说明见 [production-prerequisites.md](./production-prerequisites.md#6-git-和项目目录检查)。

---

## 5. 定期维护和备份

### 5.1 磁盘和 Docker

```bash
df -h
du -sh /opt/personal-hub /data/personal-hub 2>/dev/null  # 代码盘和小册源各占多少
docker system df  # 镜像、容器、构建缓存占用；清理前先确认可回滚版本
```

清理镜像前先确认当前运行容器和可回滚版本，不要直接清理所有资源。

### 5.2 数据库备份

备份命令必须结合实际 Compose volume 和数据库账号确认后执行。至少做到：

1. 每日备份 PostgreSQL；
2. migration 前额外备份；
3. 备份与数据库运行数据分目录；
4. 定期在隔离实例恢复验证；
5. 记录备份日期、大小和恢复结果。

### 5.3 安全检查

```bash
chmod 600 /opt/personal-hub/.env.prod  # 密钥文件必须仅当前用户可读写
git status --short                     # 不应出现 .env.prod
sudo ss -lntp                          # 5432 / 6379 / 3001 不应对公网监听
```

只开放 SSH、HTTP 80 和实际需要的端口；PostgreSQL、Redis、MinIO 管理端不暴露公网。

---

## 6. 停止、回滚和危险操作

普通停止：

```bash
docker compose --env-file .env.prod -f compose.prod.yml down  # 停容器，保留数据库和 Redis volume
```

应用版本回滚原则：

1. 先保留当前日志和 `docker compose ps` 输出；
2. 切换到已验证的代码或镜像版本；
3. 只回滚应用镜像，不手动反向修改已执行的 Prisma migration；
4. 检查 readiness、登录、内容和 Worker；
5. 破坏性 migration 必须依赖备份恢复，不使用临时 SQL 硬改生产库。

以下命令未经明确恢复方案不得执行：

```bash
docker compose down -v          # 删除 Compose volume，生产数据库会丢
docker volume prune             # 删掉未被容器引用的 volume
docker system prune --volumes   # 连同未使用 volume 一起清
rm -rf /data/personal-hub/*     # 删除小册源文件，不可恢复
```

---

## 7. COS 与真实 AI 联测

本节需要填写真实的 COS 和 AI 配置后执行。不要把密钥写入仓库、命令截图或日志。

### 7.1 COS 配置检查

确认服务器 `.env.prod` 中的值：

```text
MINIO_ENDPOINT=https://cos.<地域>.myqcloud.com
MINIO_ACCESS_KEY=<CAM SecretId>
MINIO_SECRET_KEY=<CAM SecretKey>
MINIO_BUCKET=<完整桶名-APPID>
```

变量名虽然仍是 `MINIO_*`，值必须来自腾讯 COS/CAM，不是 MinIO。

先检查容器是否拿到非空配置，但不要输出 SecretKey：

```bash
docker compose --env-file .env.prod -f compose.prod.yml exec server \
  env | awk -F= '/^MINIO_(ENDPOINT|ACCESS_KEY|BUCKET)=/ {print $1 "=" $2}'  # 不打印 MINIO_SECRET_KEY
```

### 7.2 COS 基础读写验证

按首次上线流程先启动所有服务并完成 migration、seed、bootstrap。然后：

1. 登录用户端或管理端；
2. 上传一个小于 multipart 阈值的封面或小文件；
3. 确认上传接口返回成功；
4. 在 COS 控制台确认对象出现；
5. 打开文件下载或预览地址；
6. 删除测试文件；
7. 确认 COS 对象和数据库 FileAsset 状态一致。

如果上传失败，依次检查：

```bash
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=200 server
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=200 server-worker
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1/api/v1/health/ready  # 若输出 503，先修依赖，不要反复上传测试文件
```

### 7.3 COS 小册导入验证

确认源目录存在：

```bash
find /data/personal-hub/content-local -maxdepth 2 -type f | head -20  # 确认源目录里确有小册文件
```

先执行 dry-run，并显式指定生产超级管理员邮箱：

```bash
docker compose --env-file .env.prod -f compose.prod.yml run --rm --no-deps \
  -v /data/personal-hub/content-local:/var/import/content-local:ro \
  server node dist/cli/import-local-booklets.js \
  --source /var/import/content-local \
  --owner-email '<生产管理员邮箱>' \
  --dry-run
# :ro 只读挂载；--owner-email 指定内容归属的生产管理员；--dry-run 不写 COS/数据库
```

确认小册数量、章节数量和告警后，再执行正式导入：

```bash
docker compose --env-file .env.prod -f compose.prod.yml run --rm --no-deps \
  -v /data/personal-hub/content-local:/var/import/content-local:ro \
  server node dist/cli/import-local-booklets.js \
  --source /var/import/content-local \
  --owner-email '<生产管理员邮箱>' \
  --execute  # 确认 dry-run 无误后再执行；不要重复正式导入
```

导入后验证：

1. PostgreSQL 中存在导入任务和内容元数据；
2. COS 中存在小册对象；
3. 用户端内容列表能看到小册；
4. 打开至少一个目录、章节和封面；
5. `server-worker` 没有持续失败；
6. 确认无误后再解除挂载并清理临时源文件。

### 7.4 真实 AI 配置

只有 OpenAI Chat Completions 兼容协议的厂商才使用当前适配器：

```env
AI_TEXT_PROVIDER=openai_compatible
AI_OPENAI_BASE_URL=https://厂商地址/v1
AI_OPENAI_API_KEY=厂商 API Key
AI_OPENAI_MODEL=厂商模型名
AI_OPENAI_TIMEOUT_MS=60000
```

配置后重新创建容器：

```bash
docker compose --env-file .env.prod -f compose.prod.yml up -d --force-recreate server server-worker  # 环境变量变更后必须重建容器才会生效
```

然后同步 AI 目录。不要改数据库或重跑会写样例内容的完整 `prisma/seed.ts`：

```bash
docker compose --env-file .env.prod -f compose.prod.yml exec server \
  npx tsx src/cli/sync-ai-catalog.ts
```

该命令会将 Chat/Text 的默认模型切换为 `.env.prod` 中的 `AI_OPENAI_MODEL`，更新角色权益中旧
文本演示模型的 ID，并保留后台已配置的工具开关、访客试用、排序、模型可见性、价格、模板状态、
额度和限流。图片、视频目前仍是内置占位实现，不会因为填写文本 AI 配置而变成真实生成服务。

确认 `server` 容器收到配置，但不要打印 API Key：

```bash
docker compose --env-file .env.prod -f compose.prod.yml exec server \
  env | awk -F= '/^AI_(TEXT_PROVIDER|OPENAI_BASE_URL|OPENAI_MODEL|OPENAI_TIMEOUT_MS)=/ {print $1 "=" $2}'  # 不打印 API Key
```

真实 AI 验证顺序：

1. 打开 `/ai`；
2. 确认 AI home 接口返回 200；
3. 发送一条短文本对话；
4. 确认 SSE 能持续返回 chunk；
5. 确认对话完成并显示 usage；
6. 检查超时和上游错误提示；
7. 检查服务日志不出现 API Key；
8. 连续发送两次请求，确认不会重复扣除或产生异常账本记录。

如果 AI 页面仍显示内置演示模型或没有出现当前模型名，优先检查：

```bash
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=200 server
docker compose --env-file .env.prod -f compose.prod.yml exec server \
  env | awk -F= '/^AI_TEXT_PROVIDER=|^AI_OPENAI_MODEL=|^AI_OPENAI_BASE_URL=/ {print $1 "=" $2}'  # 仍是 fake 时先看这三项是否进了容器
docker compose --env-file .env.prod -f compose.prod.yml exec server \
  npx tsx src/cli/sync-ai-catalog.ts  # 环境已正确时重新同步目录；不输出 API Key
```

如果厂商不是 OpenAI-compatible，不能只填地址，需要后续增加独立 Provider 适配器。
