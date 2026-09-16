# 生产服务器操作手册

> 状态：🟢 当前首版上线与日常运维权威手册（2026-09-15）
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
/etc/personal-hub/.env              # 可选的生产密钥文件，不进 Git
Docker volumes                      # PostgreSQL、Redis 运行数据
腾讯 COS                             # 小册、封面、附件等长期对象存储
```

所有命令默认在服务器执行，并且先进入项目目录：

```bash
cd /opt/personal-hub
export COMPOSE="docker compose --env-file .env.prod -f compose.prod.yml"
```

如果当前 Shell 不支持把 Compose 命令保存为变量，直接展开为：

```bash
docker compose --env-file .env.prod -f compose.prod.yml ps
```

不要执行会回显密钥的命令，例如把完整 `docker compose config` 输出复制到聊天或日志。

---

## 1. 每次发布：最高频操作

### 1.1 发布前检查

```bash
cd /opt/personal-hub
git status --short
git log -1 --oneline
git pull --ff-only
chmod 600 .env.prod
docker --version
docker compose version
docker compose --env-file .env.prod -f compose.prod.yml config --quiet
```

`.env.prod` 只从 [prod-env-worksheet.md](./prod-env-worksheet.md) 准备，不能提交 Git。

### 1.2 构建、启动和检查

```bash
docker compose --env-file .env.prod -f compose.prod.yml up --build -d
docker compose --env-file .env.prod -f compose.prod.yml ps
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=100 server
```

只有修改前端构建、Dockerfile 或依赖时才需要 `--build`。普通重启使用：

```bash
docker compose --env-file .env.prod -f compose.prod.yml up -d
```

### 1.3 发布后检查

```bash
curl -sS http://127.0.0.1/api/v1/health/live
curl -sS http://127.0.0.1/api/v1/health/ready
docker compose --env-file .env.prod -f compose.prod.yml ps
```

如果本次包含新的 Prisma migration，启动后必须执行：

```bash
docker compose --env-file .env.prod -f compose.prod.yml exec server \
  npx prisma migrate deploy
```

---

## 2. 日常重启、停止和日志

### 2.1 查看服务状态

```bash
docker compose --env-file .env.prod -f compose.prod.yml ps
docker compose --env-file .env.prod -f compose.prod.yml top
docker stats --no-stream
df -h
free -h
```

### 2.2 重启单个服务

```bash
docker compose --env-file .env.prod -f compose.prod.yml restart server
docker compose --env-file .env.prod -f compose.prod.yml restart server-worker
docker compose --env-file .env.prod -f compose.prod.yml restart nginx
```

### 2.3 查看日志

```bash
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=200 server
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=200 server-worker
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=200 nginx
docker compose --env-file .env.prod -f compose.prod.yml logs -f server
```

停止服务但保留数据库和 Redis volume：

```bash
docker compose --env-file .env.prod -f compose.prod.yml down
```

**禁止随手执行 `docker compose down -v`。** `-v` 会删除 Compose 管理的持久化卷，可能造成生产数据丢失。

---

## 3. 首次上线：一次性完整流程

首次上线不能只执行 `compose up`。必须按下面顺序完成容器、数据库、管理员、小册和冒烟验证。

### 3.1 服务器和代码准备

先完成 [production-prerequisites.md](./production-prerequisites.md)，确认 Docker、Compose、
Git、磁盘、安全组和目录都通过检查。

```bash
sudo apt update
sudo apt install -y git curl ca-certificates
docker --version
docker compose version
cd /opt/personal-hub
git pull --ff-only
ls -la /data/personal-hub/content-local/
```

确认安全组至少允许 SSH 和 HTTP 80。没有域名和证书前不要依赖 443。

### 3.2 准备生产环境

```bash
cd /opt/personal-hub
cp .env.prod.example .env.prod
chmod 600 .env.prod
${EDITOR:-vi} .env.prod
docker compose --env-file .env.prod -f compose.prod.yml config --quiet
```

填写和检查项见 `prod-env-worksheet.md`，重点包括：

- `PUBLIC_APP_ORIGIN=http://<公网IP>`；
- PostgreSQL / Redis 密码；
- JWT 和其他随机密钥；
- 腾讯 COS Endpoint、Bucket、SecretId、SecretKey；
- QQ SMTP 用户、授权码、端口和 SSL；
- 超级管理员邮箱。

不要把真实密钥写入命令历史、镜像、Git 或日志。

### 3.3 启动 Compose

```bash
docker compose --env-file .env.prod -f compose.prod.yml up --build -d
docker compose --env-file .env.prod -f compose.prod.yml ps
curl -sS http://127.0.0.1/api/v1/health/live
```

`ready` 在 migration 前可能是 503，这是预期现象。

### 3.4 数据库迁移和基线 seed

```bash
docker compose --env-file .env.prod -f compose.prod.yml exec server \
  npx prisma migrate deploy

docker compose --env-file .env.prod -f compose.prod.yml exec server \
  npx tsx prisma/seed.ts
```

生产禁止执行 `seed:local-users`，也不能使用开发密码 `HubDev!234`。

如果容器中找不到 `tsx`：

```bash
docker compose --env-file .env.prod -f compose.prod.yml exec server \
  ls node_modules/.bin/tsx
```

记录错误后停止导入，不要在生产容器里临时安装未知依赖。

### 3.5 创建生产超级管理员

只在当前命令中传入一次性密码，不写入镜像：

```bash
docker compose --env-file .env.prod -f compose.prod.yml exec \
  -e SUPER_ADMIN_EMAIL='生产管理员邮箱' \
  -e SUPER_ADMIN_TEMP_PASSWORD='一次性强密码' \
  server npx tsx src/cli/bootstrap-super-admin.ts
```

使用公网 IP 登录后，立即修改一次性密码。该命令重复执行通常会因为已有 active
super admin 而失败。

### 3.6 一次性导入小册到 COS

服务器源目录固定为：

```text
/data/personal-hub/content-local/
```

不要把它直接当作容器路径，也不要把它复制进 `/opt/personal-hub/`。使用一次性只读挂载运行导入容器：

```bash
docker compose --env-file .env.prod -f compose.prod.yml run --rm --no-deps \
  -v /data/personal-hub/content-local:/var/import/content-local:ro \
  server npx tsx src/cli/import-local-booklets.ts \
  --source /var/import/content-local --dry-run
```

确认 dry-run 输出后，执行正式导入：

```bash
docker compose --env-file .env.prod -f compose.prod.yml run --rm --no-deps \
  -v /data/personal-hub/content-local:/var/import/content-local:ro \
  server npx tsx src/cli/import-local-booklets.ts \
  --source /var/import/content-local --execute
```

导入前必须确认 `server-worker` 正常运行。导入后检查 COS 对象、数据库元数据和阅读页面，
确认无误后即可解除临时挂载；源目录是否删除由备份确认结果决定。

### 3.7 首次上线冒烟

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
curl -v http://127.0.0.1/api/v1/health/live
sudo ss -lntp
```

先区分安全组、Nginx、server 进程和数据库 readiness，不要直接重建全部服务。

### 4.2 登录失败

```bash
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=200 server
curl -i http://127.0.0.1/api/v1/health/ready
```

IP + HTTP 首版若 Cookie 带不回，优先检查生产 Cookie 的 `Secure` 开关；有 HTTPS 后再固定为
Secure Cookie。

### 4.3 邮件发送失败

```bash
docker compose --env-file .env.prod -f compose.prod.yml exec server \
  env | awk -F= '/^SMTP_(HOST|PORT|SECURE|USER)=/ {print $1 "=" $2}'
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=200 server
```

不要通过 `env`、日志或截图输出 `SMTP_PASSWORD`。

### 4.4 COS 或小册导入失败

```bash
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=200 server
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=200 server-worker
ls -la /data/personal-hub/content-local/
df -h
```

检查 Endpoint、Bucket、权限、预签名风格、网络和 Worker。不要重复执行正式导入，先确认脚本的幂等行为和失败位置。

### 4.5 Worker 不工作

```bash
docker compose --env-file .env.prod -f compose.prod.yml ps server-worker
docker compose --env-file .env.prod -f compose.prod.yml logs -f server-worker
```

图像、视频、Outbox 和部分文件任务依赖 Worker；只重启 `server` 不能代替 Worker。

---

## 5. 定期维护和备份

### 5.1 磁盘和 Docker

```bash
df -h
du -sh /opt/personal-hub /data/personal-hub 2>/dev/null
docker system df
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
chmod 600 /opt/personal-hub/.env.prod
git status --short
sudo ss -lntp
```

只开放 SSH、HTTP 80 和实际需要的端口；PostgreSQL、Redis、MinIO 管理端不暴露公网。

---

## 6. 停止、回滚和危险操作

普通停止：

```bash
docker compose --env-file .env.prod -f compose.prod.yml down
```

应用版本回滚原则：

1. 先保留当前日志和 `docker compose ps` 输出；
2. 切换到已验证的代码或镜像版本；
3. 只回滚应用镜像，不手动反向修改已执行的 Prisma migration；
4. 检查 readiness、登录、内容和 Worker；
5. 破坏性 migration 必须依赖备份恢复，不使用临时 SQL 硬改生产库。

以下命令未经明确恢复方案不得执行：

```bash
docker compose down -v
docker volume prune
docker system prune --volumes
rm -rf /data/personal-hub/*
```

---

## 7. COS 与真实 AI 联测

本节需要填写真实的 COS 和 AI 配置后执行。不要把密钥写入仓库、命令截图或日志。

### 7.1 COS 配置检查

确认服务器 `.env.prod` 中的值：

```text
MINIO_ENDPOINT=https://cos.ap-shanghai.myqcloud.com
MINIO_ACCESS_KEY=<CAM SecretId>
MINIO_SECRET_KEY=<CAM SecretKey>
MINIO_BUCKET=personal-hub-prod-1456485139
```

变量名虽然仍是 `MINIO_*`，值必须来自腾讯 COS/CAM，不是 MinIO。

先检查容器是否拿到非空配置，但不要输出 SecretKey：

```bash
docker compose --env-file .env.prod -f compose.prod.yml exec server \
  env | awk -F= '/^MINIO_(ENDPOINT|ACCESS_KEY|BUCKET)=/ {print $1 "=" $2}'
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
curl -sS http://127.0.0.1/api/v1/health/ready
```

### 7.3 COS 小册导入验证

确认源目录存在：

```bash
find /data/personal-hub/content-local -maxdepth 2 -type f | head -20
```

先执行 dry-run，并显式指定生产超级管理员邮箱：

```bash
docker compose --env-file .env.prod -f compose.prod.yml run --rm --no-deps \
  -v /data/personal-hub/content-local:/var/import/content-local:ro \
  server npx tsx src/cli/import-local-booklets.ts \
  --source /var/import/content-local \
  --owner-email '1294072632@qq.com' \
  --dry-run
```

确认小册数量、章节数量和告警后，再执行正式导入：

```bash
docker compose --env-file .env.prod -f compose.prod.yml run --rm --no-deps \
  -v /data/personal-hub/content-local:/var/import/content-local:ro \
  server npx tsx src/cli/import-local-booklets.ts \
  --source /var/import/content-local \
  --owner-email '1294072632@qq.com' \
  --execute
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
docker compose --env-file .env.prod -f compose.prod.yml up -d --force-recreate server server-worker
```

确认 `server` 容器收到配置，但不要打印 API Key：

```bash
docker compose --env-file .env.prod -f compose.prod.yml exec server \
  env | awk -F= '/^AI_(TEXT_PROVIDER|OPENAI_BASE_URL|OPENAI_MODEL|OPENAI_TIMEOUT_MS)=/ {print $1 "=" $2}'
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

如果 AI 页面仍显示 Fake，优先检查：

```bash
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=200 server
docker compose --env-file .env.prod -f compose.prod.yml exec server \
  env | awk -F= '/^AI_TEXT_PROVIDER=|^AI_OPENAI_MODEL=|^AI_OPENAI_BASE_URL=/ {print $1 "=" $2}'
```

如果厂商不是 OpenAI-compatible，不能只填地址，需要后续增加独立 Provider 适配器。

