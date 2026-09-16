# 个人远程阅读部署方案（COS 小册 + 生产级架构适配）

> 状态：🟢 阶段 A 远程阅读可参考；Nest 生产段落已归档
> 最后更新：2026-08-02
> 目标：Ubuntu 24.04 / 2 核 4G / 60GB 服务器上部署 react-first，小册存腾讯 COS，架构对齐后续 React + Next.js + NestJS 生产形态
> **总览**：[deployment-plan.md](./deployment-plan.md) · **速查**：[server-deployment-guide.md](./server-deployment-guide.md)

> **历史提示**：本文涉及 `apps/api`、`/api/**`、PM2 API、旧 API / 数据模型草案的 Nest 规划不可执行。Nest 目录、API 与 Compose 以 [Nest Server 脚手架 PRD](../../prd/long-term/nest-server-bootstrap-prd.md)、[Canonical API](../../backend/canonical-api.md) 和 [Nest Compose 策略](../nest-compose-strategy.md) 为准。

---

## 0. 双轨策略：当前能读 vs 未来生产（不冲突）

本文包含**两条并行路径**，服务于不同阶段，**互不否定**：

| 维度     | **阶段 A：当前立即可用**                                        | **阶段 B：目标生产架构**                                            |
| -------- | --------------------------------------------------------------- | ------------------------------------------------------------------- |
| 目的     | 你个人远程看小册学习                                            | 正式对外、React + Next + NestJS                                     |
| 启动方式 | **`pnpm --filter user-web dev:mock`（dev + mock）**                 | `pnpm build:user` + NestJS API                                      |
| 访问方式 | **`http://服务器IP:8000` 直连**，不配 Nginx                     | Nginx :443 + HTTPS                                                  |
| 小册数据 | rsync 到服务器 `content-local/` + `sync:booklets`（COS 可后置） | 腾讯 COS + NestJS 按需读 + 缓存                                     |
| 后端     | Umi mock（现有代码零改造）                                      | `apps/server` NestJS + PostgreSQL + Redis + Compose `server-worker` |
| 安全     | 云安全组限制 8000 仅你的 IP；可选 SSH 隧道                      | 域名 + HTTPS + 登录/RBAC                                            |

```mermaid
flowchart TB
    subgraph now ["阶段 A（现在）"]
        You1["你"] --> Dev["react-web dev :8000"]
        Dev --> Mock["Umi mock"]
        Mock --> Local["content-local/ + generated.ts"]
    end

    subgraph later ["阶段 B（后续）"]
        You2["用户"] --> Nginx["Nginx"]
        Nginx --> Static["react-web dist"]
        Nginx --> Api["NestJS API"]
        Api --> COS["腾讯 COS"]
        Api --> Cache["Redis + 磁盘缓存"]
    end

    now -.->|"目录规范、API 契约、Monorepo 沿用"| later
```

**为什么不冲突：**

1. 阶段 A 仍用 Monorepo 里的 `apps/user-web`，Git 工作流不变。
2. 小册目录（`meta.json` + 章节 md）与阶段 B 的 COS 布局一致，以后 rsync 可换成 `booklet:push`。
3. 前端现有 mock service 的 `/api/*` 路径只是迁移线索；阶段 B 以 `/api/v1` Canonical 契约替换数据源。
4. 阶段 A **刻意不引入** NestJS / Docker / Nginx；阶段 B 仅遵循 [Nest Compose 策略](../nest-compose-strategy.md)，下文历史草案不再可执行。

**阶段 A 操作：见 [§ A 当前部署步骤](#a-当前部署步骤dev--直连-8000)**。

---

## Nest 生产接入摘要（当前）

当远程阅读从阶段 A mock 切到正式后端时，使用 `apps/server` 的 `/api/v1` 接口，生产以 Compose 部署 Nginx、`server`、`server-worker`、PostgreSQL 与 Redis；对象正文和文件使用腾讯 COS，开发环境才用 MinIO。业务变更与 outbox 同事务写入，独立 worker 负责 dispatcher / BullMQ 消费。

- 认证为 JWT-only，密码使用 Argon2id；不沿用本文历史 API、PM2 API 或旧 Token 设想。
- PostgreSQL 每日逻辑备份保留 14 天，发布/迁移前增加备份；上线前、重大迁移前须在隔离实例完成恢复演练。
- 告警事件、渠道占位、阈值、巡检和恢复责任以 [Nest Compose 策略 §5.1](../nest-compose-strategy.md#51-最低告警与巡检上线前必须落位) 为唯一依据。

---

## 1. 背景与约束

| 项       | 说明                                                                             |
| -------- | -------------------------------------------------------------------------------- |
| 使用场景 | 个人远程阅读小册学习，暂不对公网开放完整产品能力                                 |
| 服务器   | Ubuntu 24.04，2 核 4G，系统盘 60GB                                               |
| 小册规模 | 约 71 本、1973 章节（本地 `content-local/`）                                     |
| 存储     | 小册正文不上 Git；**阶段 A** rsync 到服务器；**阶段 B** 统一进腾讯 COS           |
| 架构要求 | 目录与 API 契约按长期 **react-web + next-web + NestJS** 设计；**运行形态分阶段** |
| 本期不做 | 完整 RBAC、AI 计费、Meilisearch、Flutter                                         |

---

## 2. 现有代码梳理

### 2.1 小册数据流（当前）

```mermaid
flowchart LR
    Local["content-local/booklets/"] --> Sync["sync-local-booklets.ts"]
    Sync --> Gen["local-booklets.generated.ts"]
    Gen --> Mock["Umi mock/content.ts"]
    Mock --> Svc["services/booklet.ts"]
    Svc --> Page["BookletChapter 页面"]
```

| 环节          | 文件                                                | 现状                                           | 问题                                             |
| ------------- | --------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------ |
| 输入          | `content-local/`                                    | gitignore，本地 Markdown + meta.json           | 无法直接在服务器读取                             |
| 同步脚本      | `apps/user-web/src/scripts/sync-local-booklets.ts` | 扫描目录，**把所有章节 body 打进一个 TS 文件** | 71 本体量巨大；build 产物膨胀；不适合远程        |
| 生成物        | `mock/data/local-booklets.generated.ts`             | gitignore，prepare 时自动生成                  | 仅 dev/mock 可用                                 |
| Mock API      | `mock/content.ts` L106-128                          | `GET .../chapters` **返回全部章节含 body**     | 一次请求可能数 MB～数十 MB                       |
| Mock API      | `mock/workspace.ts` L108                            | 本地小册列表读 generated 文件                  | 依赖本地生成物                                   |
| 前端 Service  | `src/services/booklet.ts`                           | 两个接口：章节列表 + 单章                      | 接口形态正确，但 mock 返回过重                   |
| 阅读页        | `src/pages/public/BookletChapter/index.tsx`         | 先拉列表再拉单章                               | **已按「列表 + 单章」拆分请求**，改 API 即可受益 |
| 共享类型      | `packages/shared-types/src/booklet.ts`              | `BookletChapter.body` 必填                     | 需增加「列表项不含 body」的类型变体              |
| 长期 API 契约 | `docs/backend/canonical-api.md`                     | 章节列表**本来就不含正文**                     | mock 与正式契约不一致                            |

### 2.2 前端其他依赖 mock 的模块（本期可保留 mock 或静态）

| 模块         | Mock 文件           | 个人阅读期策略                       |
| ------------ | ------------------- | ------------------------------------ |
| 登录 / 权限  | `mock/auth.ts`      | 暂保留 mock 或 Nginx Basic Auth 整站 |
| 内容中心列表 | `mock/content.ts`   | 小册走真实 API；其余 mock 数据可保留 |
| 工作区       | `mock/workspace.ts` | 非核心，可继续 mock                  |
| AI           | `mock/ai.ts`        | 非核心，继续 mock                    |
| 后台         | `mock/admin.ts`     | 非核心，继续 mock                    |

### 2.3 生产构建现状

| 项                | 现状                                              |
| ----------------- | ------------------------------------------------- |
| Umi mock          | **仅 dev 生效**，`pnpm build` 后 `/api/*` 无 mock |
| `config/proxy.ts` | 无生产代理配置                                    |
| `apps/server`     | 已完成本地阶段 0；尚未部署到远程服务器             |
| Docker Compose    | 已有本地依赖 `compose.dev.yml`；尚无生产全栈编排 |

**结论（分阶段）：**

- **阶段 A（dev + mock）**：现有链路即可远程读小册，**不需要 build、不需要 Nginx、不需要 NestJS**；小册用 rsync 放到服务器后 `sync:booklets`。
- **阶段 B（build + 生产）**：必须引入 NestJS + COS + 缓存；`pnpm build` 后 mock 不生效，见下文第 3～6 节。

---

## A. 当前部署步骤（dev + 直连 :8000）

> 适用：Ubuntu 24.04，2 核 4G，60GB；**仅个人远程阅读**；暂不用 Nginx / build / COS。

### A.1 服务器目录规划（从空盘开始）

服务器当前可能只有系统分区、尚未建业务目录。**先规划再动手**，阶段 A 与阶段 B 共用同一套根路径。

```text
/
├── opt/
│   └── personal-hub/                 # 【代码】Git 仓库根目录
│       ├── apps/
│       ├── packages/
│       ├── content-local -> /data/personal-hub/content-local   # 阶段 A 软链，Nest 生产不依赖
│       ├── ecosystem.config.js
│       └── ...
├── data/
│   └── personal-hub/
│       └── content-local/            # 【小册源文件】rsync 目标
│           ├── Linux 命令速查与服务器运维入门/
│           ├── Nest 通关秘籍  最新200章/
│           └── ...
├── var/
│   ├── cache/personal-hub/           # 【预留】阶段 B 章节磁盘缓存
│   └── log/                          # 系统/服务日志（系统自带）
└── etc/
    └── personal-hub/                 # 【预留】阶段 B 放 .env
```

| 路径                               | 阶段 A           | 阶段 B                      |
| ---------------------------------- | ---------------- | --------------------------- |
| `/opt/personal-hub`                | 必建：代码 + PM2 | 同左                        |
| `/data/personal-hub/content-local` | 阶段 A 必建：小册 | Nest 首版一次性导入源；验证 COS 后可清理 |
| `/var/cache/personal-hub`          | 可不建           | 章节 LRU 缓存               |
| `/etc/personal-hub`                | 可不建           | 生产环境变量                |

**空盘一键建目录（复制执行）：**

```bash
sudo mkdir -p /opt/personal-hub
sudo mkdir -p /data/personal-hub/content-local
sudo mkdir -p /var/cache/personal-hub/chapters
sudo mkdir -p /etc/personal-hub
# 把目录交给当前登录用户（或改成 deploy）
sudo chown -R $USER:$USER /opt/personal-hub /data/personal-hub /var/cache/personal-hub /etc/personal-hub
ls -la /opt /data /var/cache /etc/personal-hub
```

> 详细命令说明见本地小册《Linux 命令速查与服务器运维入门》第 02、12 章。

### A.2 服务器一次性软件准备 + 拉代码

> **Git 源：** 服务器使用 **Gitee**（`https://gitee.com/oralemon/personal-hub.git`）。本地开发可继续 push GitHub，部署前 `git push gitee <分支>`。

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget unzip

# Node.js 22 + pnpm + PM2
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
corepack enable
corepack prepare pnpm@10.28.2 --activate
sudo npm install -g pm2

node -v && pnpm -v && pm2 -v

cd /opt/personal-hub
git clone https://gitee.com/oralemon/personal-hub.git .
git checkout develop    # 或与团队一致的发布分支
pnpm install
# prepare 会跑 sync:booklets；尚未 rsync 小册时可能是空/仅示例
```

**若第一版为 tar/scp 手动上传、目录无 `.git`：** 见 [deployment-plan.md §5.2](./deployment-plan.md#52-从第一版手动上传迁移到-gitee你的现状)，保留 `/data/personal-hub/content-local` 作为阶段 A 或一次性导入源即可。

### A.3 同步小册（本地 → 服务器）

小册源文件目前位于 `/data/personal-hub/content-local/`（与代码分离）。Nest 生产导入完成并验证 COS 后，不要求继续长期保留实体小册目录。

**在本地电脑执行（推荐只传白名单，节省磁盘与时间）：**

```bash
# 在仓库根目录；将 deploy / IP 换成你的
rsync -avz --progress \
  "./content-local/Nest 通关秘籍  最新200-upgrade" \
  "./content-local/Nest 通关秘籍  最新200章" \
  "./content-local/Next.js 开发指南" \
  "./content-local/Next.js 开发指南-upgrade" \
  "./content-local/React 进阶实践指南" \
  "./content-local/React 实战：设计模式和最佳实践" \
  "./content-local/React 通关秘籍" \
  "./content-local/React 组合式开发实践：打造企业管理系统五大核心模块" \
  "./content-local/Redis 深度历险：核心原理与应用实践" \
  "./content-local/Electron 应用开发实践指南" \
  "./content-local/TypeScript 入门教程" \
  "./content-local/TypeScript 全面进阶指南" \
  "./content-local/Linux 命令速查与服务器运维入门" \
  <用户>@<服务器IP>:/data/personal-hub/content-local/
```

**在服务器执行：**

```bash
cd /opt/personal-hub
ln -sfnT /data/personal-hub/content-local ./content-local
readlink -f content-local
pnpm sync:booklets
# 当前白名单最多约 12 本 Markdown 小册；实际数量以目录是否存在为准
```

### A.4 用 PM2 跑 dev（不是 build）

**权威步骤见 [pm2-deployment.md](./pm2-deployment.md)**。

仓库根 [`ecosystem.config.js`](../../ecosystem.config.js) 会通过 [`scripts/pm2-start-dev.sh`](../../scripts/pm2-start-dev.sh) **启动前自动 sync 小册**，并读取 `CONTENT_LOCAL_DIR=/data/personal-hub/content-local`：

```bash
cd /opt/personal-hub

# 若历史上误启动过旧文件，先清理；not found 可忽略
pm2 delete ecosystem.dev 2>/dev/null || true

pm2 start ecosystem.config.js --only personal-hub-dev
pm2 save
pm2 startup   # 按提示执行 sudo 命令
pm2 logs personal-hub-dev --lines 50 --nostream   # 应看到 sync 完成 + App listening at
```

PM2 进程按 Linux 用户隔离，后续管理必须继续使用启动时的用户，不要混用 `pm2` 和 `sudo pm2`。

### A.5 开放端口（不用 Nginx）

**云厂商控制台（推荐）：** 安全组入站仅允许访问设备的**真实公网出口 IP `/32`**访问 TCP 8000。这里的来源不是服务器 IP，也不是 Mac 的 `192.168.x.x` 局域网 IP；家庭宽带、手机热点、VPN 和代理都可能改变实际出口。

若用 ufw（可选，与云安全组二选一或叠加）：

```bash
sudo ufw allow OpenSSH
sudo ufw allow from <你的公网IP> to any port 8000 proto tcp
sudo ufw enable
```

如果 `sudo ufw status verbose` 显示 `inactive`，说明 UFW 当前没有拦截，但腾讯云安全组仍然生效。`0.0.0.0/0` 表示允许全部 IPv4，只能临时用于确认安全组是否为阻塞点；当前 dev + mock 服务不应长期全网开放。

### A.6 访问与验证

先在服务器内验证应用与监听端口：

```bash
pm2 status
ss -lntp | grep ':8000'
curl -I http://127.0.0.1:8000/content
curl -I http://127.0.0.1:8000/workspace/booklets
```

预期进程名为 `personal-hub-dev`、状态为 `online`，端口显示 `*:8000`，HTTP 返回 `200` 或 `302`。服务器内成功只证明应用正常，不代表公网安全组已放行。

然后在本机浏览器打开：

```txt
http://<服务器IP>:8000/content
http://<服务器IP>:8000/workspace/booklets
http://<服务器IP>:8000/content/booklets/<id>/chapters/<chapterId>
```

必须使用 `http://`，阶段 A 的 8000 没有 HTTPS。

验证清单：

- [ ] 内容中心能看到本地同步的小册
- [ ] 章节可切换、Markdown 正常渲染
- [ ] `pm2 status` 为 online
- [ ] 8000 端口未对 `0.0.0.0/0` 全网开放（个人使用）

若只有把安全组来源改成 `0.0.0.0/0` 才能访问，说明之前填写的 `/32` 不是浏览器实际公网出口。可临时开放并在服务器执行：

```bash
sudo tcpdump -ni any -c 10 'tcp dst port 8000'
```

刷新页面，从抓包输出的源地址确认真实公网 IP，再立即把安全组收紧为该地址 `/32`。

**更安全的替代：** 不开放 8000，用 SSH 隧道本地访问：

```bash
# 在你本机执行
ssh -L 8000:127.0.0.1:8000 <用户>@<服务器IP>
# 然后浏览器打开 http://localhost:8000
```

此时 PM2 可改为只监听 `127.0.0.1`（Umi 默认 `--host 0.0.0.0` 时改 `127.0.0.1` 需加 `--host 127.0.0.1`，隧道方案仍可用 0.0.0.0）。

### A.7 日常更新

**只改代码（推荐一键脚本）：**

```bash
# 本地先：git push gitee develop
cd /opt/personal-hub && pnpm deploy:server
# 依赖异常：pnpm deploy:server -- --clean
```

**只改小册：**

```bash
# 本地 rsync 后，服务器重启即可（启动脚本会自动 sync）：
pm2 restart personal-hub-dev
```

**停止与移除：**

```bash
pm2 stop personal-hub-dev
pm2 delete personal-hub-dev
```

### A.8 阶段 A 的已知限制（接受即可）

| 限制                     | 说明                                                                     |
| ------------------------ | ------------------------------------------------------------------------ |
| dev 模式占内存           | 2C4G 够用，建议 `max_memory_restart 1500M`                               |
| 首次编译慢               | 启动后等 Umi 编译完成再访问                                              |
| mock 列表一次带全章 body | 71 本时首屏略慢；个人阅读可接受；阶段 B 按单章优化                       |
| 无 HTTPS                 | 公网 IP 直连使用 HTTP；阶段 B 再上 Nginx + 证书                          |
| 不宜公网宣传             | 无正式鉴权且运行 dev + mock；必须限制安全组来源，或增加 Nginx Basic Auth |

---

## 已归档的 Nest 目标架构与实施草案（不可执行）

> 本节至文末的 `apps/api`、`/api/**`、PM2 API、生产 MinIO、COS 数据库备份、旧对象模型和示例部署地址/密钥均不可执行。保留它们只为追溯小册迁移思路；实现时仅使用本页“ Nest 生产接入摘要”及其链接的权威文档。

### 3. 目标架构（历史草案）

### 3.1 系统上下文

```mermaid
flowchart TB
    User["你（浏览器）"] --> Nginx["Nginx :443"]
    Nginx --> React["react-web 静态资源<br/>dist/"]
    Nginx --> Api["apps/server NestJS :3001"]
    Api --> PG[("PostgreSQL<br/>元数据")]
    Api --> Redis[("Redis<br/>热缓存")]
    Api --> Disk["/var/cache/personal-hub<br/>磁盘 LRU"]
    Api --> COS["腾讯 COS<br/>小册正文"]
    Next["apps/next-web<br/>（后续）"] -.-> Api
```

原则：

1. **所有前端**（react-web、未来 next-web）只调 `/api/**`，契约见 `docs/backend/canonical-api.md`。
2. **小册正文**以 COS 为 Source of Truth；PostgreSQL 只存元数据与章节索引。
3. **Redis + 本地磁盘**做分级缓存，**绝不**一次加载整库小册正文。
4. 本地开发：仍可用 `content-local/` + 上传脚本；服务器不挂载 71 本小册目录。

### 3.2 COS 目录规范

```txt
{bucket}/
  booklets/
    {bookletId}/
      meta.json                 # 小册元信息（title/author/summary/cover/tags）
      manifest.json             # 章节索引（无 body，见 4.2）
      chapters/
        001-introduction.md
        002-components.md
      source.zip                # 可选：整本打包，供下载
  uploads/                      # 后续 PDF/封面等
  backups/                      # 可选：数据库/配置备份
```

`bookletId` 与现有脚本一致：目录路径 MD5 前 10 位（`loc-xxxxxxxxxx`），保证本地重新上传 ID 稳定。

### 3.3 服务器目录规范（与 Git 分离）

```txt
/opt/personal-hub/              # Git 仓库（仅代码）
/etc/personal-hub/
  .env                          # 生产密钥（不进 Git）
/var/cache/personal-hub/
  chapters/                     # 章节正文磁盘 LRU（建议上限 8～12GB）
  manifests/                    # manifest 本地副本（可选）
/data/personal-hub/
  postgres/                     # Docker 数据卷
  redis/                        # Docker 数据卷
```

60GB 磁盘预算（建议）：

| 用途                       | 预估                      |
| -------------------------- | ------------------------- |
| 系统 + Docker 镜像         | ~12GB                     |
| 代码 + node_modules + dist | ~4GB                      |
| PostgreSQL（仅元数据）     | ~1GB                      |
| Redis                      | 512MB～1GB                |
| 章节磁盘缓存               | **8～12GB（可配置上限）** |
| 日志 + 余量                | ~10GB                     |
| **小册正文**               | **在 COS，不占本地盘**    |

---

## 4. API 与缓存设计

### 4.1 请求粒度：整本 vs 单章

与 `docs/backend/canonical-api.md` 对齐，并显式禁止列表带正文：

| 接口                                              | 返回内容           | 认证                      | 说明                                                                 |
| ------------------------------------------------- | ------------------ | ------------------------- | -------------------------------------------------------------------- |
| `GET /api/contents?type=booklet`                  | 小册列表（元数据） | 个人期可公开或 Basic Auth | 不含任何章节 body                                                    |
| `GET /api/contents/:id`                           | 小册详情           | 同上                      | 不含章节 body                                                        |
| `GET /api/contents/:id/chapters`                  | **章节索引列表**   | 同上                      | 默认 `fields=summary`：id/title/sort/wordCount/toc 摘要，**无 body** |
| `GET /api/contents/:id/chapters/:chapterId`       | **单章正文**       | 同上                      | 含 `body` + 完整 `toc`                                               |
| `GET /api/contents/:id/source`                    | 整本下载           | 登录/管理员               | 302 到 COS 签名 URL（`source.zip`）                                  |
| `POST /api/admin/booklets/sync`                   | 触发索引刷新       | 管理员                    | 从 COS manifest 同步到 PostgreSQL                                    |
| `GET /api/contents/:id/chapters?includeBody=true` | 全部正文           | **禁止对前端开放**        | 仅 CLI/运维脚本，需 Admin + 分页                                     |

**前端阅读页现有调用已符合「列表 + 单章」**，只需让列表接口去掉 body，并修正 mock 与未来 NestJS 实现。

### 4.2 manifest.json 结构（COS + DB 同步源）

```json
{
  "bookletId": "loc-a1b2c3d4e5",
  "version": 3,
  "syncedAt": "2026-07-21T12:00:00Z",
  "chapterCount": 28,
  "chapters": [
    {
      "id": "loc-ch-xxxxx",
      "order": 1,
      "title": "引言",
      "cosKey": "booklets/loc-a1b2c3d4e5/chapters/001-introduction.md",
      "wordCount": 1200,
      "toc": [{ "level": 2, "text": "背景", "anchor": "背景" }]
    }
  ]
}
```

### 4.3 三级缓存策略（只缓存一部分）

```mermaid
flowchart TD
    Req["GET 单章"] --> L1["L1 Redis<br/>热章节 LRU"]
    L1 -->|miss| L2["L2 磁盘 LRU<br/>/var/cache/personal-hub"]
    L2 -->|miss| COS["COS GetObject"]
    COS --> L2
    L2 --> L1
    L1 --> Resp["返回 JSON"]
```

| 层级         | 存什么                                      | 不存什么          | 建议参数                                |
| ------------ | ------------------------------------------- | ----------------- | --------------------------------------- |
| **L1 Redis** | 最近访问章节 body；manifest 索引            | 全部 1973 章      | `maxmemory 512mb`；章节 key LRU；TTL 7d |
| **L2 磁盘**  | 从 COS 拉下的 `.md` 文件                    | 整本 zip 长期缓存 | 上限 **10GB**；LRU 淘汰                 |
| **L3 COS**   | 全量源文件                                  | —                 | 标准存储；可按需开 CDN                  |
| **浏览器**   | `Cache-Control: private, max-age=3600` 单章 | 列表接口短缓存    | 由 API 响应头控制                       |

**预取策略**（可选，Phase 2）：

- 读完第 N 章时，后台异步预取 N+1 章到 Redis/磁盘。
- 章节目录 manifest 常驻 Redis（体积小，71 本通常 < 5MB）。

**绝不做的**：

- 启动时把 71 本全部载入内存。
- `GET /chapters` 返回全部 body。
- 把 COS 桶设成公开读（用服务端 SDK + 签名 URL）。

---

## 5. 代码改造计划（分阶段，暂不实施）

### Phase 0：基础设施包（Monorepo 级）

| 序号 | 任务                           | 新增/修改文件                               | 说明                                                                                    |
| ---- | ------------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------- |
| 0.1  | 共享类型：章节列表项与详情分离 | `packages/shared-types/src/booklet.ts`      | 新增 `BookletChapterSummary`（无 body）；`BookletChapter` 保留 body                     |
| 0.2  | COS 存储抽象                   | `packages/storage/`（新建）                 | `StorageProvider` 接口；实现 `CosStorageProvider`（上传/下载/签名 URL/hash 对比）       |
| 0.3  | 小册同步 CLI                   | `packages/booklet-sync/`（新建）            | 从 `content-local` 扫描 → 上传 COS → 写 manifest；供本地 `pnpm booklet:push` 与 CI 使用 |
| 0.4  | 环境变量约定                   | `docs/engineering/env-variables.md`（新建） | `COS_SECRET_ID/KEY/BUCKET/REGION`、`CACHE_MAX_DISK_GB` 等                               |

### Phase 1：最小 NestJS API（`apps/server`）

| 序号 | 任务           | 新增/修改文件                     | 说明                                                                         |
| ---- | -------------- | --------------------------------- | ---------------------------------------------------------------------------- |
| 1.1  | 工程骨架       | `apps/server/`                    | NestJS + Express + Prisma；按 Canonical 数据模型落地内容与文件表             |
| 1.2  | 存储模块       | `apps/server/src/storage/`        | 封装 `packages/storage`                                                      |
| 1.3  | 小册模块       | `apps/server/src/booklets/`       | 读 COS manifest；写 PG 元数据；实现 4.1 各接口                               |
| 1.4  | 缓存模块       | `apps/server/src/cache/`          | Redis + 磁盘 LRU；统一 `BookletContentCacheService`                          |
| 1.5  | 内容模块       | `apps/server/src/contents/`       | 列表/详情；小册 type 走 booklet 分支                                         |
| 1.6  | 管理同步       | `apps/server/src/admin/booklets/` | `POST /admin/booklets/sync`：扫描 COS `booklets/*/manifest.json` → upsert DB |
| 1.7  | Docker Compose | `docker-compose.yml`（仓库根）    | 仅 `postgres` + `redis`；API 先 PM2 跑在宿主机（便于调试）                   |

### Phase 2：react-web 切真实 API

| 序号 | 任务          | 修改文件                                             | 说明                                                                                  |
| ---- | ------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 2.1  | 生产 API 地址 | `apps/user-web/config/config.ts`、`config/proxy.ts` | 增加 `UMI_ENV=prod` 时 `define PUBLIC_API_URL`；dev 仍 mock                           |
| 2.2  | Service 层    | `src/services/booklet.ts`                            | 章节列表返回类型改为 `BookletChapterSummary[]`                                        |
| 2.3  | 阅读页        | `BookletChapter/index.tsx`                           | 确认目录 Menu 不依赖 `body`（当前已满足）                                             |
| 2.4  | Mock 对齐契约 | `mock/content.ts`                                    | `GET .../chapters` 去掉 body，与 NestJS 一致；本地无 API 时可继续 mock                |
| 2.5  | 构建          | `package.json`                                       | `build:react` 前不再依赖全量 generated；可选保留 `sync:booklets` 仅用于本地 mock 开发 |
| 2.6  | 工作区小册页  | `workspace/Booklets/index.tsx`                       | 列表改调真实 API 或 `/workspace/booklets/local` 指向 COS 索引                         |

### Phase 3：本地 → COS 上传链路

| 序号 | 任务                       | 说明                                                                           |
| ---- | -------------------------- | ------------------------------------------------------------------------------ |
| 3.1  | `pnpm booklet:push`        | 根目录脚本：扫描 → 增量上传 COS（ETag/MD5）→ 更新 manifest                     |
| 3.2  | `pnpm booklet:sync-remote` | 可选：SSH 到服务器触发 `POST /admin/booklets/sync`                             |
| 3.3  | 废弃路径                   | `local-booklets.generated.ts` 仅保留「纯本地 mock 开发」模式，文档标明生产不用 |

### Phase 4：为 next-web 预留（后续，本期只留接口）

| 项       | 做法                                                                                          |
| -------- | --------------------------------------------------------------------------------------------- |
| API 路径 | 保持 `/api/contents/**`，next-web 与 react-web 共用                                           |
| 类型     | 全部在 `packages/shared-types`                                                                |
| 阅读页   | next-web 后续实现 SEO 版 `/content/booklets/[id]/chapters/[chapterId]`，复用同一 service 契约 |
| 认证     | NestJS Guard 统一；next-web 通过 cookie / JWT 透传                                            |

### 5.1 改造影响面

| 功能             | 影响                 |
| ---------------- | -------------------- |
| 小册阅读         | **核心改造**         |
| 内容中心小册卡片 | 改走 API 列表        |
| 工作区小册管理   | 列表数据源变更       |
| 登录/AI/后台     | 本期可不动           |
| 本地纯 mock 开发 | 保留，与生产路径并行 |

---

## 6. 服务器部署配置（Ubuntu 24.04，逐步命令）

> 以下按**目标架构**编写。Phase 1 代码尚未实现时，可先完成 6.1～6.4、6.6（COS），API 就绪后再执行 6.7～6.9。

### 6.1 创建部署用户与目录

```bash
# 以 root 或具备 sudo 的用户执行
sudo adduser deploy
sudo usermod -aG sudo deploy
sudo mkdir -p /opt/personal-hub /etc/personal-hub /var/cache/personal-hub/chapters /data/personal-hub
sudo chown -R deploy:deploy /opt/personal-hub /etc/personal-hub /var/cache/personal-hub /data/personal-hub
```

### 6.2 安装基础软件

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget unzip nginx certbot python3-certbot-nginx

# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# pnpm + PM2
corepack enable
corepack prepare pnpm@10.28.2 --activate
sudo npm install -g pm2

# Docker（PostgreSQL + Redis）
sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker deploy
# 重新登录 deploy 用户使 docker 组生效
```

### 6.3 防火墙

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

### 6.4 拉取代码

```bash
su - deploy
cd /opt/personal-hub
git clone https://gitee.com/oralemon/personal-hub.git .
git checkout develop
pnpm install
```

### 6.5 配置环境变量

```bash
sudo nano /etc/personal-hub/.env
```

```env
# ── 应用 ──
NODE_ENV=production
API_PORT=3001

# ── PostgreSQL / Redis（与 docker-compose 一致）──
DATABASE_URL=postgresql://personal_hub:请替换强密码@127.0.0.1:5432/personal_hub
REDIS_URL=redis://127.0.0.1:6379

# ── 腾讯 COS ──
COS_SECRET_ID=你的SecretId
COS_SECRET_KEY=你的SecretKey
COS_BUCKET=your-bucket-1250000000
COS_REGION=ap-guangzhou
COS_PREFIX=booklets

# ── 缓存 ──
CACHE_REDIS_MAX_MB=512
CACHE_DISK_MAX_GB=10
CACHE_DISK_PATH=/var/cache/personal-hub/chapters

# ── JWT（个人期可简化）──
JWT_SECRET=请替换随机长字符串
```

```bash
sudo chmod 600 /etc/personal-hub/.env
sudo chown deploy:deploy /etc/personal-hub/.env
ln -sf /etc/personal-hub/.env /opt/personal-hub/.env
```

### 6.6 启动 PostgreSQL + Redis

在仓库根目录创建 `docker-compose.yml`（Phase 1 代码提交后）：

```bash
cd /opt/personal-hub
docker compose up -d postgres redis
docker compose ps
```

验证：

```bash
docker exec -it personal-hub-postgres-1 psql -U personal_hub -d personal_hub -c '\dt'
redis-cli ping
```

### 6.7 腾讯 COS 初始化与本地小册上传

**在腾讯云控制台：**

1. 创建存储桶（私有读写），记下 Bucket 名称与 Region。
2. 创建 CAM 子账号，授权 `QcloudCOSDataFullControl`（或最小读写策略），获取 SecretId/SecretKey。

**在本地开发机安装 coscli 并上传：**

```bash
# macOS 示例；Linux 见腾讯云文档
brew install coscli
coscli config init

# 首次全量上传（代码改造后使用 booklet:push；改造前可手动）
coscli sync ./content-local/booklets/ cos://your-bucket-1250000000/booklets/ -r
```

**改造后推荐：**

```bash
cd /path/to/personal-hub
pnpm booklet:push
curl -X POST https://yourdomain.com/api/admin/booklets/sync \
  -H "Authorization: Bearer <admin-token>"
```

### 6.8 构建并启动 API + 前端

> 依赖 Phase 1 `apps/api` 完成后执行。

```bash
cd /opt/personal-hub

# 数据库迁移
pnpm --filter api exec prisma migrate deploy

# 构建
pnpm --filter api build
pnpm build:react

# PM2 启动 API
pm2 start apps/api/ecosystem.config.js
pm2 save
pm2 startup
```

`apps/api/ecosystem.config.js`（计划新增）示例：

```javascript
module.exports = {
  apps: [
    {
      name: 'personal-hub-api',
      cwd: '/opt/personal-hub/apps/api',
      script: 'dist/main.js',
      env_file: '/etc/personal-hub/.env',
      instances: 1,
      max_memory_restart: '600M',
    },
  ],
};
```

前端为 Umi 静态构建产物：

```bash
ls apps/user-web/dist
```

### 6.9 Nginx 配置（静态前端 + API 反代）

```bash
sudo nano /etc/nginx/sites-available/personal-hub
```

```nginx
# 磁盘缓存区（可选，缓存单章 API）
proxy_cache_path /var/cache/nginx/personal-hub levels=1:2 keys_zone=booklet_cache:20m max_size=512m inactive=24h;

server {
    listen 80;
    server_name yourdomain.com;

    root /opt/personal-hub/apps/user-web/dist;
    index index.html;

    # 个人期：整站简单认证（可选）
    # auth_basic "Personal Hub";
    # auth_basic_user_file /etc/nginx/.htpasswd;

    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 仅对小册单章开启 nginx 缓存（列表不缓存）
        location ~ ^/api/contents/[^/]+/chapters/[^/]+$ {
            proxy_cache booklet_cache;
            proxy_cache_valid 200 1h;
            proxy_pass http://127.0.0.1:3001;
        }
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/javascript application/json;
}
```

```bash
sudo ln -sf /etc/nginx/sites-available/personal-hub /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d yourdomain.com
```

### 6.10 日常更新流程

**只更新代码：**

```bash
cd /opt/personal-hub
git pull
pnpm install
pnpm --filter api exec prisma migrate deploy
pnpm --filter api build
pnpm build:react
pm2 restart personal-hub-api
sudo nginx -t && sudo systemctl reload nginx
```

**只更新小册（本地改内容后）：**

```bash
# 本地
pnpm booklet:push

# 服务器：刷新 DB 索引
curl -X POST https://yourdomain.com/api/admin/booklets/sync -H "Authorization: Bearer ..."
# 按需清理旧缓存
redis-cli FLUSHDB
rm -rf /var/cache/personal-hub/chapters/*
```

### 6.11 验证清单

- [ ] `curl -I https://yourdomain.com` → 200
- [ ] `curl https://yourdomain.com/api/contents?type=booklet` → 小册列表，无 body
- [ ] `curl https://yourdomain.com/api/contents/{id}/chapters` → 章节索引，无 body
- [ ] `curl https://yourdomain.com/api/contents/{id}/chapters/{chapterId}` → 单章含 body
- [ ] 浏览器打开 `/content/booklets/{id}/chapters/{chapterId}`，切换章节响应 < 1s（热缓存命中）
- [ ] `pm2 logs personal-hub-api` 无 COS 认证错误
- [ ] 磁盘 `du -sh /var/cache/personal-hub` 不超过配置上限

---

## 7. 实施顺序建议

```mermaid
flowchart LR
    A0["阶段 A<br/>dev + rsync + :8000"] --> A1["远程阅读验收"]
    A1 --> B0["Phase 0<br/>COS + 类型"]
    B0 --> B1["Phase 1<br/>NestJS API"]
    B1 --> B2["Phase 2<br/>build + Nginx"]
```

| 顺序     | 内容                                         | 何时做                        |
| -------- | -------------------------------------------- | ----------------------------- |
| **现在** | 阶段 A：§A 部署步骤，dev + 直连 8000         | 立刻，零代码改造              |
| 以后 1   | Phase 0：COS SDK + `booklet:push` + 类型拆分 | 小册改走 COS、或要上 build 前 |
| 以后 2   | Phase 1：NestJS 小册 API + Redis/磁盘缓存    | 需要 build / 对外发布前       |
| 以后 3   | Phase 2：react-web 生产构建 + Nginx + HTTPS  | 正式生产                      |
| 后续     | next-web、完整 RBAC                          | 长期路线                      |

---

## 8. 风险与取舍

| 风险                    | 缓解                                             |
| ----------------------- | ------------------------------------------------ |
| 阶段 A dev 占内存       | 2C4G 可跑；PM2 内存上限；仅个人访问              |
| 8000 端口暴露           | 安全组仅你的 IP，或 SSH 隧道、不开放公网         |
| 阶段 B：2C4G 内存紧张   | API 单实例；Redis 512MB                          |
| 阶段 B：60GB 盘不够缓存 | 磁盘缓存上限 10GB + LRU；正文在 COS              |
| mock 与 API 双轨        | 阶段 A 用 mock；阶段 B 切 API；契约对齐 `api.md` |

---

## 9. 相关文档

- [deployment-plan.md](./deployment-plan.md) — 完整部署总览（Gitee、目录、NestJS 演进）
- [pm2-deployment.md](./pm2-deployment.md) — **PM2 部署权威**（阶段 A 命令与排障）
- [deployment.md](./deployment.md) — 长期 Docker / CI/CD
- [server-deployment-guide.md](./server-deployment-guide.md) — 一页速查
- [../../backend/canonical-api.md](../../backend/canonical-api.md) — Canonical API 契约
- [../../backend/canonical-data-model.md](../../backend/canonical-data-model.md) — 内容与章节数据模型
- [../../prd/react-first/phase-5-5-next-api-bridge-prd.md](../../prd/react-first/phase-5-5-next-api-bridge-prd.md) — 本文选择直接最小 NestJS，跳过 Next API Bridge
- [../../foundation/architecture.md](../../foundation/architecture.md) — 多应用架构总览
- [../../README.md](../../README.md) — docs 目录放置规范
