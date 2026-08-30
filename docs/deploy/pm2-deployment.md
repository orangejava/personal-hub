# PM2 部署指南（阶段 A：个人远程阅读）

> 状态：已对照代码验证  
> 最后更新：2026-07-27  
> 适用：Ubuntu 22.04 / 24.04，2 核 4G，**dev + Umi mock**，端口 **8000**  
> 背景方案：[personal-remote-reading.md](./personal-remote-reading.md) · 一页速查：[server-deployment-guide.md](./server-deployment-guide.md)

---

## 1. 部署目标与代码事实

| 项 | 说明 |
| --- | --- |
| 应用 | Monorepo 根目录下的 `apps/user-web`（Umi Max 4） |
| 启动方式 | **dev 模式**（`max dev`），不是 `build` + 静态托管 |
| 数据 | 小册在 `/data/.../content-local/` → **启动前自动** `sync:booklets` → `mock/data/local-booklets.generated.ts` |
| 端口 | 默认 **8000**（Umi dev server） |
| PM2 配置 | 仓库根 [`ecosystem.config.js`](../../ecosystem.config.js) + [`scripts/pm2-start-dev.sh`](../../scripts/pm2-start-dev.sh) |
| Node | **≥ 22**（见根 `package.json` engines） |
| 包管理 | **pnpm 10.28.2**（见根 `packageManager`） |

**为何用 dev 而不是 build：** `pnpm build:react` 后 mock 不生效，`/api/*` 无数据；当前阶段尚未接入 NestJS API。见 [personal-remote-reading.md §2.3](./personal-remote-reading.md#23-生产构建现状)。

---

## 2. 旧文档常见错误（对照修复）

若在旧版 [server-deployment-guide.md](./server-deployment-guide.md) 或 [personal-remote-reading.md §A.4](./personal-remote-reading.md#a4-用-pm2-跑-dev不是-build) 部署失败，优先核对下表：

| 现象 | 根因 | 正确做法 |
| --- | --- | --- |
| PM2 日志出现 `SyntaxError` / `Unexpected token` | 直接用 `pnpm` 作 script 且未设 `interpreter: 'none'` | 使用 `ecosystem.config.js` + `scripts/pm2-start-dev.sh`（`interpreter: 'bash'`） |
| `pm2 status` 显示 errored / 找不到 pnpm | systemd 环境下 **PATH 不含 corepack 的 pnpm** | 见 §5.3 用 `which pnpm` 写绝对路径，或装全局 pnpm |
| 外网访问不了 :8000 | 未监听 `0.0.0.0` 或安全组未放行 | 环境变量 `HOST=0.0.0.0`；云安全组放行你的 IP → 8000 |
| 小册列表为空 | 未 rsync / 未生成 `local-booklets.generated.ts` / 目录内无 `.md` | 确认 `/data/personal-hub/content-local` 有小册文件夹；`pm2 restart` 会自动 sync（见 §5） |
| 在 `apps/user-web` 里 `pnpm install` | Monorepo 必须在**仓库根**安装 | 始终在 `/opt/personal-hub` 执行 `pnpm install` |
| 首次 `curl` 失败但 PM2 online | Umi 首次编译需 **1～3 分钟** | 看 `pm2 logs` 出现 `App listening at` 再访问 |
| pnpm 10 提示 Ignored build scripts | 默认拦截依赖 postinstall | 见 §4.2 执行 `pnpm approve-builds` 或配置 onlyBuiltDependencies |

---

## 3. 服务器目录

```text
/opt/personal-hub/                    # Git 仓库根
├── ecosystem.config.js              # PM2 配置（CONTENT_LOCAL_DIR 指向 /data/...）
├── scripts/pm2-start-dev.sh          # 启动前 sync:booklets + dev
├── apps/user-web/mock/data/
│   └── local-booklets.generated.ts   # sync 生成（gitignore，勿手改）
/data/personal-hub/content-local/     # 小册源文件（每本一个子目录 + *.md）
```

```bash
sudo mkdir -p /opt/personal-hub /data/personal-hub/content-local
sudo chown -R "$USER:$USER" /opt/personal-hub /data/personal-hub
```

---

## 4. 一次性安装

### 4.1 系统依赖 + Node 22 + pnpm + PM2

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential

# Node.js 22（NodeSource）
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

node -v   # 应 >= v22.x
```

**pnpm（与仓库 lock 一致）：**

```bash
corepack enable
corepack prepare pnpm@10.28.2 --activate
pnpm -v   # 应 10.28.2
```

**PM2（全局 npm 安装，与 pnpm 分离无妨）：**

```bash
sudo npm install -g pm2
pm2 -v
```

> 若 corepack 的 `pnpm` 在 `pm2 startup` 后找不到，见 §5.3。

### 4.2 拉代码并安装依赖

```bash
cd /opt/personal-hub
git clone <你的仓库 URL> .
git checkout main

pnpm install
```

pnpm 10 若提示 `Ignored build scripts`，需允许 esbuild 等构建脚本（Umi 依赖）：

```bash
# 交互式：空格选中 esbuild 相关项后确认
pnpm approve-builds

# 或非交互（按需追加其它包名）
pnpm config set --location project onlyBuiltDependencies[0] esbuild
pnpm config set --location project onlyBuiltDependencies[1] core-js
pnpm install
```

`pnpm install` 会触发 `apps/user-web` 的 `prepare`（`max setup` + `sync:booklets`）。此时尚无小册是正常的，会生成空 mock 数组。

### 4.3 同步小册（本机 → 服务器）

**本机（仓库根）**，仅同步白名单内小册（与 `apps/user-web/src/scripts/sync-allowlist.json` 一致）：

```bash
rsync -avz --progress \
  "./content-local/Nest 通关秘籍  最新200-upgrade" \
  "./content-local/Nest 通关秘籍  最新200章" \
  "./content-local/Next.js 开发指南" \
  "./content-local/Next.js 开发指南-upgrade" \
  "./content-local/React 进阶实践指南" \
  "./content-local/React 通关秘籍" \
  "./content-local/React 组合式开发实践：打造企业管理系统五大核心模块" \
  "./content-local/Redis 深度历险：核心原理与应用实践" \
  "./content-local/Electron 应用开发实践指南" \
  "./content-local/TypeScript 入门教程" \
  "./content-local/TypeScript 全面进阶指南" \
  "./content-local/Linux 命令速查与服务器运维入门" \
  <用户>@<服务器IP>:/data/personal-hub/content-local/
```

**服务器（可选手动 sync；PM2 启动时会自动执行）：**

```bash
cd /opt/personal-hub
CONTENT_LOCAL_DIR=/data/personal-hub/content-local pnpm sync:booklets
# 外部目录会同步全部子文件夹（忽略本地开发白名单）
# 日志应含：同步完成：N 本小册，M 个章节
```

---

## 5. PM2 启动

### 5.1 启动与验证

```bash
cd /opt/personal-hub
pm2 delete personal-hub-dev 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

# 等待 Umi 编译完成（首次约 1～3 分钟）
pm2 logs personal-hub-dev --lines 50
# 看到 "App listening at" 且 Network 为 0.0.0.0:8000 后继续

curl -I http://127.0.0.1:8000
pm2 status
```

### 5.2 开机自启

```bash
pm2 startup
# 复制并执行输出的 sudo 命令（仅一次）
pm2 save
```

### 5.3 PM2 找不到 pnpm 时

`scripts/pm2-start-dev.sh` 会调用 `pnpm`。若 systemd 环境下 PATH 不含 pnpm：

```bash
sudo npm install -g pnpm@10.28.2
which pnpm   # 确认在 PATH 中
```

### 5.4 当前 ecosystem.config.js 要点

```javascript
{
  name: 'personal-hub-dev',
  cwd: __dirname,
  script: 'scripts/pm2-start-dev.sh',  // 先 sync:booklets，再 dev
  interpreter: 'bash',
  env: {
    CONTENT_LOCAL_DIR: '/data/personal-hub/content-local',  // 小册源目录
    HOST: '0.0.0.0',
    PORT: '8000',
    UMI_ENV: 'dev',
  },
  max_memory_restart: '1500M',
}
```

等价手动命令（调试用）：

```bash
cd /opt/personal-hub
CONTENT_LOCAL_DIR=/data/personal-hub/content-local pnpm sync:booklets
HOST=0.0.0.0 PORT=8000 pnpm --filter user-web dev:mock
```

---

## 6. 网络与安全

### 6.1 云安全组（推荐）

入站：**仅你的公网 IP** → **TCP 8000**。不要对 `0.0.0.0/0` 开放 8000（当前 mock 无真实鉴权）。

### 6.2 SSH 隧道（更安全，可不开放 8000）

本机执行：

```bash
ssh -L 8000:127.0.0.1:8000 <用户>@<服务器IP>
```

浏览器访问 `http://localhost:8000`。此时可将 `ecosystem.config.js` 中 `HOST` 改为 `127.0.0.1`。

### 6.3 验证页面

```text
http://<服务器IP>:8000/content
http://<服务器IP>:8000/workspace/booklets
http://<服务器IP>:8000/content/booklets/<id>/chapters/<chapterId>
```

Mock 登录（dev）：`admin` / `ant.design` 或 `user` / `ant.design`。

---

## 7. 日常运维

### 7.1 一键部署（推荐）

仓库提供 [`scripts/deploy-server.sh`](../../scripts/deploy-server.sh)，合并你原先手动的 `git pull` → 删包 → `pnpm install` → PM2 重启：

```bash
cd /opt/personal-hub
pnpm deploy:server
# 等价：./scripts/deploy-server.sh
```

脚本步骤：

1. `git pull --ff-only`
2. （可选 `--clean`）删除 `node_modules` 后重装
3. `pnpm install`
4. `pm2 restart personal-hub-dev`（或首次 `pm2 start ecosystem.config.js`）

PM2 重启时会执行 `scripts/pm2-start-dev.sh`，**自动 sync 小册**，无需再单独跑 `sync:booklets`。

| 场景 | 命令 |
| --- | --- |
| 代码有更新 | `pnpm deploy:server` |
| 代码未改，只重启 / 只更新小册 | `pm2 restart personal-hub-dev` |
| 代码未改，重装依赖 | `pnpm deploy:server -- --no-pull` |
| 依赖异常 | `pnpm deploy:server -- --clean` |

### 7.2 只更新代码（手动）

```bash
cd /opt/personal-hub
git pull && pnpm install && pm2 restart personal-hub-dev
```

### 7.3 只更新小册

```bash
# 本机 rsync 后，服务器只需重启（启动脚本会自动 sync）：
pm2 restart personal-hub-dev
```

### 7.4 常用 PM2 命令

| 操作 | 命令 |
| --- | --- |
| 状态 | `pm2 status` |
| 日志 | `pm2 logs personal-hub-dev` |
| 重启 | `pm2 restart personal-hub-dev` |
| 停止 | `pm2 stop personal-hub-dev` |
| 内存 | `pm2 monit` |

---

## 8. 排障清单

| 现象 | 检查 | 处理 |
| --- | --- | --- |
| PM2 errored | `pm2 logs personal-hub-dev --err --lines 50` | 看 `scripts/pm2-start-dev.sh` 是否可执行；pnpm 是否在 PATH；仓库根 `pnpm install` |
| 8000 无监听 | `ss -tlnp \| grep 8000` | 等编译完成；看日志是否 OOM（`free -h`） |
| 小册空 | `ls /data/personal-hub/content-local`；`CONTENT_LOCAL_DIR=... pnpm sync:booklets` | 确认子目录含 `*.md`；看 sync 日志「同步完成：N 本」 |
| 编译极慢 / 内存不足 | `free -h`；`pm2 monit` | 2G 机器可临时加 swap；或 `max_memory_restart` 已设 1500M |
| 外网连不上 | 安全组、本机 `curl 127.0.0.1:8000` | 确认 `HOST=0.0.0.0`；隧道方案测本地 |
| API 404 | 是否误用了 `build` 产物 | 阶段 A 必须用 **dev**，mock 仅 dev 生效 |

**清空 PM2 重来：**

```bash
pm2 delete personal-hub-dev
cd /opt/personal-hub && pm2 start ecosystem.config.js && pm2 save
```

---

## 9. 与阶段 B（生产）的边界

| 阶段 A（本文） | 阶段 B（后续） |
| --- | --- |
| PM2 跑 `pnpm dev` | PM2 跑 NestJS + Nginx 托管 `dist/` |
| mock 数据 | 真实 API + 腾讯 COS |
| IP 白名单 :8000 | 域名 + HTTPS |

阶段 B 见 [personal-remote-reading.md §3～6](./personal-remote-reading.md) 与 [deployment.md](./deployment.md)。**不要**在阶段 A 强行 `pnpm build:react` 并用 PM2 跑静态文件——没有后端时页面 API 会全部失败。

---

## 10. 相关文件索引

| 文件 | 作用 |
| --- | --- |
| [`ecosystem.config.js`](../../ecosystem.config.js) | PM2 进程定义 |
| [`scripts/deploy-server.sh`](../../scripts/deploy-server.sh) | 服务器一键部署 |
| [`scripts/pm2-start-dev.sh`](../../scripts/pm2-start-dev.sh) | 启动前同步小册 |
| [`apps/user-web/mock/data/local-booklets.generated.ts`](../../apps/user-web/mock/data/local-booklets.generated.ts) | sync 生成的小册 mock 数据（gitignore） |
| [`package.json`](../../package.json) | 根脚本 `dev:react`、`sync:booklets` |
| [`apps/user-web/package.json`](../../apps/user-web/package.json) | Umi `dev` / `prepare` / `sync:booklets` |
| [`apps/user-web/src/scripts/sync-local-booklets.ts`](../../apps/user-web/src/scripts/sync-local-booklets.ts) | 小册 → mock 生成 |
| [`apps/user-web/src/scripts/sync-allowlist.json`](../../apps/user-web/src/scripts/sync-allowlist.json) | rsync 白名单 |
| [`apps/user-web/mock/content.ts`](../../apps/user-web/mock/content.ts) | 小册 mock API |
