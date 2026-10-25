# 域名、HTTPS 与 Nginx 压缩缓存

> 状态：Nginx/Compose HTTPS 配置已落在 main；生产证书、HTTPS、应用链路、移动端、gzip、静态缓存、Lighthouse 和续期验收均已完成。本文保留为后续续期、排障和回滚手册。
> 最后更新：2026-10-18
> 主域名：personalhub.center；www.personalhub.center 只做跳转，不作为业务 Origin。
> 前提：域名已实名，ICP 备案已通过（2026-09）。证书和私钥不进 Git。

本手册只覆盖域名切换、证书、Nginx、生产环境变量和验收。生产发布的通用命令仍以
production-runbook.md 为准。

## 0. HTTPS 与证书操作速查

本节是生产服务器执行入口，适合证书申请、HTTPS 切换和日常续期时直接查阅。命令旁已标明执行位置：

- **本机**：自己的 Mac/Linux 终端，用于从公网验证 DNS、HTTP、HTTPS 和证书；
- **服务器**：SSH 登录 `111.231.13.252` 后的 `/opt/personal-hub` 终端，用于 Docker、Certbot 和 Nginx；
- 不要复制终端提示符 `deploy@VM-0-9-ubuntu:/opt/personal-hub$`，它不是命令的一部分。

### 0.1 固定信息和文件位置

| 项目 | 当前值 |
| --- | --- |
| 主域名 | `personalhub.center` |
| www 域名 | `www.personalhub.center`，只跳转到主域名 |
| 服务器公网 IPv4 | `111.231.13.252` |
| SSH 账号和端口 | `deploy` / `22` |
| 证书目录 | `/etc/letsencrypt/live/personalhub.center/` |
| ACME webroot | `/var/lib/letsencrypt` |
| 生产项目目录 | `/opt/personal-hub` |
| 生产环境文件 | `/opt/personal-hub/.env.prod` |

证书和私钥只保存在服务器 `/etc/letsencrypt`，不复制到 Git、不放进 Docker 镜像，也不要粘贴到聊天或工单。

### 0.2 首次申请证书前：本机检查 DNS 和 80 端口

以下命令在**本机**执行：

~~~bash
dig +short personalhub.center A
dig +short www.personalhub.center A
curl -sS -I http://personalhub.center/
curl -sS -I http://www.personalhub.center/
nc -vz -w 5 personalhub.center 80
~~~

DNS 应指向 `111.231.13.252`（如果前面使用 CDN/WAF，则应指向已确认的代理地址）。80 端口必须能连接，HTTP
响应可以是 `200`、`301` 或 `404`，但不能超时或拒绝连接。腾讯云 Lighthouse 防火墙必须放行 TCP 80 和 443，
服务器 UFW 如果启用，也必须放行这两个端口。

### 0.3 首次申请证书：服务器命令

先登录服务器（本机执行）：

~~~bash
ssh -p 22 deploy@111.231.13.252
~~~

登录后，以下命令均在**服务器**执行：

~~~bash
cd /opt/personal-hub
sudo apt update
sudo apt install -y certbot
sudo mkdir -p /var/lib/letsencrypt/.well-known/acme-challenge
sudo chmod 755 /var/lib/letsencrypt /var/lib/letsencrypt/.well-known /var/lib/letsencrypt/.well-known/acme-challenge

NGINX_CONFIG=default-http-only.conf docker compose --env-file .env.prod -f compose.prod.yml build nginx
NGINX_CONFIG=default-http-only.conf docker compose --env-file .env.prod -f compose.prod.yml up -d --force-recreate nginx

printf 'personal-hub-acme-check\n' | sudo tee \
  /var/lib/letsencrypt/.well-known/acme-challenge/personal-hub-check >/dev/null
~~~

回到**本机**确认 challenge 正文，而不是只看状态码：

~~~bash
curl -fsS http://personalhub.center/.well-known/acme-challenge/personal-hub-check
curl -fsS http://www.personalhub.center/.well-known/acme-challenge/personal-hub-check
~~~

两条都必须只输出 `personal-hub-acme-check`，不能返回前端 HTML、301/302 或其他内容。确认通过后，回到**服务器**申请：

~~~bash
sudo certbot certonly --webroot \
  --webroot-path /var/lib/letsencrypt \
  --domain personalhub.center \
  --domain www.personalhub.center \
  --email '<长期可收件的证书邮箱>' \
  --agree-tos \
  --no-eff-email \
  --deploy-hook '/usr/bin/docker compose --env-file /opt/personal-hub/.env.prod -f /opt/personal-hub/compose.prod.yml exec -T nginx nginx -s reload'
~~~

`--deploy-hook` 必须以可执行文件开始，不能写成 `cd /opt/personal-hub && ...`。命令中的
`compose.prod.yml` 与 `exec` 之间必须有空格，不能粘成 `compose.prod.ymlexec`。

申请成功后，在**服务器**确认证书：

~~~bash
sudo test -s /etc/letsencrypt/live/personalhub.center/fullchain.pem
sudo test -s /etc/letsencrypt/live/personalhub.center/privkey.pem
sudo openssl x509 -in /etc/letsencrypt/live/personalhub.center/fullchain.pem \
  -noout -subject -issuer -dates -ext subjectAltName
~~~

`subjectAltName` 必须同时包含 `personalhub.center` 和 `www.personalhub.center`。

### 0.4 证书签发后切换最终 HTTPS

证书文件存在后，在**服务器**执行：

~~~bash
cd /opt/personal-hub
docker compose --env-file .env.prod -f compose.prod.yml config --quiet
docker compose --env-file .env.prod -f compose.prod.yml build nginx
docker compose --env-file .env.prod -f compose.prod.yml run --rm --no-deps nginx nginx -t
docker compose --env-file .env.prod -f compose.prod.yml up --build -d postgres redis server
docker compose --env-file .env.prod -f compose.prod.yml ps
~~~

如果本次发布包含 AI 合并代码或 Prisma migration，确认 `server` 为 `Up (healthy)` 后继续执行：

~~~bash
docker compose --env-file .env.prod -f compose.prod.yml exec server \
  npx prisma migrate deploy
docker compose --env-file .env.prod -f compose.prod.yml up --build -d server-worker nginx
~~~

如果本次发布没有数据库迁移，确认 `server` 健康后可以直接执行最后一条启动 `server-worker nginx` 的命令。
数据库备份、迁移前置检查和失败恢复仍以 `production-runbook.md` 为准。

在**本机**验证：

~~~bash
curl -sS -I http://personalhub.center/
curl -sS -I http://www.personalhub.center/
curl -sS -I https://www.personalhub.center/
curl -sS -o /dev/null -w 'live=%{http_code}\n' https://personalhub.center/api/v1/health/live
curl -sS -o /dev/null -w 'ready=%{http_code}\n' https://personalhub.center/api/v1/health/ready
~~~

预期：HTTP 跳转到主域名 HTTPS，`www` HTTPS 跳转到主域名，`live` 和 `ready` 都返回 `200`。

### 0.5 后续证书续期：日常只执行这些命令

证书通常有效期约 90 天，不需要手工购买或复制证书。Certbot timer 会自动尝试续期；首次切换完成后，在**服务器**执行：

~~~bash
sudo systemctl status certbot.timer
sudo systemctl list-timers 'certbot*'
sudo certbot certificates
sudo grep -R -n -E 'webroot_path|deploy_hook|authenticator' /etc/letsencrypt/renewal/
sudo certbot renew --dry-run
~~~

`certbot.timer` 通常应显示 `active (waiting)`。如果系统没有该服务，执行
`systemctl list-unit-files | grep -i certbot` 查找发行版实际提供的定时器，不要同时创建 cron 和 systemd timer。
`dry-run` 成功后，日常不需要重复执行 `certbot certonly`。证书实际续期后，Certbot 会执行已保存的 deploy hook，
让 Nginx reload 新证书。需要手动确认当前证书和续期日志时，在**服务器**执行：

~~~bash
sudo journalctl -u certbot.service --since '-24 hours' --no-pager
sudo openssl x509 -in /etc/letsencrypt/live/personalhub.center/fullchain.pem \
  -noout -dates -ext subjectAltName
cd /opt/personal-hub
docker compose --env-file .env.prod -f compose.prod.yml exec -T nginx nginx -t
docker compose --env-file .env.prod -f compose.prod.yml exec -T nginx nginx -s reload
~~~

证书续期不需要重新构建应用镜像，也不需要数据库迁移。续期前如果想单独检查证书剩余时间，可执行：

~~~bash
sudo openssl x509 -in /etc/letsencrypt/live/personalhub.center/fullchain.pem \
  -noout -dates -ext subjectAltName
~~~

如果自动 hook 没有 reload 成功，先检查 `certbot.service` 日志，再单独执行上面的 `nginx -t` 和 `nginx -s reload`。
不要手工复制证书文件；Certbot 的 `/etc/letsencrypt/live/...` 符号链接会指向最新证书。

### 0.6 当前切换完成后的最小检查

如果已经完成证书申请和 HTTPS 切换，至少完成以下三步：

1. 本机执行第 0.4 节的 5 条 curl，确认跳转和健康接口；
2. 本机浏览器打开主站、`/admin/`，完成登录、refresh、运营概览和手机端 AI 发送；
3. 服务器执行第 0.5 节的 `certbot renew --dry-run`，确认自动续期链路没有失败。

完整的功能验收、gzip、静态缓存和故障排查见第 5 节及后续章节。

## 当前状态与验证边界

如果以下命令已经在**自己的电脑**上返回 `200`，说明 HTTPS 入口、证书和 Nginx 到 Nest 的健康检查链路已经可用：

~~~bash
curl -sS -o /dev/null -w 'live=%{http_code}\n' \
  https://personalhub.center/api/v1/health/live
curl -sS -o /dev/null -w 'ready=%{http_code}\n' \
  https://personalhub.center/api/v1/health/ready
~~~

这还不等于整站发布验收完成。登录 Cookie、refresh、管理端、上传、AI SSE、手机端交互、静态资源缓存和证书自动续期
仍需按第 5 节逐项验证。健康接口通过后不要重复申请证书；先检查证书有效期和 `certbot renew --dry-run`。

## 1. 切换前确认

### 1.1 需要准备的信息

在执行服务器命令前确认以下信息：

- 生产服务器公网 IPv4：`111.231.13.252`；
- 主域名：personalhub.center；
- www 域名：www.personalhub.center；
- 服务器登录账号：`deploy`；SSH 端口：`22`；
- 生产管理员邮箱，用于 Let's Encrypt 证书到期通知；
- /opt/personal-hub/.env.prod 已备份到受控位置，不能把内容粘贴到聊天或提交到 Git。

### 1.2 先确认域名解析由谁管理

本项目需要配置的是 **DNS 解析记录**，不是在服务器中配置域名。先进入
[腾讯云控制台](https://console.cloud.tencent.com/)，在顶部产品搜索中输入 **DNSPod**，打开
「DNSPod 解析」，然后按以下情况处理：

1. 在「我的域名」中能看到 `personalhub.center`：域名已由 DNSPod 托管，直接进入下一节。
2. 看不到该域名，但域名是在腾讯云购买的：点击「添加域名」，输入 `personalhub.center`。如果控制台提示
   域名未使用 DNSPod 名称服务器，按页面给出的两条 NS 服务器名称，到「域名注册」的域名详情中替换 DNS
   服务器；等待变更生效后再添加记录。
3. 域名在其他注册商或使用其他 DNS 服务：到实际 DNS 服务商的解析控制台添加同样的记录。不要同时在两个
   DNS 服务商中配置，以域名当前的 NS 服务器指向的服务商为准。

可在本机确认权威解析服务商，结果中的 `SERVER` 只表示当前查询使用的递归 DNS，真正的托管方看 NS 记录：

~~~bash
dig NS personalhub.center +short
~~~

### 1.3 在 DNSPod 添加 A 记录

在「DNSPod 解析」中依次点击「我的域名」→ `personalhub.center` →「记录管理」→「添加记录」，添加两条
记录。每添加一条都点击右侧的「保存」。

| 主机记录 | 记录类型 | 线路类型 | 记录值 | TTL | 作用 |
| --- | --- | --- | --- | --- | --- |
| `@` | `A` | 默认 | 生产服务器公网 IPv4 | 600 | 裸域名 `personalhub.center` |
| `www` | `A` | 默认 | 同一个生产服务器公网 IPv4 | 600 | `www.personalhub.center`，之后由 Nginx 跳转 |

填写时注意：

- 「主机记录」填 `@`，不是完整域名；DNSPod 会自动组成 `personalhub.center`。
- 「记录值」只填公网 IPv4，例如 `1.2.3.4`，不填 `http://`、端口、路径或内网 `172.x/192.168.x` 地址。
- 不能保留冲突的 `@` 或 `www` 的 CNAME、URL 转发或旧 A 记录。若需要保留邮件解析，只检查和本次同名的
  记录，不要删除 MX、TXT、DKIM、SPF、DMARC 等邮件记录。
- `www` 先解析到同一台服务器，是为了让 Let's Encrypt 能验证它；真正跳转由后续 Nginx 的 443 配置完成，
  不是 DNSPod 的「显性 URL 转发」。

保存后在自己的电脑上检查，不要只看 DNSPod 页面显示「正常」：

~~~bash
dig +short personalhub.center A
dig +short www.personalhub.center A
~~~

两个结果都必须是生产服务器公网 IPv4。若本地仍是旧结果，可等待 TTL 和本地 DNS 缓存失效后重试；可额外用
公共 DNS 排除本机网络缓存：

~~~bash
dig @1.1.1.1 +short personalhub.center A
dig @8.8.8.8 +short www.personalhub.center A
~~~

若公网 DNS 返回的 IP 不正确、为空，或返回 CDN/WAF 的 IP，本步骤没有完成，不要继续申请证书。

### 1.4 在腾讯云放行 80 和 443

HTTP-01 证书验证必须从互联网访问服务器 TCP 80；用户访问 HTTPS 必须访问 TCP 443。因此这两个端口的
来源必须是 `0.0.0.0/0`（全部 IPv4）。这只开放 Nginx 的公网入口，不代表要公开 PostgreSQL、Redis 或
Nest 3001。

先在腾讯云确认实例类型，控制台入口不同：

#### CVM 云服务器

1. 进入「云服务器 CVM」→「实例」。
2. 点击生产实例 ID，切到「安全组」页签，点击绑定的安全组名称，再进入「入站规则」。
3. 点击「添加规则」，逐条添加或确认下表规则，策略均为「允许」。

| 协议类型 | 端口 | 来源 | 说明 |
| --- | --- | --- | --- |
| 自定义 TCP | 22 或实际 SSH 端口 | 你的当前公网 IPv4`/32` | 服务器登录，仅自己使用 |
| 自定义 TCP | 80 | `0.0.0.0/0` | ACME 验证与 HTTP 跳 HTTPS |
| 自定义 TCP | 443 | `0.0.0.0/0` | 网站 HTTPS |

「来源」填写的是访问者的公网出口 IP，不是服务器公网 IP，也不是电脑的 `192.168.x.x` 局域网地址。SSH 的当前
出口 IP 可在浏览器搜索 “what is my IP” 获取；换网络、手机热点或 VPN 后可能需要更新这条 `/32` 规则。

#### Lighthouse 轻量应用服务器

Lighthouse 页面没有 CVM 的「安全组」名称。入口是「轻量应用服务器」→「服务器」→生产实例→「防火墙」→
「添加规则」。选择 TCP，并分别填写端口 `80`、`443`，来源选「所有 IPv4 地址」或填写 `0.0.0.0/0`。
SSH 端口只填写自己的公网 IPv4`/32`。保存后在规则列表中确认三条规则已经显示为启用。

截图中这类规则的处理方式如下：

| 截图中的规则 | 处理建议 | 原因 |
| --- | --- | --- |
| `HTTPS (443)`，TCP 443，全部 IPv4 | 保留 | HTTPS 网站流量必须访问 443 |
| `HTTP (80)`，TCP 80，全部 IPv4 | 保留 | HTTP-01 证书验证和 HTTP→HTTPS 跳转需要 80 |
| `Linux 登录 (22)`，TCP 22，全部 IPv4 | 保留端口，但把来源改为自己的公网 IP`/32` | SSH 不应长期对全网开放 |
| `personal-hub-dev`，TCP 8000，全部 IPv4 | 确认不再使用旧阶段 A 服务后删除 | 当前生产 Compose 通过 Nginx 的 80/443 提供服务，不需要公网 8000 |
| `Ping`，ICMP，全部 IPv4 | 可保留，也可删除 | 网站、证书和 SSH 都不依赖 Ping；保留只方便连通性排查 |

不要因为进入 HTTPS 就删除 80。80 需要长期保留，证书自动续期和访问 HTTP 跳转都会使用它。也不要直接删除 22：
先确认 SSH 端口和自己的公网出口 IP，再添加一条受限规则，最后从第二个终端测试成功后，才删除旧的「全部 IPv4」SSH 规则。

#### 查询 SSH 实际端口

以下命令在**已经 SSH 登录的生产服务器终端**执行：

~~~bash
# 当前连接实际使用的服务器端口；最后一个字段就是 SSH 服务端口
echo "$SSH_CONNECTION"

# 查看 sshd 生效配置中的端口（可能返回多个端口）
sudo sshd -T | awk '$1 == "port" { print $2 }'

# 查看正在监听的 sshd TCP 端口
sudo ss -lntp | grep -E 'sshd|LISTEN'
~~~

例如 `echo "$SSH_CONNECTION"` 输出：

~~~text
203.0.113.10 52134 111.231.13.252 22
~~~

其中最后的 `22` 是当前 SSH 端口。如果输出是 `2222`，防火墙规则和后续登录命令都应使用 `2222`，不要凭控制台
规则名称猜测端口。若 `sshd -T` 返回多个端口，全部确认后再调整规则，避免仍有一个端口未纳入安全组。

#### 查询自己的公网出口 IP

以下命令在**自己的 Mac/Linux 电脑终端**执行，不是在生产服务器执行：

~~~bash
curl -4 https://ifconfig.me
~~~

把输出的地址加上 `/32`，例如 `203.0.113.10/32`，填入 Lighthouse 规则的「来源」。这个地址不是服务器的
`111.231.13.252`，也不是电脑的 `192.168.x.x` 局域网地址；切换 Wi-Fi、手机热点或 VPN 后，公网出口 IP 可能改变。

本次实际核对结果（2026-10-17）：

| 项目 | 已确认值 | 用在哪里 |
| --- | --- | --- |
| 生产服务器公网 IPv4 | `111.231.13.252` | SSH 连接目标、DNS A 记录值 |
| SSH 监听端口 | `22` | Lighthouse SSH 防火墙规则端口 |
| 当前本机公网出口 IPv4 | `114.216.179.250` | Lighthouse SSH 规则来源，应填写 `114.216.179.250/32` |

本机执行 `curl -4 https://ifconfig.me` 后如果行末显示 `%`，那是 macOS Shell 的提示符，不属于 IP 地址；实际地址
仍是 `114.216.179.250`。服务器执行 `sudo ss -lntp | grep sshd` 已确认 sshd 监听 `0.0.0.0:22` 和 `[::]:22`。

#### 修改和清理规则的安全顺序

1. 保持当前 SSH 终端不要退出；在 Lighthouse「防火墙」中编辑 22（或实际 SSH 端口），把来源从「全部 IPv4 地址」
   改成自己的公网 IP`/32`，保存。
2. 在自己的电脑打开第二个终端，用实际端口测试新的限制规则：

   ~~~bash
   ssh -p 22 deploy@111.231.13.252
   ~~~

   第二个终端成功登录后，才可以删除旧的「SSH 端口 + 全部 IPv4」规则。失败时不要关闭当前终端，先把来源恢复为
   当前公网 IP 或使用腾讯云控制台的登录/救援入口恢复。
3. 删除 `8000` 前，在服务器确认旧服务确实没有使用它：

   ~~~bash
   cd /opt/personal-hub
   docker compose --env-file .env.prod -f compose.prod.yml port nginx 80
   sudo ss -lntp | grep ':8000' || true
   command -v pm2 >/dev/null && pm2 list || true
   ~~~

   生产 Nginx 映射到 80、没有需要公网访问的 `:8000` 进程，且 `pm2 list` 中没有仍在使用的
   `personal-hub-dev` 后，才删除截图中的 8000 规则。若你还需要旧的个人远程阅读服务，先不要删除。
4. `Ping` 规则不是必需项。保留它不会影响 HTTPS；删除后只能减少 ICMP 探测，不会影响 TCP 80、443 或 SSH。

删除规则前，先确认操作列中的端口、协议和来源，避免误删 80、443 或刚刚收紧后的 SSH 规则。规则调整后，从自己的电脑
重新执行第 1.5 节的 80 端口测试；443 在证书配置完成后再测试。

#### 服务器本机防火墙

腾讯云安全组不是唯一一层防火墙。若服务器启用了 UFW，还需登录服务器检查并放行：

~~~bash
sudo ufw status numbered
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status verbose
~~~

若 UFW 显示 `Status: inactive`，无需执行 `ufw enable`，只记录它当前未参与拦截即可。不要在安全组或 UFW
中开放 `5432`、`6379`、`3001`；它们只应在 Docker 内部网络中访问。

### 1.5 外网连通性预检

DNS 已正确指向服务器后，从自己的电脑执行：

~~~bash
curl -sS -I --connect-timeout 10 http://personalhub.center/
nc -vz -w 5 personalhub.center 80
~~~

HTTP 响应可以是当前站点的 `200`、`301` 或 `404`，关键是不能连接超时或拒绝连接；`nc` 应报告端口成功连接。
若失败，按以下顺序排查：DNS A 记录 → 腾讯云入站规则 → UFW → `docker compose ps` 中 Nginx 是否运行且映射
`0.0.0.0:80`。此时 443 还未启用，不能用其连通性判断证书申请是否可行。

### 1.6 记录切换前基线

这里的公网 IP 指生产轻量云服务器的公网 IPv4，本项目当前已确认是 `111.231.13.252`。它不是你的本机公网
出口 IP `114.216.179.250`，也不是服务器容器的内网地址。

先在**生产服务器 SSH 终端**记录当前版本和服务状态：

~~~bash
cd /opt/personal-hub
git log -1 --oneline
docker compose --env-file .env.prod -f compose.prod.yml ps
~~~

再在**自己的 Mac/Linux 终端**从外网检查当前 HTTP 入口。不要只在服务器里访问自己的公网 IP；部分云网络不支持
服务器访问自身公网地址（hairpin），这种测试不能替代外网检查：

~~~bash
curl -sS -I http://111.231.13.252/
curl -sS -o /dev/null -w '%{http_code}\n' http://111.231.13.252/api/v1/health/live
~~~

当前服务器可以直接替换为：

~~~bash
curl -sS -I http://111.231.13.252/
curl -sS -o /dev/null -w '%{http_code}\n' http://111.231.13.252/api/v1/health/live
~~~

同时从本机浏览器记录生产首页、内容中心、小册阅读和 AI 对话的桌面端与移动端 Lighthouse 数据，作为 HTTPS、gzip
和缓存切换后的对比基线。

## 2. main 中需要具备的改动

HTTPS 上线前，main 的发布版本需要包含下面三类配置。证书未准备好之前不要直接把 443 配置推到生产。

实施时分为两个发布状态，避免 Nginx 因引用尚不存在的证书而启动失败：

1. **证书前的 HTTP-only 状态**：仅发布 80 端口、ACME challenge location 和 webroot 挂载；所有非 challenge
   请求仍由当前 HTTP 站点处理。完成第 3.2 节的测试文件外网验证和证书申请。
2. **证书后的最终 HTTPS 状态**：确认 `/etc/letsencrypt/live/personalhub.center/` 已有两份证书文件后，再发布
   443 端口、证书挂载、80→443 和 www→主域名跳转；最后执行第 4 节的完整重建。

不要把两个状态合成一次盲目上线。第一个状态只为获取证书准备验证入口，第二个状态才改变用户的访问协议和 Cookie 行为。

### 2.0 先确认当前发布版本是否已经具备 HTTPS 配置

本节是**代码和 Compose 改动清单**，不是直接在生产服务器手改容器文件。先在本地 `main` 分支完成、验证并提交，
再由第 4 节将该提交发布到 `/opt/personal-hub`。在服务器执行下列只读命令，确认当前状态：

~~~bash
cd /opt/personal-hub
git branch --show-current
git log -1 --oneline
grep -En "443:443|letsencrypt|acme-challenge|listen 443|ssl_certificate" \
  compose.prod.yml deploy/nginx/default.conf
~~~

预期能找到 `443:443`、证书和 webroot 挂载、ACME challenge location、`listen 443 ssl` 等配置。若没有找到，
先完成本节 2.1 与 2.2 的代码改动并发布 HTTP-only challenge 配置；不能先运行 certbot 后再补 Nginx 配置。

配置文件职责如下，避免改错位置：

| 文件 | 在哪里生效 | 本次负责内容 |
| --- | --- | --- |
| `deploy/nginx/default.conf` | Nginx 容器内 | 80/443 虚拟主机、跳转、证书路径、ACME 路径、gzip/缓存 |
| `compose.prod.yml` | 服务器执行 `docker compose` 时 | 发布 80/443、把宿主机证书和 webroot 只读挂入 Nginx |
| `/opt/personal-hub/.env.prod` | 服务器，且不进 Git | 生产 Origin、Cookie 安全标志、CORS 白名单 |

### 2.1 Nginx（代码已完成）

`deploy/nginx/default.conf` 已保留现有 `/api/v1/` 的 SSE 设置：gzip off、proxy_buffering off、
proxy_read_timeout 3600s，并已增加：

- 80 端口的 ACME challenge 路径 /.well-known/acme-challenge/；
- 80 端口所有其他请求 301 到 https://personalhub.center$request_uri；
- 443 的 personalhub.center 主站；
- 443 的 www.personalhub.center 301 到主域名；
- ssl_certificate、ssl_certificate_key、TLS 1.2/1.3；
- HSTS 暂设为 `max-age=86400`；HTTPS 稳定一周后再延长，不直接加入 preload。

证书路径示例：

~~~nginx
ssl_certificate     /etc/nginx/certs/live/personalhub.center/fullchain.pem;
ssl_certificate_key /etc/nginx/certs/live/personalhub.center/privkey.pem;
~~~

80 端口必须先保留 challenge 例外，否则证书续期时会被重定向或前端路由吞掉：

~~~nginx
location ^~ /.well-known/acme-challenge/ {
    root /var/www/certbot;
    default_type text/plain;
    try_files $uri =404;
}
~~~

443 的业务 server 应继续复用当前静态文件、/admin/ 和 /api/v1/ location，不要在 HTTPS 切换时重写业务路由。

证书申请前使用同目录的 `default-http-only.conf`。它保留同一套 HTTP 业务路由和 ACME challenge，
但不包含任何 `listen 443 ssl` 或证书路径，因此证书尚不存在时也能启动 Nginx。证书签发完成后重新构建，
恢复 `default.conf`，再启用最终 HTTPS 配置。

### 2.2 Compose 挂载（代码已完成）

`compose.prod.yml` 的 `nginx` 服务已增加 443 端口和以下只读挂载：

~~~yaml
ports:
  - '80:80'
  - '443:443'
volumes:
  - /etc/letsencrypt:/etc/nginx/certs:ro
  - /var/lib/letsencrypt:/var/www/certbot:ro
~~~

同一服务还支持构建参数 `NGINX_CONFIG`。默认值是 `default.conf`；证书申请阶段临时使用
`NGINX_CONFIG=default-http-only.conf`，不需要修改 `.env.prod`。申请成功后省略该参数重新构建，
即可恢复最终 HTTPS 配置。

宿主机上的证书目录和 ACME webroot 由 Certbot 写入，Nginx 只读挂载。不要把证书复制进镜像或项目目录。
最终配置发布前，必须先确认 `/etc/letsencrypt/live/personalhub.center/` 中的证书文件已存在；否则
Nginx 会因无法读取 `ssl_certificate` 和 `ssl_certificate_key` 启动失败。生产执行顺序见第 3 节和第 4 节。

挂载前后的路径对应关系如下。命令中的 `/var/lib/letsencrypt` 是宿主机目录，不是 Docker volume 名称：

| 宿主机路径 | Nginx 容器路径 | 写入者 | 用途 |
| --- | --- | --- | --- |
| `/etc/letsencrypt` | `/etc/nginx/certs`（只读） | certbot | `fullchain.pem`、`privkey.pem` |
| `/var/lib/letsencrypt` | `/var/www/certbot`（只读） | certbot / 手工验证 | HTTP-01 challenge 文件 |

`/etc/letsencrypt/live/...` 中的文件通常是符号链接，挂载整个 `/etc/letsencrypt`，不能只挂载 `live` 子目录，否则
Nginx 无法追踪到实际证书文件。

### 2.3 .env.prod

本节在**生产服务器**执行，不是在本地修改项目目录中的示例文件。先 SSH 登录
`111.231.13.252`，再编辑服务器上的 `/opt/personal-hub/.env.prod`：

~~~bash
# 以下命令在本机终端执行
ssh -p 22 deploy@111.231.13.252

# 登录成功后，以下命令在生产服务器终端执行
cd /opt/personal-hub
sudoedit .env.prod
~~~

切换期间先保留旧 Origin，确认稳定后再清理：

~~~dotenv
PUBLIC_APP_ORIGIN=https://personalhub.center
COOKIE_SECURE=true
CORS_ORIGIN=http://111.231.13.252,http://personalhub.center,https://personalhub.center,http://www.personalhub.center,https://www.personalhub.center
~~~

约束：

- Origin 之间用逗号分隔，不加末尾 /，不写路径、query 或 hash；
- PUBLIC_APP_ORIGIN 影响邮件链接和前端构建期跳转；
- COOKIE_SECURE=true 后，Cookie 只会在 HTTPS 下发送；
- CORS_ORIGIN 非空后不会自动回退到 PUBLIC_APP_ORIGIN，因此切换期间要明确写入需要兼容的 Origin；
- 同站生产不需要依赖 CORS 才能工作，但 refresh、上传和跨 Origin 管理端调试仍会校验来源。

## 3. 申请 Let's Encrypt 证书

本项目使用 webroot 方式申请证书，避免每次续期都停掉公网入口。证书需要同时覆盖裸域名和 www：

### 3.1 登录服务器并检查前置状态

本小节分两处执行：第一条 SSH 命令在**本机终端**执行；登录成功后，其余命令在**生产服务器终端**执行。
本项目当前已确认服务器账号为 `deploy`、公网 IPv4 为 `111.231.13.252`、SSH 端口为 `22`：

~~~bash
ssh -p 22 deploy@111.231.13.252
~~~

进入服务器后执行：

~~~bash
cd /opt/personal-hub
docker compose --env-file .env.prod -f compose.prod.yml ps
docker compose --env-file .env.prod -f compose.prod.yml port nginx 80
~~~

最后一条应显示类似 `0.0.0.0:80` 或 `[::]:80` 的映射。若未显示，先检查第 2 节的 Compose 配置和 Nginx 容器日志，
不要继续安装或申请证书。所有 `sudo` 命令都在服务器中执行，不在本机执行。

### 3.2 安装 certbot 与建立 webroot

~~~bash
# 以下命令全部在生产服务器终端执行
sudo apt update
sudo apt install -y certbot
sudo mkdir -p /var/lib/letsencrypt/.well-known/acme-challenge
sudo chmod 755 /var/lib/letsencrypt /var/lib/letsencrypt/.well-known /var/lib/letsencrypt/.well-known/acme-challenge
~~~

Ubuntu/Debian 可以直接使用上述命令。若 `apt` 提示找不到 `certbot`，先检查系统版本，再按 Certbot 官方针对该发行版的
安装说明执行；不要混用 Snap 和 apt 安装的两个 certbot。安装后确认实际命令与版本：

~~~bash
# 以下命令全部在生产服务器终端执行
certbot --version
command -v certbot
~~~

先把包含 ACME challenge location 的 HTTP-only Nginx 配置发布到服务器，并确认容器挂载了
/var/lib/letsencrypt。下面两条命令中的 `NGINX_CONFIG=default-http-only.conf` 只作用于本次命令，
不会写入 `.env.prod`：

~~~bash
# 以下命令在生产服务器终端执行
cd /opt/personal-hub
NGINX_CONFIG=default-http-only.conf docker compose --env-file .env.prod -f compose.prod.yml build nginx
NGINX_CONFIG=default-http-only.conf docker compose --env-file .env.prod -f compose.prod.yml up -d --force-recreate nginx
printf 'personal-hub-acme-check\n' | sudo tee /var/lib/letsencrypt/.well-known/acme-challenge/personal-hub-check >/dev/null
~~~

确认 Nginx 已启动后，在**本机终端**从外网验证两个域名：

~~~bash
curl -fsS http://personalhub.center/.well-known/acme-challenge/personal-hub-check
curl -fsS http://www.personalhub.center/.well-known/acme-challenge/personal-hub-check
~~~

两条命令都必须输出 `personal-hub-acme-check`。仅看到 `200` 不足以证明 challenge 正确，响应正文也必须是这段短文本，
不能是前端 HTML。可在本机进一步确认响应头和正文大小：

~~~bash
for host in personalhub.center www.personalhub.center; do
  curl -4 --max-time 10 -sS -D "/tmp/${host}.headers" \
    -o "/tmp/${host}.body" \
    "http://${host}/.well-known/acme-challenge/personal-hub-check"
  printf '\n--- %s headers ---\n' "$host"
  cat "/tmp/${host}.headers"
  printf '%s body bytes: ' "$host"
  wc -c < "/tmp/${host}.body"
  cat "/tmp/${host}.body"
done
~~~

预期两个响应都是 `200`，正文只有 `personal-hub-acme-check`，通常只有几十字节；不能出现 `Location`、HTML 或
异常大的响应体。注意，这个手工文件只验证 Nginx 路径；Certbot 申请时会创建另一份随机 token，不能只凭手工文件
返回 200 就判断认证一定可用。

确认通过后申请证书：

如果任一条输出 HTML、出现 301/302，或响应内容明显不是 `personal-hub-acme-check`，先不要运行 Certbot，
在服务器检查实际加载的 Nginx 配置：

~~~bash
# 以下命令在生产服务器终端执行
docker compose --env-file .env.prod -f compose.prod.yml exec -T nginx nginx -T \
  2>&1 | grep -A6 -B2 'acme-challenge'
docker compose --env-file .env.prod -f compose.prod.yml exec -T nginx \
  cat /var/www/certbot/.well-known/acme-challenge/personal-hub-check
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=100 nginx
~~~

如果 `nginx -T` 找不到 `acme-challenge`，或容器内 `cat` 提示文件不存在，说明镜像或 Compose 挂载仍是旧状态。
先重新执行 HTTP-only 镜像构建，再强制重建容器；只执行 `up` 不会把新配置复制进已有镜像：

~~~bash
# 以下命令在生产服务器终端执行
cd /opt/personal-hub
test -f deploy/nginx/default-http-only.conf
NGINX_CONFIG=default-http-only.conf docker compose --env-file .env.prod -f compose.prod.yml build nginx
NGINX_CONFIG=default-http-only.conf docker compose --env-file .env.prod -f compose.prod.yml up -d --force-recreate nginx
printf 'personal-hub-acme-check\n' | sudo tee \
  /var/lib/letsencrypt/.well-known/acme-challenge/personal-hub-check >/dev/null
sudo ls -l /var/lib/letsencrypt/.well-known/acme-challenge/personal-hub-check
docker compose --env-file .env.prod -f compose.prod.yml exec -T nginx \
  cat /var/www/certbot/.well-known/acme-challenge/personal-hub-check
~~~

如果重新构建后仍然找不到配置或文件，执行以下诊断命令，分别核对 Compose 展开结果、容器挂载和镜像内配置：

~~~bash
# 以下命令在生产服务器终端执行
NGINX_CONFIG=default-http-only.conf docker compose --env-file .env.prod -f compose.prod.yml config \
  | sed -n '/nginx:/,/networks:/p'
sudo ls -la /var/lib/letsencrypt/.well-known/acme-challenge/
docker inspect personal-hub-prod-nginx-1 --format '{{range .Mounts}}{{println .Type .Source "->" .Destination .RW}}{{end}}'
docker run --rm --entrypoint sh personal-hub-prod-nginx -c \
  "grep -A6 -B2 'acme-challenge' /etc/nginx/conf.d/default.conf"
~~~

展开配置必须出现 `/var/lib/letsencrypt -> /var/www/certbot`，容器挂载列表也必须出现同一对路径；镜像检查必须打印
`location ^~ /.well-known/acme-challenge/`。任一项缺失都说明服务器上的 Compose、Dockerfile 或镜像不是当前 main
版本，先更新 `/opt/personal-hub` 的代码再继续申请证书。仅在命令前设置 `NGINX_CONFIG=...` 不能补齐旧版
Compose 中不存在的 `args`、端口或挂载项。

确认服务器当前代码版本：

~~~bash
# 以下命令在生产服务器终端执行
cd /opt/personal-hub
git branch --show-current
git log -1 --oneline
git status --short
~~~

如果服务器工作区干净且远端已经包含 HTTPS 改动，再按生产发布流程执行 `git pull --ff-only`；如果存在未提交修改，
先停止，不要用 `git reset` 或强行覆盖。更新后重新执行本节的 Compose、挂载和镜像检查，全部通过后再申请证书。

然后在本机终端确认响应头和正文都正确：

~~~bash
curl -sS -D - http://personalhub.center/.well-known/acme-challenge/personal-hub-check
curl -sS -D - http://www.personalhub.center/.well-known/acme-challenge/personal-hub-check
~~~

两次都应返回 `HTTP/1.1 200`，正文只有 `personal-hub-acme-check`，不能有 `Location`、HTML 或前端页面内容。
若服务器容器内能读到文件，但本机返回 HTML，说明当前运行的镜像仍不是 HTTP-only 配置；重新执行上面的
`build` 和带 `--force-recreate` 的 `up`，再测试一次。

~~~bash
# 以下命令在生产服务器终端执行
sudo certbot certonly --webroot \
  --webroot-path /var/lib/letsencrypt \
  --domain personalhub.center \
  --domain www.personalhub.center \
  --email '<你的证书通知邮箱>' \
  --agree-tos \
  --no-eff-email \
  --deploy-hook '/usr/bin/docker compose --env-file /opt/personal-hub/.env.prod -f /opt/personal-hub/compose.prod.yml exec -T nginx nginx -s reload'
~~~

`--deploy-hook` 的第一个词必须是可执行文件，不能直接写 Shell 内置命令 `cd`。这里使用 Docker 的绝对路径和
绝对配置路径，因此不需要先 `cd /opt/personal-hub`。多行命令中每一行末尾的 `\` 都必须保留，否则下一行会被
Shell 当成另一条命令。

命令会申请一张同时包含两个域名的证书：

- `--webroot-path` 必须与 Nginx ACME location 映射到的宿主机目录一致；不要改为项目目录。
- 两个 `--domain` 分别申请裸域名和 `www` 的 SAN。遗漏 `www` 会使访问或跳转到 `www` 时出现证书错误。
- `--email` 使用长期可收件的管理员邮箱，用于到期或续期失败通知，不会展示给访客。
- 如果提示已有证书，先运行 `sudo certbot certificates` 检查名称和涵盖域名。不要因为重复测试反复申请，避免触发
  Let's Encrypt 的速率限制。

如果其中任一条失败，先执行以下命令定位属于哪个环节，再修复后重试。不要尝试用 `--standalone` 临时抢占 80 端口，
它会和正在运行的 Nginx 冲突，也会让续期流程变成手工操作。

~~~bash
# 以下两条命令在生产服务器终端执行
docker compose --env-file .env.prod -f compose.prod.yml exec -T nginx ls -l \
  /var/www/certbot/.well-known/acme-challenge/personal-hub-check
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=100 nginx
~~~

以下命令在**本机终端**执行：

~~~bash
curl -sS -I http://personalhub.center/.well-known/acme-challenge/personal-hub-check
~~~

第 1 条必须在容器内看到测试文件；看不到说明 Compose 挂载或 Nginx `root` 路径不一致。若容器内存在、域名请求仍然
超时或 404，回到第 1.3 至 1.5 节检查 DNS、80 端口和 Nginx location。

除服务器公网 IP、域名、账号和 SSH 端口外，证书申请命令中的 `<你的证书通知邮箱>` 仍需替换为你能长期收件的邮箱。

证书文件应存在：

~~~bash
# 以下命令在生产服务器终端执行
sudo test -s /etc/letsencrypt/live/personalhub.center/fullchain.pem
sudo test -s /etc/letsencrypt/live/personalhub.center/privkey.pem
sudo openssl x509 -in /etc/letsencrypt/live/personalhub.center/fullchain.pem \
  -noout -subject -issuer -dates -ext subjectAltName
~~~

subjectAltName 必须包含 personalhub.center 和 www.personalhub.center。

### 3.4 本次证书申请排障记录

以下问题都曾在本次切换中出现，后续遇到相同现象时按对应处理，不要绕过 HTTP-01 验证直接改用临时配置。

#### `Unable to find deploy-hook command cd in the PATH`

`--deploy-hook` 会被 Certbot 当作可执行命令检查，不能把 `cd`、`&&` 等 Shell 语句直接放在 hook 的第一个位置。
使用 Docker Compose 的绝对路径和绝对配置文件路径：

~~~bash
sudo certbot certonly --webroot \
  --webroot-path /var/lib/letsencrypt \
  --domain personalhub.center \
  --domain www.personalhub.center \
  --email '<长期可收件的证书邮箱>' \
  --agree-tos \
  --no-eff-email \
  --deploy-hook '/usr/bin/docker compose --env-file /opt/personal-hub/.env.prod -f /opt/personal-hub/compose.prod.yml exec -T nginx nginx -s reload'
~~~

这里的 hook 不能写成 `cd /opt/personal-hub && ...`。如果申请时不需要立即 reload，也可以先省略
`--deploy-hook`，证书签发成功后手动执行第 6 节的 Nginx 检查和 reload。

#### `reader size limit exceeded`，或 ACME 地址返回前端 HTML

这通常不是 Let's Encrypt 本身的问题，而是 CA 请求 challenge 文件时拿到了前端 `index.html`，而不是一个很短的 token。
出现这种情况时，不能只看 HTTP 状态码；必须检查响应正文：

~~~bash
for host in personalhub.center www.personalhub.center; do
  curl -4 --max-time 10 -sS \
    "http://${host}/.well-known/acme-challenge/personal-hub-check"
  printf '\n'
done
~~~

两次都必须只输出 `personal-hub-acme-check`。如果返回 HTML，按以下顺序处理：

1. 在服务器重新构建 HTTP-only 镜像，不能只执行普通 `up`：

   ~~~bash
   cd /opt/personal-hub
   NGINX_CONFIG=default-http-only.conf docker compose --env-file .env.prod -f compose.prod.yml build nginx
   NGINX_CONFIG=default-http-only.conf docker compose --env-file .env.prod -f compose.prod.yml up -d --force-recreate nginx
   ~~~

2. 确认宿主机文件和容器内文件都存在：

   ~~~bash
   sudo ls -l /var/lib/letsencrypt/.well-known/acme-challenge/personal-hub-check
   docker compose --env-file .env.prod -f compose.prod.yml exec -T nginx \
     cat /var/www/certbot/.well-known/acme-challenge/personal-hub-check
   ~~~

3. 确认实际加载的镜像和挂载包含 challenge 配置。`nginx -T` 没有输出相关 location，或容器内 `cat` 报文件不存在，
   都表示镜像、Compose 或挂载仍是旧版本：

   ~~~bash
   docker compose --env-file .env.prod -f compose.prod.yml exec -T nginx nginx -T 2>&1 \
     | grep -A8 -B2 'acme-challenge'
   docker inspect personal-hub-prod-nginx-1 \
     --format '{{range .Mounts}}{{println .Type .Source "->" .Destination .RW}}{{end}}'
   ~~~

   预期必须出现 `/var/lib/letsencrypt -> /var/www/certbot`。如果 `docker inspect` 没有任何挂载，说明服务器上的
   `compose.prod.yml` 不是包含 webroot 挂载的版本，应先按第 4.2 节更新代码，再重复构建和强制重建。

#### `--deploy-hook` 命令被粘连

命令中的 `compose.prod.yml` 与 `exec` 之间必须有空格：

~~~text
正确：... -f /opt/personal-hub/compose.prod.yml exec -T nginx ...
错误：... -f /opt/personal-hub/compose.prod.ymlexec -T nginx ...
~~~

多行命令每行末尾的反斜杠 `\` 也必须保留。终端中显示的
`deploy@VM-0-9-ubuntu:/opt/personal-hub$` 是提示符，不是命令，不能复制进去，否则会出现
`No such file or directory` 或 `command not found`。

## 4. 发布 HTTPS 配置

### 4.1 发布前本地检查

在本地 `main` 工作区完成配置后，先做不需要生产密钥的检查；Compose 插值检查放到服务器执行，避免把生产密钥复制到本地。
本地操作的目的只是确认将要发布的提交包含第 2 节内容，不要在本机创建真实 `.env.prod`：

~~~bash
cd /Users/wangchaocheng/Documents/Code/git/projects/personal-hub
git branch --show-current
git diff --check
git status --short
~~~

确认分支为 `main`，需要发布的 Nginx/Compose 改动已经提交或处于明确的待发布状态。若本地有无关未提交改动，
不要使用 `git reset` 或强行 `git pull` 清理；先单独处理这些改动。

服务器上的 .env.prod 准备好后，再执行：

~~~bash
docker compose --env-file .env.prod -f compose.prod.yml config --quiet
~~~

如果本机没有 Docker，至少在服务器执行下一节的容器内 nginx -t；不要只凭文本检查上线。

### 4.2 服务器读取新版本

先对服务器当前状态和生产环境文件做可恢复备份。备份目录只保存给服务器管理员，权限保持为仅 root 可读：

~~~bash
cd /opt/personal-hub
git status --short
git log -1 --oneline
sudo install -d -m 700 /root/personal-hub-backups
sudo cp -p .env.prod /root/personal-hub-backups/.env.prod.before-https
cp deploy/nginx/default.conf /tmp/personal-hub-default.conf.before-https
cp compose.prod.yml /tmp/personal-hub-compose.prod.yml.before-https
git status --short
git pull --ff-only
chmod 600 .env.prod
docker compose --env-file .env.prod -f compose.prod.yml config --quiet
~~~

`git status --short` 第一次必须为空；如果服务器仓库有未提交配置修改，先停下并查看其来源。`git pull --ff-only`
只接受线性更新，遇到冲突不会擅自合并。`/tmp` 中的两份配置用于本次会话内快速比对，长期回滚仍使用 Git 提交。

然后用 `sudoedit` 修改服务器的 `/opt/personal-hub/.env.prod`。`sudoedit` 会先复制到安全临时文件，保存后才写回，
比用终端粘贴整份密钥更适合修改少数配置。只更新或确认下列三项，其他密码、连接串、SMTP、COS 和 JWT 配置不要改：

~~~bash
cd /opt/personal-hub
sudoedit .env.prod
~~~

~~~dotenv
PUBLIC_APP_ORIGIN=https://personalhub.center
COOKIE_SECURE=true
CORS_ORIGIN=http://111.231.13.252,http://personalhub.center,https://personalhub.center,http://www.personalhub.center,https://www.personalhub.center
~~~

保存后只检查键名，避免把敏感值输出到终端、日志或聊天：

~~~bash
cd /opt/personal-hub
grep -E '^(PUBLIC_APP_ORIGIN|COOKIE_SECURE|CORS_ORIGIN)=' .env.prod | sed 's/=.*$/=<已设置>/'
chmod 600 .env.prod
docker compose --env-file .env.prod -f compose.prod.yml config --quiet
~~~

输出应恰好有三行 `<已设置>`，且 Compose 配置检查无输出并以状态码 0 结束。若 `config --quiet` 报缺少变量，
不要临时删除占位符；按照错误中列出的变量回填现有 `.env.prod`。

确认 .env.prod 的 PUBLIC_APP_ORIGIN、COOKIE_SECURE、CORS_ORIGIN 已填好后，先构建并检查 Nginx：

~~~bash
docker compose --env-file .env.prod -f compose.prod.yml build nginx
docker compose --env-file .env.prod -f compose.prod.yml run --rm --no-deps nginx nginx -t
~~~

nginx -t 必须输出 syntax is ok 和 test is successful。失败时不要重建线上 Nginx。

在最终 `up` 前，再确认主证书和 www 证书都已存在，防止将引用缺失证书的 Nginx 配置带到线上：

~~~bash
sudo test -r /etc/letsencrypt/live/personalhub.center/fullchain.pem
sudo test -r /etc/letsencrypt/live/personalhub.center/privkey.pem
sudo openssl x509 -in /etc/letsencrypt/live/personalhub.center/fullchain.pem \
  -noout -dates -ext subjectAltName
~~~

### 4.3 重建应用和公网入口

PUBLIC_APP_ORIGIN 同时参与 server 运行时和前端静态构建，不能只 restart：

~~~bash
docker compose --env-file .env.prod -f compose.prod.yml up --build -d server server-worker nginx
docker compose --env-file .env.prod -f compose.prod.yml ps
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=100 nginx
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=100 server
~~~

执行过程中浏览器可能有几十秒不可访问，因为 Nginx 容器需要重建。`ps` 中 `server` 和 `nginx` 应为
`running`/`Up`，并且 server healthcheck 为 healthy。若新 Nginx 未启动，不要反复重建；先执行：

~~~bash
docker compose --env-file .env.prod -f compose.prod.yml logs --tail=200 nginx
docker compose --env-file .env.prod -f compose.prod.yml run --rm --no-deps nginx nginx -t
~~~

日志通常会明确指出证书路径、端口占用或 Nginx 语法位置。修复前保持在服务器终端中，不要删除证书目录。

如果本次包含 Prisma migration，先按 production-runbook.md 的 migration 顺序执行，确认 server ready 后再启动 worker 和 Nginx。

### 4.4 应用容器启动失败时先修复再迁移

HTTPS 配置正确并不代表应用容器已经能启动。若 `docker compose ps` 显示 `server` 为
`Restarting (1)`，`docker compose exec server npx prisma migrate deploy` 会报
`Container ... is restarting, wait until the container is running`，先看应用日志：

~~~bash
docker compose --env-file .env.prod -f compose.prod.yml logs \
  --timestamps --no-log-prefix --tail=300 server
docker inspect personal-hub-prod-server-1 \
  --format 'status={{.State.Status}} exit={{.State.ExitCode}} error={{.State.Error}} oom={{.State.OOMKilled}}'
~~~

本次实际原因是 `AI_CREDENTIAL_ENCRYPTION_KEY` 不是 32 字节密钥的 Base64。修复时：

1. 如果数据库中已经保存过 Provider/API 密钥，必须找回原来的有效主密钥；不能随意换新密钥，否则旧凭据无法解密。
2. 如果尚未保存 AI 凭据，在服务器生成新值并写入 `.env.prod`：

   ~~~bash
   openssl rand -base64 32
   sudoedit /opt/personal-hub/.env.prod
   ~~~

   配置格式为 `AI_CREDENTIAL_ENCRYPTION_KEY=<完整 Base64 值>`，不要加引号或换行。
3. 可只验证解码后的字节数，不输出密钥内容：

   ~~~bash
   cd /opt/personal-hub
   key="$(grep '^AI_CREDENTIAL_ENCRYPTION_KEY=' .env.prod | sed 's/^AI_CREDENTIAL_ENCRYPTION_KEY=//')"
   printf '%s' "$key" | base64 -d 2>/dev/null | wc -c
   ~~~

   结果必须是 `32`。然后执行 `chmod 600 .env.prod`、`config --quiet`，重建并强制重建 `server`，确认状态为
   `Up (healthy)` 后，才执行 `npx prisma migrate deploy`。迁移成功后再启动 `server-worker` 和最终 HTTPS Nginx。

## 5. 验收清单

建议按下面顺序验收，前一层失败时先修复，不要继续向后判断：

1. **公网入口**：DNS、TCP 80/443、HTTP 到 HTTPS、www 到主域名。
2. **证书**：证书链、有效期、SAN 是否同时包含两个域名。
3. **应用链路**：live/ready、登录 Cookie、refresh、管理端、上传、邮件和 AI SSE。
4. **前端资源**：index 不缓存、带哈希资源长期缓存、JS/CSS gzip、SSE 不被缓冲。
5. **运维闭环**：Certbot timer、dry-run、续期 hook、续期后 Nginx reload。

除非特别标注，下面的 curl、openssl 和浏览器步骤都在**自己的电脑**执行；Docker、Certbot、systemctl 和
`docker compose` 步骤在**生产服务器**执行。

### 5.1 跳转与证书

在本机终端执行以下命令。每条命令只查看响应头，不会修改服务器：

~~~bash
curl -sS -I http://personalhub.center/
curl -sS -I http://www.personalhub.center/
curl -sS -I http://111.231.13.252/
curl -sS -I https://www.personalhub.center/
curl -sS -I https://personalhub.center/
~~~

预期：

- HTTP 域名和 HTTP 公网 IP 都返回 301，Location 是 https://personalhub.center/...；
- https://www.personalhub.center/... 返回 301 到 https://personalhub.center/...；
- https://personalhub.center/ 返回 200；
- 浏览器证书有效，域名和 www 都没有证书告警。

这里的 `301` 可以是 `308`，只要 Location 指向 `https://personalhub.center` 且保留原路径与 query 即可。首次检查时，
不要在浏览器里忽略证书警告继续访问；先用下面的命令确认服务端实际送出的证书：

检查证书有效期和域名：

~~~bash
echo | openssl s_client -connect personalhub.center:443 -servername personalhub.center 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
~~~

浏览器中再做一次真实验证：打开 `https://personalhub.center`，点击地址栏左侧的锁图标→「连接安全」→「证书有效」，
确认颁发者为 Let's Encrypt 体系、证书未过期、域名包含 `personalhub.center`。随后直接输入
`https://www.personalhub.center`，确认地址栏最终变为不带 `www` 的主域名。

### 5.2 应用链路

~~~bash
curl -sS -o /dev/null -w '%{http_code}\n' https://personalhub.center/api/v1/health/live
curl -sS -o /dev/null -w '%{http_code}\n' https://personalhub.center/api/v1/health/ready
~~~

浏览器按以下顺序手动验证。测试期间打开开发者工具的「Console」和「Network」，保留日志；任一步出现 401、403、
混合内容或 CORS 错误时，截图或导出失败请求的 URL、Request Headers、Response Headers 后再排查。

1. 用无痕窗口打开主站，登录后刷新页面，再退出。Network 中找到 refresh 请求，确认请求 URL 是
   `https://personalhub.center/...`，Cookie 具有 `Secure` 属性且没有 CORS 报错。
2. 打开 `https://personalhub.center/admin/` 登录，依次进入运营概览、主题配置，上传一个可删除的测试文件，
   再返回用户端，确认同站登录态和静态资源均正常。
3. 将浏览器设备模拟设为手机宽度，打开 AI 对话，测试发送、切换历史会话、继续生成。SSE 消息应逐步出现；若一直
   Pending 或结束后才一次性出现，记录 `/api/v1/` 请求并检查 Nginx 的 `proxy_buffering off` 与 gzip 例外。
4. 上传封面和小册附件，确认 COS 请求和回调未被旧 HTTP Origin 拒绝；再检查一封验证或重置邮件，链接必须以
   `https://personalhub.center` 开头。

### 5.3 gzip、缓存和 Lighthouse

~~~bash
curl -sS -I https://personalhub.center/ | rg -i 'cache-control|content-encoding'
curl -sS -I https://personalhub.center/<带哈希的-js-文件> | rg -i 'cache-control|content-encoding'
~~~

预期：

- index.html 是 no-cache；
- 带哈希的 JS/CSS 是 public, max-age=31536000, immutable；
- JS/CSS 响应有 Content-Encoding: gzip；
- /api/v1/ 不压缩，不把 SSE 缓冲成一次性响应。

按切换前相同的四个页面、桌面和手机各跑一次 Lighthouse，并将结果补到
docs/prd/post-launch/performance-dashboard-prd.md §3 或 /status 的生产基线表。

在 Chrome 中的入口为：打开目标页→开发者工具→「Lighthouse」→选择 Navigation、Desktop 或 Mobile→点击
「Analyze page load」。切换前后使用相同网络环境、页面状态和设备档位，至少记录 Performance、LCP、INP、CLS、
传输体积和主要建议；不要把登录态不同或缓存状态不同的两次分数直接对比。

### 5.4 一次完整的发布后验收路径

按以下顺序执行并记录结果：

1. **DNS 和跳转**

   ~~~bash
   dig +short personalhub.center A
   dig +short www.personalhub.center A
   curl -sS -I http://personalhub.center/
   curl -sS -I http://www.personalhub.center/
   curl -sS -I https://www.personalhub.center/
   ~~~

   两个 A 记录应指向 `111.231.13.252`；HTTP 请求应跳转到 `https://personalhub.center/...`；HTTPS 的 `www` 请求
   应跳转到不带 `www` 的主域名。若 DNS 使用 CDN/WAF，A 记录显示 CDN IP 也可能是正常的，但必须确认 80/443
   请求最终到达本项目的 Nginx。

2. **证书和 TLS**

   ~~~bash
   echo | openssl s_client -connect personalhub.center:443 \
     -servername personalhub.center 2>/dev/null \
     | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
   ~~~

   `subjectAltName` 必须包含 `personalhub.center` 和 `www.personalhub.center`，`notAfter` 必须晚于当前日期。
   浏览器打开两个域名时不能出现证书告警，主域名最终显示 HTTPS。

3. **服务和 API**（服务器先确认容器，电脑再从公网访问）

   ~~~bash
   # 服务器
   docker compose --env-file .env.prod -f compose.prod.yml ps
   docker compose --env-file .env.prod -f compose.prod.yml logs --tail=100 server server-worker nginx
   ~~~

   `server` 应为 `Up (healthy)`，Postgres/Redis 应为 healthy，worker 和 Nginx 应为 `Up`。然后在本机执行：

   ~~~bash
   curl -sS -o /dev/null -w 'live=%{http_code}\n' \
     https://personalhub.center/api/v1/health/live
   curl -sS -o /dev/null -w 'ready=%{http_code}\n' \
     https://personalhub.center/api/v1/health/ready
   ~~~

   预期都是 `200`。如果出现 502，先看 Nginx 和 server 日志；如果出现 403，检查请求 Origin、Cookie、
   `CORS_ORIGIN` 和 `PUBLIC_APP_ORIGIN`，不要先扩大为全网白名单。

4. **真实用户链路**

   - 无痕窗口打开主站，注册或登录，刷新页面后确认仍保持登录。
   - 在开发者工具 Network 中找到 refresh 请求，确认 URL 为 HTTPS，Cookie 带 `Secure`，没有 CORS 或 mixed content 错误。
   - 进入 `/admin/`，登录并打开运营概览、主题配置和一个列表页；确认没有持续 401/403/5xx。
   - 上传一个可删除的测试文件，确认上传、预览和删除完成。
   - 打开 AI 对话，分别在桌面宽度和手机宽度发送消息；确认消息进入当前会话、SSE 逐步返回、切换历史会话后旧会话仍能继续生成。
   - 检查验证或重置邮件链接以 `https://personalhub.center` 开头。

5. **前端资源与响应行为**

   ~~~bash
   # 先从首页 HTML 中找一个实际的哈希 JS 文件，再替换下面的路径
   curl -sS -I https://personalhub.center/
   curl -sS -I https://personalhub.center/<实际哈希-js-文件>
   ~~~

   首页应有 `Cache-Control: no-cache`；哈希 JS/CSS 应有 `public, max-age=31536000, immutable` 和
   `Content-Encoding: gzip`。AI SSE 请求不应等待到结束才一次性返回；若出现这种情况，检查 Nginx 的
   `proxy_buffering off` 和 API location 的 `gzip off`。

## 6. 证书续期章节说明

证书续期的实际操作已经集中到文档最前面的 **第 0.5 节《后续证书续期：日常只执行这些命令》**，避免首次切换完成后还要
在文档后部查找命令。第 0.5 节包含定时器检查、证书信息、续期演练、deploy hook、Nginx reload 和续期后的确认方式。

本节只保留章节位置说明；遇到 Certbot、ACME challenge、Nginx 挂载或 `deploy-hook` 错误时，查看第 3.4 节的排障记录。

## 7. 切换失败时回滚

只在 HTTPS 配置导致站点不可用或 Cookie 无法恢复时回滚。先在服务器确认故障是 DNS、证书、Nginx 还是应用；
DNS 已正确指向服务器而 Nginx 无法启动时，才需要回滚应用配置。

1. 保留 `/etc/letsencrypt`，不要删除证书文件、DNS 记录或腾讯云的 80/443 安全组规则。
2. 在 `/opt/personal-hub` 记录当前故障信息：

   ~~~bash
   docker compose --env-file .env.prod -f compose.prod.yml ps
   docker compose --env-file .env.prod -f compose.prod.yml logs --tail=200 nginx
   docker compose --env-file .env.prod -f compose.prod.yml logs --tail=200 server
   ~~~

3. 使用本次发布前记录的 Git 提交回退 Nginx 与 Compose 到 HTTP 配置，或由维护者将修复提交发布到 main。不要使用
   `git reset --hard` 清理服务器目录；`git revert` 或按既有发布流程切到上一可用提交，才能保留审计记录。
4. 用 `sudoedit /opt/personal-hub/.env.prod` 暂时改回：

   ~~~dotenv
   PUBLIC_APP_ORIGIN=http://111.231.13.252
   COOKIE_SECURE=false
   ~~~

5. CORS_ORIGIN 临时保留公网 IP 的 HTTP Origin。
6. 重新构建并重建 server、worker、Nginx，然后按 production-verification.md 做健康检查。

回滚后不要立即删除 DNS 或证书。先保存 Nginx 日志、浏览器 Network/Console、curl -I 响应头和
docker compose ps，再定位是 DNS、证书、Nginx、Cookie、CORS 还是 COS CORS 问题。

## 8. 切换完成标准

- personalhub.center 已作为唯一业务 Origin；
- www.personalhub.center 和 HTTP 请求都稳定跳转到主域名；
- 443 证书覆盖裸域名和 www，certbot dry-run 通过；
- 登录、refresh、退出、上传、邮件、AI SSE、管理端和手机端 AI 对话均通过验收；
- Lighthouse 已记录切换前后数据；
- 稳定运行一周后，再延长 HSTS，并从 CORS_ORIGIN 清理不再需要的旧 HTTP/IP Origin。
