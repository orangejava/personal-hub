# 生产上线验收手册

> 适用：公网 IP + Docker Compose 首版
> 前置：[生产服务器操作手册](./production-runbook.md) 已完成首次启动、migration、seed、bootstrap，以及第二阶段的 worker/Nginx 启动

本手册用于上线后的真实环境验收。所有命令在服务器执行，所有浏览器操作使用公网地址。

## 1. 验收原则

- 每一步记录结果，失败就停在当前步骤；
- 不在命令行、日志、截图或聊天中输出密码、授权码、SecretKey、JWT 或 AI Key；
- 小册正式导入前先完成备份和 dry-run；
- 当前 AI 验收范围是文本对话；图片和视频页面仍按现有 Fake/Mock 行为检查页面流程；
- HTTP + 公网 IP 仅适合个人测试，不能替代 HTTPS 的传输安全。

## 2. 记录发布版本

```bash
cd /opt/personal-hub
git rev-parse --short HEAD
git status --short
docker compose --env-file .env.prod -f compose.prod.yml ps
```

工作区应为干净状态，或明确记录本次服务器上的本地改动。

## 3. 容器和健康检查

```bash
docker compose --env-file .env.prod -f compose.prod.yml ps
curl -i http://127.0.0.1/api/v1/health/live
curl -i http://127.0.0.1/api/v1/health/ready
```

预期：

- `live` 返回 HTTP 200；
- migration 完成后 `ready` 返回 HTTP 200；
- `ready` 中 `database`、`redis`、`objectStorage` 均为 `up`；
- `postgres`、`redis`、`server`、`server-worker`、`nginx` 没有反复重启；
- Compose 中 `server` 的健康状态为 `healthy`。

如果失败，先查看：

```bash
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=200 server
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=200 server-worker
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=200 nginx
```

## 4. 公网入口和静态页面

将 `<公网IP>` 替换为服务器公网 IPv4：

```bash
curl -I http://<公网IP>/
curl -I http://<公网IP>/admin/
curl -sS http://<公网IP>/api/v1/health/live
```

浏览器依次打开：

1. `http://<公网IP>/`
2. `http://<公网IP>/content`
3. `http://<公网IP>/ai`
4. `http://<公网IP>/admin/`

检查页面静态资源没有 404，浏览器控制台没有新增错误。

## 5. 管理员和登录链路

使用 bootstrap 创建的管理员账号：

1. 打开用户端登录页；
2. 使用一次性密码登录；
3. 按页面要求立即修改密码；
4. 刷新页面，确认仍保持登录；
5. 打开 `/admin/`，确认管理端可以加载；
6. 登出；
7. 使用新密码重新登录；
8. 打开登录设备页面，确认当前会话存在；
9. 执行一次“撤销其他会话”，确认当前会话仍可用。

HTTP 首版需要额外确认：浏览器开发者工具中 Cookie 没有被错误地标记为
`Secure`，否则公网 HTTP 下会出现登录后立即掉线。

## 6. 注册、验证邮件和密码重置

使用一个专门的测试邮箱，不要使用重要账号：

1. 注册测试账号；
2. 检查 QQ 邮箱是否收到验证邮件；
3. 点击验证链接；
4. 回到页面确认账号已验证；
5. 退出登录；
6. 使用“忘记密码”发送重置邮件；
7. 点击重置链接设置新密码；
8. 使用新密码登录；
9. 检查发件人地址与 `MAIL_FROM` 一致。

服务器只检查不含密码的 SMTP 配置：

```bash
docker compose --env-file .env.prod -f compose.prod.yml exec server \
  env | awk -F= '/^SMTP_(HOST|PORT|SECURE|USER)=/ {print $1 "=" $2}'
```

不要执行会输出 `SMTP_PASSWORD` 的 `env` 命令。

## 7. 内容和小册阅读

### 7.1 内容中心

1. 打开公开内容列表；
2. 打开公开文章详情；
3. 打开需要登录的内容；
4. 未登录时确认受保护内容不会泄露正文；
5. 登录后确认正文可读；
6. 在管理端修改一条内容状态；
7. 回到用户端刷新，确认状态变化生效。

### 7.2 小册导入

先确认源文件仍然存在：

```bash
find /data/personal-hub/content-local -maxdepth 2 -type f | head -20
```

先 dry-run：

```bash
docker compose --env-file .env.prod -f compose.prod.yml run --rm --no-deps \
  -v /data/personal-hub/content-local:/var/import/content-local:ro \
  server node dist/cli/import-local-booklets.js \
  --source /var/import/content-local \
  --owner-email '<生产管理员邮箱>' \
  --dry-run
```

确认小册、章节和告警数量后再正式导入：

```bash
docker compose --env-file .env.prod -f compose.prod.yml run --rm --no-deps \
  -v /data/personal-hub/content-local:/var/import/content-local:ro \
  server node dist/cli/import-local-booklets.js \
  --source /var/import/content-local \
  --owner-email '<生产管理员邮箱>' \
  --execute
```

导入后检查：

1. 用户端小册列表可见；
2. 目录页可打开；
3. 至少打开两个章节；
4. 封面、正文对象均可读取；
5. 数据库元数据和页面数量一致；
6. `server-worker` 没有持续失败；
7. 确认备份后再清理一次性源目录。

## 8. COS 对象存储

### 8.1 健康检查

`ready` 必须包含：

```text
objectStorage: up
```

检查容器收到的非敏感配置：

```bash
docker compose --env-file .env.prod -f compose.prod.yml exec server \
  env | awk -F= '/^MINIO_(ENDPOINT|ACCESS_KEY|BUCKET)=/ {print $1 "=" $2}'
```

### 8.2 业务读写

通过用户端或管理端完成一次完整流程：

1. 上传一个小文件或封面；
2. 确认页面显示上传成功；
3. 在 COS 控制台确认对象出现；
4. 下载或预览对象；
5. 删除测试对象；
6. 确认对象和数据库 FileAsset 状态一致。

测试对象使用明显的临时前缀，避免误删业务文件。

## 9. OpenRouter 文本 AI

确认非敏感配置已经注入：

```bash
docker compose --env-file .env.prod -f compose.prod.yml exec server \
  env | awk -F= '/^AI_(TEXT_PROVIDER|OPENAI_BASE_URL|OPENAI_MODEL|OPENAI_TIMEOUT_MS)=/ {print $1 "=" $2}'
```

不得输出 `AI_OPENAI_API_KEY`。

浏览器验收：

1. 打开 `/ai`；
2. 确认 AI home 加载成功；
3. 打开 AI 对话；
4. 发送一条短问题；
5. 确认回复以流式文本持续显示；
6. 确认对话完成后显示用量；
7. 刷新页面，确认会话历史存在；
8. 重新生成一次，确认没有异常重复扣费；
9. 检查服务日志没有 API Key。

```bash
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=200 server
```

如果页面仍显示内置演示模型，确认 `AI_TEXT_PROVIDER` 为
`openai_compatible`、模型 ID 来自 OpenRouter 当前模型列表，然后执行 runbook §7.4 的
`sync-ai-catalog.ts`。这一步只同步 AI 目录，不会输出 API Key 或重跑完整 seed。

## 10. Worker 和异步任务

```bash
docker compose --env-file .env.prod -f compose.prod.yml ps server-worker
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=200 server-worker
```

预期：

- Worker 持续运行；
- 没有反复退出或重启；
- 没有 Redis 连接失败；
- 没有数据库连接失败；
- 没有 COS 权限错误。

## 11. 数据库备份

首次验收完成后至少生成一份数据库备份：

```bash
backup_dir="/data/personal-hub/backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup_dir"

docker compose --env-file .env.prod -f compose.prod.yml exec -T postgres \
  sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  > "$backup_dir/personal_hub.sql"

chmod 600 "$backup_dir/personal_hub.sql"
ls -lh "$backup_dir/personal_hub.sql"
```

确认备份文件大小大于 0，并将备份复制到服务器之外的安全位置。不要把备份文件提交
Git，也不要把数据库备份上传到公开目录。

## 12. 验收记录

上线后记录：

- Git commit；
- 上线时间；
- `live` / `ready` 结果；
- 管理员登录和改密结果；
- 邮件验证和密码重置结果；
- COS 上传、下载、删除结果；
- 小册导入数量；
- OpenRouter 模型 ID 和文本对话结果；
- Worker 状态；
- 数据库备份路径和文件大小；
- 失败项、日志位置和处理结论。

所有项目通过后，再对外通知站点地址。
