# 服务器部署速查

> 一页纸命令清单。**PM2 排障与错误对照见 [pm2-deployment.md](./pm2-deployment.md)**。  
> 完整说明见 [personal-remote-reading.md](./personal-remote-reading.md)。长期 Docker / CI/CD 见 [deployment.md](./deployment.md)。

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

## 代码

```bash
cd /opt/personal-hub
git clone <你的仓库 URL> .
pnpm install
# pnpm 10 若提示 Ignored build scripts：pnpm approve-builds（选中 esbuild）
```

## 小册（本机 → 服务器，不进 Git）

```bash
# 本机仓库根：按白名单 rsync（详见 pm2-deployment.md §4.3）
rsync -avz --progress ./content-local/<小册名> \
  <用户>@<IP>:/data/personal-hub/content-local/
```

```bash
# 服务器
cd /opt/personal-hub
CONTENT_LOCAL_DIR=/data/personal-hub/content-local pnpm sync:booklets
# PM2 启动时也会自动 sync，一般 restart 即可
```

## 启动（阶段 A：dev，非 build）

```bash
cd /opt/personal-hub
pm2 delete personal-hub-dev 2>/dev/null || true
pm2 start ecosystem.config.js   # 启动前自动 sync 小册
pm2 save
pm2 startup                    # 执行输出的 sudo 命令
pm2 logs personal-hub-dev --lines 50   # 应看到 [sync-booklets] 同步完成 + App listening at
curl -I http://127.0.0.1:8000
```

访问：`http://<IP>:8000`（安全组仅开你的 IP → 8000）  
或 SSH 隧道：`ssh -L 8000:127.0.0.1:8000 <用户>@<IP>`

## 日常更新（推荐一条命令）

**代码有更新时**（拉代码 + 装依赖 + 重启，**不删**业务文件和小册）：

```bash
cd /opt/personal-hub
pnpm deploy:server
# 等价：./scripts/deploy-server.sh 或 pnpm run deploy:server
```

**代码没改，只想重启**（例如只 rsync 了小册）：

```bash
pm2 restart personal-hub-dev
```

**代码没改，但想重装依赖**（仍不删小册、不删 /data 内容）：

```bash
pnpm deploy:server -- --no-pull
```

依赖异常 / lock 大变更时（**仅此时**才删 node_modules）：

```bash
pnpm deploy:server -- --clean
```

## 排障

| 现象 | 命令 / 说明 |
| --- | --- |
| PM2 errored | `pm2 logs personal-hub-dev --err`；见 [pm2-deployment.md §2](./pm2-deployment.md#2-旧文档常见错误对照修复) |
| 打不开 | `pm2 status`；`ss -tlnp \| grep 8000`；等 Umi 首次编译 |
| 小册空 | `ls content-local`；`pnpm sync:booklets` |
| 内存高 | `free -h`；`pm2 restart personal-hub-dev` |
