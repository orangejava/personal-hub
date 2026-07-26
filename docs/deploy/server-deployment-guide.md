# 服务器部署速查

> 一页纸命令清单。完整说明见 [personal-remote-reading.md](./personal-remote-reading.md)。  
> 长期 Docker / CI/CD 见 [deployment.md](./deployment.md)。

---

## 目录（与设计一致）

| 路径 | 用途 |
| --- | --- |
| `/opt/personal-hub` | Git 代码 |
| `/data/personal-hub/content-local` | 小册源文件 |
| `/opt/personal-hub/content-local` | 软链 → 上项 |
| `/var/cache/personal-hub` | 预留缓存 |
| `/etc/personal-hub` | 预留 `.env` |

```bash
sudo mkdir -p /opt/personal-hub /data/personal-hub/content-local \
  /var/cache/personal-hub/chapters /etc/personal-hub
sudo chown -R $USER:$USER /opt/personal-hub /data/personal-hub \
  /var/cache/personal-hub /etc/personal-hub
```

## 代码

```bash
cd /opt/personal-hub
git clone https://github.com/orangejava/personal-hub.git .
# 已有仓库：git pull
pnpm install
```

## 小册（本机 → 服务器，不进 Git）

```bash
# 本机仓库根：按白名单 rsync（详见 personal-remote-reading.md §A.3）
rsync -avz --progress ./content-local/<小册名> \
  <用户>@<IP>:/data/personal-hub/content-local/
```

```bash
# 服务器
cd /opt/personal-hub
ln -sfn /data/personal-hub/content-local ./content-local
pnpm sync:booklets
```

## 启动（阶段 A：dev，非 build）

```bash
pm2 start ecosystem.dev.cjs
pm2 save && pm2 startup
curl -I http://127.0.0.1:8000
```

访问：`http://<IP>:8000`（安全组仅开你的 IP → 8000）  
或 SSH 隧道：`ssh -L 8000:127.0.0.1:8000 <用户>@<IP>`

## 日常更新

```bash
# 代码
cd /opt/personal-hub && git pull && pnpm install && pm2 restart personal-hub-dev

# 小册：本机 rsync 后
pnpm sync:booklets && pm2 restart personal-hub-dev
```

## 排障

| 现象 | 命令 |
| --- | --- |
| 打不开 | `pm2 status`；`ss -tlnp \| grep 8000` |
| 小册空 | `ls content-local`；`pnpm sync:booklets` |
| 内存高 | `free -h`；`pm2 restart personal-hub-dev` |
