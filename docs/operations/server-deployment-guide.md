# 服务器部署实操指南

> 面向：已有云服务器、项目仍在本地/React-first mock 阶段的首次上线
> 最后更新：2026-07-21
>
> 长期架构与 CI/CD 见 [deployment.md](./deployment.md)。本文侧重**现在就能执行的步骤**。

---

## 一、先回答几个常见问题

### 1. 代码要不要走 Git？

**要，但只放代码，不放大体积内容。**

| 内容 | 是否进 Git | 说明 |
| --- | --- | --- |
| 源码、`docs/`、`packages/` | ✅ 是 | 私有仓库（GitHub / Gitee / GitLab 均可） |
| `node_modules/`、构建产物 | ❌ 否 | 已在 `.gitignore` |
| `.env`、密钥 | ❌ 否 | 只在服务器本地维护 |
| `content-local/`（本地小册） | ❌ 否 | 已在 `.gitignore`，体积大、更新频繁 |
| `local-booklets.generated.ts` | ❌ 否 | 构建时在服务器上由脚本生成 |

推荐流程：

```
本地开发 → push 到 Git 远程仓库 → 服务器 git pull → pnpm install → build → 重启服务
```

Git 单文件建议上限 **50～100MB**；大文件应走对象存储或 rsync，不要强行提交。

### 2. 本地小册要不要传到线上？放哪里？

**要传，但不要和代码仓库混在一起。**

当前小册同步链路：

```
content-local/booklets/          ← 原始 Markdown + meta.json（不进 Git）
        ↓ pnpm sync:booklets
apps/react-web/mock/data/local-booklets.generated.ts   ← 构建时生成（不进 Git）
        ↓ Umi mock / 未来 NestJS API
页面可读
```

服务器推荐目录（与代码**同级或独立挂载**，不要塞进 `.git` 工作区里当源码提交）：

```
/opt/personal-hub/                 # Git 仓库（代码）
/data/personal-hub/
  ├── content-local/booklets/      # 小册源文件（rsync / COS 同步到此）
  ├── uploads/                     # 未来用户上传（PDF/Word/封面等）
  └── backups/                     # 数据库与文件备份
```

为什么单独放 `/data/`：

- 小册可能有几十上百本，体积远大于代码
- 重装系统、换实例时，数据盘可单独保留
- 备份策略可以只对 `/data/` 做快照，不影响代码发布

**本地 → 服务器同步小册示例：**

```bash
# 在本地执行（替换为你的服务器 IP 与用户）
rsync -avz --progress \
  ./content-local/booklets/ \
  deploy@YOUR_SERVER:/data/personal-hub/content-local/booklets/
```

同步后在服务器上让脚本读这个目录：当前 `sync-local-booklets.ts` 默认扫描仓库内 `content-local/`。首版上线有两种做法（二选一）：

**做法 A（简单）**：在服务器仓库根目录建软链

```bash
ln -s /data/personal-hub/content-local ./content-local
```

**做法 B（更清晰）**：后续改脚本支持环境变量 `BOOKLETS_INPUT_DIR`（接入 NestJS 时再改也不迟）。

### 3. 腾讯 COS 能不能用？

**能用，但要分清场景。**

| 场景 | 是否适合 COS | 说明 |
| --- | --- | --- |
| 小册 / 上传文件的**备份** | ✅ 非常适合 | 便宜、可版本化、异地容灾 |
| PDF、封面、附件的**CDN 加速** | ✅ 适合 | 绑自定义域名，Nginx 或后端签名 URL |
| 数据库备份归档 | ✅ 适合 | 配合 cron + coscli |
| `sync:booklets` 的**直接读取源** | ⚠️ 不推荐 | 脚本读本地目录；COS 需先同步到服务器磁盘 |
| 替代 PostgreSQL / Redis | ❌ 不适合 | 结构化数据仍用数据库 |

推荐组合：

```
开发机 content-local  ──rsync/coscli──►  服务器 /data/content-local
                                              ↓ sync:booklets
                                         mock / API 可读
服务器 /data/backups   ──coscli──►       腾讯 COS（长期保留）
```

COS 同步示例（需先 [安装 coscli](https://cloud.tencent.com/document/product/436/63143) 并配置密钥）：

```bash
# 上传本地小册到 COS（备份）
coscli sync content-local/booklets/ cos://your-bucket/booklets/ -r

# 服务器从 COS 拉取到本地目录（部署/恢复）
coscli sync cos://your-bucket/booklets/ /data/personal-hub/content-local/booklets/ -r
```

---

## 二、当前阶段能力边界（必读）

截至 **React-first 阶段 5**，仓库状态：

| 已有 | 尚未有 |
| --- | --- |
| `apps/react-web` 完整前端 + Umi mock | `apps/api`（NestJS） |
| 本地小册 sync 脚本 | PostgreSQL / Redis 生产实例 |
| 静态资源 build | 生产级 mock（build 后 mock 默认关闭） |

**含义**：现在上线的是「带 mock 数据的预览站」，不是最终生产架构。Umi 的 mock **仅在 dev 模式生效**；`pnpm build` 后的静态站点**不会**自动带上 `/api/*`。

当前可选上线方案：

| 方案 | 适用 | 优点 | 缺点 |
| --- | --- | --- | --- |
| **A. PM2 跑 dev + mock** | 个人站、内测、低流量 | 与本地一致，小册/mock 全可用 | 非标准生产形态，需限制访问 |
| **B. 等 NestJS 后再公网开放** | 正式对外 | 架构正确 | 现在不能完整上线 |
| **C. 静态 export + 独立 mock 服务** | 中级方案 | 前端可 CDN | 需额外封装 mock，工作量大 |

**首版建议**：方案 A，Nginx 反代 + 可选 Basic Auth，流量可控时再切 NestJS。

---

## 三、服务器前置准备

### 3.1 推荐规格

与 [deployment.md](./deployment.md) 一致：

| 项目 | 建议 |
| --- | --- |
| 系统 | Ubuntu 22.04 LTS |
| CPU / 内存 | 2 核 4GB（mock 预览足够） |
| 磁盘 | 系统盘 40GB + 数据盘 ≥ 100GB（小册、备份） |
| 域名 | 已解析 A 记录到服务器公网 IP |
| 端口 | 开放 22（SSH）、80、443 |

### 3.2 安装基础软件

以 `deploy` 用户 + sudo 为例：

```bash
# 系统更新
sudo apt update && sudo apt upgrade -y

# 常用工具
sudo apt install -y git curl wget unzip nginx certbot python3-certbot-nginx

# Node.js 22（使用 NodeSource）
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# pnpm
corepack enable
corepack prepare pnpm@10.28.2 --activate

# PM2（守护 Node 进程）
sudo npm install -g pm2

# 可选：Docker（NestJS 阶段再用）
# sudo apt install -y docker.io docker-compose-plugin
```

验证：

```bash
node -v    # v22.x
pnpm -v    # 10.x
nginx -v
pm2 -v
```

### 3.3 目录与权限

```bash
sudo mkdir -p /opt/personal-hub
sudo mkdir -p /data/personal-hub/{content-local/booklets,uploads,backups}
sudo chown -R $USER:$USER /opt/personal-hub /data/personal-hub
```

### 3.4 防火墙

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 四、首次部署（React-first mock 预览）

### 4.1 拉代码

```bash
cd /opt/personal-hub
git clone <你的私有仓库 URL> .
git checkout main   # 或你的发布分支
nvm use 2>/dev/null || true   # 若安装了 nvm
pnpm install
```

### 4.2 同步小册

**在本地电脑：**

```bash
rsync -avz --progress content-local/booklets/ \
  deploy@YOUR_SERVER:/data/personal-hub/content-local/booklets/
```

**在服务器：**

```bash
cd /opt/personal-hub
ln -sf /data/personal-hub/content-local ./content-local
pnpm sync:booklets
# 预期输出：同步完成：N 本小册，M 个章节
```

### 4.3 用 PM2 启动（mock 预览模式）

在仓库根目录创建 `ecosystem.config.cjs`（可提交到 Git）：

```javascript
/** @type {import('pm2').StartOptions} */
module.exports = {
  apps: [
    {
      name: 'personal-hub-web',
      cwd: '/opt/personal-hub',
      script: 'pnpm',
      args: '--filter react-web dev -- --host 0.0.0.0',
      env: {
        NODE_ENV: 'production',
        UMI_ENV: 'dev',
        PORT: 8000,
      },
      max_memory_restart: '800M',
    },
  ],
};
```

```bash
cd /opt/personal-hub
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # 按提示执行 sudo 命令，实现开机自启
```

验证：`curl -I http://127.0.0.1:8000` 应返回 200。

> 说明：此处 intentionally 使用 `dev` 以保留 Umi mock。接入 NestJS 后改为 `build` + `preview` 或 Docker 中的 `web`/`api` 服务。

### 4.4 Nginx 反向代理

```bash
sudo nano /etc/nginx/sites-available/personal-hub
```

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -sf /etc/nginx/sites-available/personal-hub /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 4.5 HTTPS

```bash
sudo certbot --nginx -d yourdomain.com
# 自动续期已由 certbot 写入 systemd timer；可手动测试：
sudo certbot renew --dry-run
```

### 4.6 可选：Basic Auth（内测期推荐）

```bash
sudo apt install -y apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd youruser

# 在 location / 内增加：
# auth_basic "Restricted";
# auth_basic_user_file /etc/nginx/.htpasswd;
```

---

## 五、日常更新发布

### 5.1 只更新代码

```bash
cd /opt/personal-hub
git pull origin main
pnpm install
pnpm sync:booklets    # 若小册有变
pm2 restart personal-hub-web
```

### 5.2 只更新小册

```bash
# 本地 rsync 后，在服务器：
pnpm sync:booklets
pm2 restart personal-hub-web
```

### 5.3 发布检查清单

- [ ] `git pull` 无冲突
- [ ] `pnpm sync:booklets` 章节数符合预期
- [ ] `pm2 status` 为 online
- [ ] 浏览器打开首页、内容中心、小册阅读页
- [ ] 登录 mock 账号可用（见 `docs/engineering/dev-credentials.md`）
- [ ] `pm2 logs personal-hub-web --lines 50` 无持续报错

---

## 六、备份策略（含 COS）

### 6.1 小册与上传文件

```bash
#!/bin/bash
# /opt/scripts/backup-files.sh
DATE=$(date +%Y%m%d)
tar -czf /data/personal-hub/backups/content-local_$DATE.tar.gz \
  -C /data/personal-hub content-local

find /data/personal-hub/backups -name "content-local_*.tar.gz" -mtime +7 -delete
```

### 6.2 同步到腾讯 COS

```bash
# crontab -e
# 每天 3:30 备份并上传
30 3 * * * /opt/scripts/backup-files.sh && coscli sync /data/personal-hub/backups/ cos://your-bucket/backups/ -r
```

### 6.3 后续 NestJS 阶段

PostgreSQL 备份脚本见 [deployment.md](./deployment.md#数据备份策略)。

---

## 七、下一阶段：接入 NestJS 后的生产拓扑

当 `apps/api` 落地后，从 mock 预览迁移到正式部署：

```
外部 HTTPS
    ↓
Nginx
    ├── /        → Next.js 或 react-web 静态/SSR（端口 3000）
    ├── /api/    → NestJS（端口 3001，SSE 需关闭 proxy_buffering）
    └── /assets/ → COS CDN 或 MinIO 签名 URL

Docker Compose（/opt/personal-hub）
    ├── api
    ├── postgres  → 数据卷 /data/postgres
    ├── redis     → 数据卷 /data/redis
    └── minio     → 可选，或与腾讯 COS 二选一
```

迁移步骤概要：

1. 服务器安装 Docker，`docker compose up -d postgres redis`
2. 小册从 mock 导入脚本写入 PostgreSQL（需开发导入任务）
3. 前端 `MOCK=none`，API 指向 `https://yourdomain.com/api`
4. PM2 改为 Docker Compose + GitHub Actions SSH 部署（见 [deployment.md](./deployment.md#cicd-流程)）
5. 关闭 dev mock 进程

---

## 八、故障排查

| 现象 | 可能原因 | 处理 |
| --- | --- | --- |
| 小册列表为空 | `content-local` 未同步或软链错误 | 检查 `/data/.../booklets` 与 `pnpm sync:booklets` 输出 |
| `/api/*` 404 | 用了 `build`+静态站，mock 未启用 | 改回 PM2 dev mock 或等待后端 |
| 502 Bad Gateway | Node 未启动或端口不对 | `pm2 status`、`curl localhost:8000` |
| 内存占用高 | dev 模式 + 大项目 | 升配或限制 `max_memory_restart` |
| GitHub clone 慢 | 网络 | 改用 Gitee 镜像或服务器上配置 SSH |

---

## 九、本地与服务器对照

| 项目 | 本地 | 服务器 |
| --- | --- | --- |
| 代码 | `~/projects/personal-hub` | `/opt/personal-hub` |
| 小册 | `content-local/booklets/` | `/data/personal-hub/content-local/booklets/` |
| 启动 | `pnpm dev:react` | PM2 + `react-web dev --host 0.0.0.0` |
| 访问 | http://localhost:8000 | https://yourdomain.com |
| 密钥 | 无（mock） | 未来 `/opt/personal-hub/.env` |

---

## 十、相关文档

- [deployment.md](./deployment.md) — 长期 Docker / CI/CD / Nginx 模板
- [../engineering/engineering-guide.md](../engineering/engineering-guide.md) — 本地开发与目录规范
- [../engineering/dev-credentials.md](../engineering/dev-credentials.md) — mock 登录账号
- [../product/content-system.md](../product/content-system.md) — 小册与文件存储模型
