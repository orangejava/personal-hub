# React mock 阶段服务器部署速查

> 一页纸命令清单，仅适用于 `apps/user-web` 的 Umi mock + PM2 阶段，不适用于 Nest 服务。路线图见 [deployment-plan.md](./deployment-plan.md)；**PM2 排障见 [pm2-deployment.md](./pm2-deployment.md)**。
> 细节见 [personal-remote-reading.md](./personal-remote-reading.md)。长期 Docker / CI/CD 见 [deployment.md](./deployment.md)。  
> Nest 本地启动见 [`apps/server/README.md`](../../apps/server/README.md)，生产策略见 [nest-compose-strategy.md](./nest-compose-strategy.md)。
> 最后更新：2026-07-27。

---

## 目录（与设计一致）

| 路径 | 用途 |
| --- | --- |
| `/opt/personal-hub` | **Git 仓库根**（所有命令都在这里执行） |
| `/data/personal-hub/content-local` | 小册源文件 |

> **不会套娃：** `git pull` 只在当前仓库里更新文件，**不会**再生成 `/opt/personal-hub/personal-hub`。  
> 只有首次克隆时写错命令才会套娃：`git clone <url>`（缺末尾 `.`）→ 应使用 `git clone <url> .`

```bash
# 确认你在正确目录（应能看到 ecosystem.config.js）
ls /opt/personal-hub/ecosystem.config.js

# 若误克隆出嵌套目录，说明当初 clone 命令少了末尾的点
ls /opt/personal-hub/personal-hub   # 存在则说明路径错了，应改在 /opt/personal-hub 操作
```

```bash
sudo mkdir -p /opt/personal-hub /data/personal-hub/content-local
sudo chown -R "$USER:$USER" /opt/personal-hub /data/personal-hub
```

## 一次性环境

```bash
sudo apt update && sudo apt install -y git curl build-essential
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
corepack enable && corepack prepare pnpm@10.28.2 --activate
sudo npm install -g pm2
node -v && pnpm -v && pm2 -v
```

## Git（服务器用 Gitee）

| 环境 | 远程 |
| --- | --- |
| 本地开发 | GitHub `origin` + Gitee `gitee` |
| **服务器** | **仅 Gitee**（国内可访问） |

```bash
cd /opt/personal-hub
# 首次
git clone https://gitee.com/oralemon/personal-hub.git .
git checkout develop    # 与发布分支一致
pnpm install

# 日常（本地先 git push gitee develop）
git pull
pnpm install
```

SSH 方式（推荐）：`git@gitee.com:oralemon/personal-hub.git`

## 小册（本机 → 服务器，不进 Git）

```bash
# 本机仓库根：按白名单 rsync（详见 pm2-deployment.md §4.3）
rsync -avz --progress ./content-local/<小册名> \
  <用户>@<IP>:/data/personal-hub/content-local/
```

```bash
# 服务器（可选软链；PM2 启动脚本也会读 CONTENT_LOCAL_DIR）
cd /opt/personal-hub
ln -sfnT /data/personal-hub/content-local ./content-local
CONTENT_LOCAL_DIR=/data/personal-hub/content-local pnpm sync:booklets
# PM2 启动/重启时也会自动 sync
```

## 启动（阶段 A：dev，非 build）

仓库使用 PM2 标准配置文件名 `ecosystem.config.js`。必须看到进程名 `personal-hub-dev`；若出现 `ecosystem.dev`，说明旧配置被当成普通脚本执行。

```bash
cd /opt/personal-hub
pm2 delete ecosystem.dev 2>/dev/null || true
pm2 delete personal-hub-dev 2>/dev/null || true
pm2 start ecosystem.config.js --only personal-hub-dev   # 启动前自动 sync 小册
pm2 save
pm2 startup                    # 执行输出的 sudo 命令
pm2 logs personal-hub-dev --lines 50 --nostream
curl -I http://127.0.0.1:8000
```

若 PM2 仍无法识别 ecosystem 配置，使用兜底命令（见 [pm2-deployment.md §5.3](./pm2-deployment.md)）。

## 分层验证

先在服务器内验证应用，再验证公网。服务器内成功不代表安全组已经放行。

```bash
pm2 status
ss -lntp | grep ':8000'
curl -I http://127.0.0.1:8000/content
curl -I http://127.0.0.1:8000/workspace/booklets
```

公网：`http://<服务器公网 IPv4>:8000/content`。安全组 TCP 8000，来源优先填客户端真实公网 IP `/32`。

## 日常更新（推荐一条命令）

**代码有更新时**（本地先 `git push gitee develop`）：

```bash
cd /opt/personal-hub
pnpm deploy:server
# 等价：./scripts/deploy-server.sh
```

**代码没改，只想重启**（例如只 rsync 了小册）：

```bash
pm2 restart personal-hub-dev
```

**代码没改，但想重装依赖**：

```bash
pnpm deploy:server -- --no-pull
```

依赖异常 / lock 大变更时：

```bash
pnpm deploy:server -- --clean
```

## 从手动上传迁到 Git

若 `/opt/personal-hub` 无 `.git`，见 [deployment-plan.md §5.2](./deployment-plan.md#52-从第一版手动上传迁移到-gitee你的现状)。  
**不要动** `/data/personal-hub/content-local`。

## 排障

| 现象 | 命令 / 说明 |
| --- | --- |
| PM2 errored | `pm2 logs personal-hub-dev --err`；见 [pm2-deployment.md §2](./pm2-deployment.md#2-旧文档常见错误对照修复) |
| `personal-hub-dev not found` | 首次 `pm2 start ecosystem.config.js --only personal-hub-dev` |
| PM2 显示 `ecosystem.dev online` 但端口为空 | `pm2 delete ecosystem.dev`，改用 `ecosystem.config.js` |
| 服务器 `curl` Connection refused | 看 `pm2 logs`；等 Umi 首次编译完成 |
| 服务器 curl 200、公网超时 | 检查云安全组、公网 IP、来源 CIDR |
| 只在 `0.0.0.0/0` 时能访问 | 原 `/32` 不是真实公网出口（VPN/代理/动态 IP） |
| 小册空 | `ls /data/personal-hub/content-local`；`pnpm sync:booklets` |
| 内存高 | `free -h`；`pm2 restart personal-hub-dev` |
