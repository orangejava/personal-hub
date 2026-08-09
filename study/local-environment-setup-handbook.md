# 本地开发环境准备手册

> 适用对象：macOS 上准备开始这个项目的前端开发者。
> 目标：用一份文档完成环境校验、工具安装、安装成功验证，以及 Docker / PostgreSQL / Redis 的基础使用入门。
> 最后更新：2026-06-02

---

## 1. 先做统一校验

不要先急着安装。先统一跑一遍下面这些命令，确认你本机已经有什么、缺什么、哪里异常。

```bash
node -v
pnpm -v
git --version
brew --version
docker --version
docker compose version
docker info
psql --version
redis-cli --version
code --version
```

### 结果怎么判断

| 命令 | 正常表现 | 异常表现 |
|---|---|---|
| `node -v` | 输出版本号 | `command not found` |
| `pnpm -v` | 输出版本号 | `command not found` |
| `git --version` | 输出版本号 | `command not found` |
| `brew --version` | 输出版本号 | `command not found` |
| `docker --version` | 输出版本号 | `command not found` |
| `docker compose version` | 输出版本号 | `docker: 'compose' is not a docker command` |
| `docker info` | 输出 Client / Server 信息 | `Cannot connect to the Docker daemon` |
| `psql --version` | 输出版本号 | `command not found` |
| `redis-cli --version` | 输出版本号 | `command not found` |
| `code --version` | 输出版本号 | `command not found` |

---

## 2. 你当前机器的最新检查结果

这是基于 2026-06-02 这一轮重新检查得到的结果：

| 工具 | 当前状态 | 说明 |
|---|---|---|
| Node.js | 已安装 | `v20.20.0` |
| pnpm | 已安装 | `10.28.2` |
| Git | 已安装 | 可用 |
| Homebrew | 已安装 | `5.1.14` |
| Docker CLI | 已安装 | `Docker version 20.10.10` |
| Docker Compose | 已安装 | `Docker Compose version v5.1.4` |
| PostgreSQL CLI (`psql`) | 已安装 | `PostgreSQL 18.4` |
| Redis CLI (`redis-cli`) | 已安装 | `redis-cli 8.8.0` |
| VS Code CLI (`code`) | 未安装 | 可选，建议补 |

### 当前最优先处理项

优先级建议：

1. 确认 Docker Desktop 在你本机图形界面中确实正常运行
2. 安装 PostgreSQL GUI
3. 安装 Redis GUI
4. 安装 VS Code CLI

原因：

- 这个项目默认通过 Docker 跑 PostgreSQL 和 Redis
- 你已经补齐了 `psql` 和 `redis-cli`
- `docker info` 在当前受限执行环境中可能会因为 Docker socket 权限限制而失败，不能仅凭这条命令就断定你本机 Docker Desktop 一定异常

### 关于 `docker info` 的说明

这次检查里：

- `docker --version` 正常
- `docker compose version` 正常
- `docker info` 返回的是当前执行环境对 Docker socket 的 `permission denied`

这更像是“当前检查环境访问受限”，而不是“你本机一定没装好 Docker”。  
所以 Docker 是否真正正常，建议你在自己终端里再次手动执行：

```bash
docker info
docker ps
```

如果这两条在你本地终端里能正常输出，就说明 Docker Desktop 基本可用。

---

## 3. 所需工具总表

| 工具 | 作用 | 是否必须 | 官方地址 |
|---|---|---|---|
| Homebrew | macOS 包管理器 | 必须 | [brew.sh](https://brew.sh/) |
| Node.js | Web / API 运行时 | 必须 | [nodejs.org](https://nodejs.org/) |
| pnpm | 包管理器 | 必须 | [pnpm.io](https://pnpm.io/) |
| Git | 版本管理 | 必须 | [git-scm.com](https://git-scm.com/) |
| Docker Desktop | 容器运行环境 | 必须 | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop) |
| PostgreSQL CLI (`psql`) | 数据库命令行 | 必须 | [postgresql.org/download/macosx](https://www.postgresql.org/download/macosx/) |
| Redis CLI (`redis-cli`) | Redis 命令行 | 必须 | [redis.io/docs/latest/operate/oss_and_stack/install/install-stack/macos/](https://redis.io/docs/latest/operate/oss_and_stack/install/install-stack/macos/) |
| TablePlus / pgAdmin 4 | PostgreSQL 图形工具 | 强烈建议 | [tableplus.com](https://tableplus.com/) / [pgadmin.org](https://www.pgadmin.org/) |
| RedisInsight | Redis 图形工具 | 强烈建议 | [redis.io/insight](https://redis.io/insight/) |
| VS Code | 编辑器 | 强烈建议 | [code.visualstudio.com](https://code.visualstudio.com/) |
| `lazydocker` | Docker TUI | 可选 | [github.com/jesseduffield/lazydocker](https://github.com/jesseduffield/lazydocker) |
| `jq` | JSON 处理 | 可选 | [jqlang.org](https://jqlang.org/) |
| `httpie` | 接口调试 | 可选 | [httpie.io](https://httpie.io/) |

---

## 4. Homebrew

### 4.1 作用

Homebrew 是 macOS 上最常用的包管理器。  
你后面大部分 CLI 和 GUI 工具都可以通过它安装和升级。

### 4.2 安装命令

如果本机还没有 Homebrew：

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 4.3 安装成功校验

```bash
brew --version
which brew
```

### 4.4 你当前机器状态

你本机已安装：

- `Homebrew 5.1.14`

### 4.5 常用命令

```bash
brew install <formula>
brew install --cask <cask-name>
brew upgrade
brew uninstall <formula>
brew uninstall --cask <cask-name>
brew list
brew cleanup
```

---

## 5. Node.js

### 5.1 作用

这个项目的前端 `Next.js` 和后端 `NestJS` 都运行在 Node.js 上。

### 5.2 安装方式

如果本机还没装 Node.js，推荐使用 `nvm` 管理版本。  
如果你当前已经通过 `nvm` 装好了，就可以继续沿用。

如果你要补装 `nvm`，可参考：

```bash
brew install nvm
mkdir ~/.nvm
```

安装 Node.js 20：

```bash
nvm install 20
nvm use 20
```

### 5.3 安装成功校验

```bash
node -v
which node
```

### 5.4 你当前机器状态

你本机已安装：

- `Node.js v20.20.0`

### 5.5 基础使用

```bash
node -v
npm -v
```

你后面主要不会直接用 `node` 裸跑业务，而是通过：

- `pnpm dev`
- `pnpm build`
- `pnpm test`

---

## 6. pnpm

### 6.1 作用

`pnpm` 是这个项目的包管理器，用来安装依赖、运行脚本、管理 Monorepo。

### 6.2 安装命令

如果本机未安装：

```bash
npm install -g pnpm
```

或者：

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

### 6.3 安装成功校验

```bash
pnpm -v
which pnpm
```

### 6.4 你当前机器状态

你本机已安装：

- `pnpm 10.28.2`

### 6.5 基础使用

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
pnpm lint
```

Monorepo 常用：

```bash
pnpm dev:react
pnpm --filter server dev
```

---

## 7. Git

### 7.1 作用

代码版本管理。

### 7.2 安装命令

如果本机未安装：

```bash
brew install git
```

### 7.3 安装成功校验

```bash
git --version
which git
```

### 7.4 你当前机器状态

你本机已安装：

- `git version 2.50.1`

### 7.5 基础使用

```bash
git status
git diff
git add .
git commit -m "message"
```

---

## 8. Docker Desktop

### 8.1 作用

Docker Desktop 是这个项目的环境底座。

你后面会用它来：

- 跑 PostgreSQL
- 跑 Redis
- 以后跑生产容器

### 8.2 官方地址

- [Docker Desktop](https://www.docker.com/products/docker-desktop)

### 8.3 安装方式 A：GUI 安装

步骤：

1. 打开 [Docker Desktop 官方页面](https://www.docker.com/products/docker-desktop)
2. 下载适用于 Apple Silicon 的 macOS 版本
3. 双击 `Docker.dmg`
4. 把 `Docker.app` 拖进 `Applications`
5. 打开 `Applications/Docker.app`
6. 按提示完成首次初始化
7. 等菜单栏 Docker 图标变为正常运行状态

### 8.4 安装方式 B：Homebrew 安装

```bash
brew install --cask docker-desktop
```

安装完成后仍然需要：

1. 打开 `Applications/Docker.app`
2. 完成图形界面的首次授权和初始化

### 8.5 安装成功校验

```bash
docker --version
docker compose version
docker info
```

通过标准：

- `docker --version` 输出版本
- `docker compose version` 输出版本
- `docker info` 不再报 `Cannot connect to the Docker daemon`

### 8.6 你当前机器状态

这一轮检查结果是：

- `docker --version` 正常
- `docker compose version` 正常
- `docker info` 在当前执行环境里因 Docker socket 权限限制而失败

所以目前更准确的判断是：

- Docker CLI 和 Compose 已安装
- 是否能正常访问 Docker daemon，需要你在本机终端中再执行一次 `docker info` / `docker ps` 做最终确认

### 8.7 针对你当前机器的修复步骤

按这个顺序做：

1. 先在你自己的终端中执行：

```bash
docker info
docker ps
```

2. 如果这两条能正常输出，说明 Docker Desktop 基本可用，可继续后续开发
3. 如果这两条在你本机终端里也失败，再检查：

- Docker Desktop 是否已启动
- 菜单栏 Docker 图标是否显示 Running
- 是否刚安装完还未完成初始化

4. 若仍失败，再看：

```bash
ls -la ~/.docker/cli-plugins
```

5. 如果插件异常明显，再考虑重装 Docker Desktop：

```bash
brew install --cask docker-desktop
```

如果有失效插件，不要先删，优先重装 Docker Desktop 后再试。

### 8.8 Docker 基础使用手册

#### 查看 Docker 是否在运行

```bash
docker info
```

#### 查看当前容器

```bash
docker ps
docker ps -a
```

- `docker ps`：只看正在运行的容器
- `docker ps -a`：看所有容器，包括已停止的

#### 查看镜像

```bash
docker images
```

#### 查看日志

```bash
docker logs <container_id_or_name>
```

持续跟踪日志：

```bash
docker logs -f <container_id_or_name>
```

#### 停止容器

```bash
docker stop <container_id_or_name>
```

#### 删除容器

```bash
docker rm <container_id_or_name>
```

#### 删除镜像

```bash
docker rmi <image_id_or_name>
```

#### 试运行一个容器

```bash
docker run hello-world
```

这条命令非常适合做第一次自测。

### 8.9 Docker Compose 基础使用手册

这个项目后面主要用的是 `docker compose`，不是单独的 `docker run`。

#### 启动服务

```bash
docker compose -f compose.dev.yml up -d
```

解释：

- `-f compose.dev.yml`：指定配置文件
- `up`：启动服务
- `-d`：后台运行

#### 查看服务状态

```bash
docker compose -f compose.dev.yml ps
```

#### 查看日志

```bash
docker compose -f compose.dev.yml logs
```

持续跟踪日志：

```bash
docker compose -f compose.dev.yml logs -f
```

#### 停止并移除服务

```bash
docker compose -f compose.dev.yml down
```

#### 重新构建并启动

```bash
docker compose -f compose.dev.yml up -d --build
```

### 8.10 Docker Desktop 图形界面怎么用

打开 Docker Desktop 后，你主要看这几个区域：

1. `Containers`
   - 查看当前运行中的容器
   - 可以点进去看日志、环境变量、端口
2. `Images`
   - 查看本地镜像
3. `Volumes`
   - 查看持久化数据卷
4. `Settings`
   - 可以调 CPU、内存、磁盘资源

如果你不喜欢纯命令行，Docker Desktop 本身就是很重要的 GUI。

### 8.11 常见问题

#### 问题 1：`docker info` 提示无法连接 daemon

说明 Docker Desktop 没启动好。

#### 问题 2：`docker compose` 不可用

通常是 Docker Desktop 安装不完整或 Compose 插件损坏。

#### 问题 3：容器起来了但端口访问不到

先看：

```bash
docker compose -f compose.dev.yml ps
docker compose -f compose.dev.yml logs
```

---

## 9. PostgreSQL CLI (`psql`)

### 9.1 作用

`psql` 是 PostgreSQL 的命令行客户端。  
即使后面你主要用 GUI，也非常建议装，因为它特别适合排查和验证。

### 9.2 官方地址

- [PostgreSQL macOS 下载页](https://www.postgresql.org/download/macosx/)

### 9.3 安装方式 A：只装 CLI，最轻量

```bash
brew install libpq
brew link --force libpq
```

如果 `link` 有问题，也可以补 PATH：

```bash
echo 'export PATH="/opt/homebrew/opt/libpq/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### 9.4 安装方式 B：安装完整 PostgreSQL

```bash
brew install postgresql@17
```

### 9.5 安装成功校验

```bash
psql --version
which psql
```

### 9.6 你当前机器状态

你本机当前：

- `psql (PostgreSQL) 18.4`

说明 `psql` 已安装成功。

### 9.7 `psql` 基础使用手册

#### 连接数据库

```bash
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres
```

解释：

- `-h`：主机
- `-p`：端口
- `-U`：用户名
- `-d`：数据库名

#### 进入后常用命令

```sql
\l
\c postgres
\dt
\d table_name
SELECT version();
SELECT now();
```

解释：

- `\l`：列出数据库
- `\c postgres`：切换数据库
- `\dt`：列出当前库的表
- `\d table_name`：看某张表结构

退出：

```sql
\q
```

#### 创建数据库

```sql
CREATE DATABASE personal_hub;
```

#### 删除数据库

```sql
DROP DATABASE personal_hub;
```

> 删除是危险操作，确认后再执行。

### 9.8 PostgreSQL GUI 工具

你可以二选一：

#### 方案 A：TablePlus

官网：

- [TablePlus](https://tableplus.com/)

安装：

```bash
brew install --cask tableplus
```

安装成功校验：

- Launchpad 能看到 `TablePlus`
- 或者 `Applications` 目录里能看到 `TablePlus.app`

怎么用：

1. 打开 TablePlus
2. 新建 PostgreSQL 连接
3. Host：`127.0.0.1`
4. Port：`5432`
5. User：`postgres`
6. Password：`postgres`
7. Database：`postgres`
8. 点击 Test
9. 点击 Connect

#### 方案 B：pgAdmin 4

官网：

- [pgAdmin 4](https://www.pgadmin.org/)

安装：

```bash
brew install --cask pgadmin4
```

安装成功校验：

- Launchpad 能看到 `pgAdmin 4`
- 或者 `Applications` 目录里能看到 `pgAdmin 4.app`

怎么用：

1. 打开 pgAdmin 4
2. 新建 Server
3. Name 随便填，比如 `local-postgres`
4. Host：`127.0.0.1`
5. Port：`5432`
6. Username：`postgres`
7. Password：`postgres`
8. 保存连接

### 9.9 PostgreSQL 在这个项目里的实际用法

后面你主要会做这些事：

1. 让 Docker 启动 PostgreSQL
2. 用 `psql` 或 TablePlus 连进去
3. 用 Prisma migration 建表
4. 查表、看数据、排查连接问题

---

## 10. Redis CLI (`redis-cli`)

### 10.1 作用

`redis-cli` 是 Redis 的命令行客户端。  
它特别适合测试 Redis 是否通、Key 是否存在、TTL 是否正常。

### 10.2 官方地址

- [Redis macOS 安装文档](https://redis.io/docs/latest/operate/oss_and_stack/install/install-stack/macos/)

### 10.3 安装命令

```bash
brew install redis
```

### 10.4 安装成功校验

```bash
redis-cli --version
which redis-cli
```

### 10.5 你当前机器状态

你本机当前：

- `redis-cli 8.8.0`

说明 `redis-cli` 已安装成功。

### 10.6 Redis 基础使用手册

#### 如果本机临时启动 Redis

前台启动：

```bash
redis-server
```

后台服务方式：

```bash
brew services start redis
brew services list
brew services stop redis
```

> 当前项目更推荐 Docker 跑 Redis，本机服务只适合临时练习。

#### 连接 Redis

```bash
redis-cli
```

或者指定主机端口：

```bash
redis-cli -h 127.0.0.1 -p 6379
```

#### 进入后常用命令

```bash
PING
SET name personal-hub
GET name
TTL name
DEL name
KEYS *
```

解释：

- `PING`：测试连接
- `SET/GET`：写入和读取 key
- `TTL`：看过期时间
- `DEL`：删除 key
- `KEYS *`：列全部 key，开发环境可用，生产别乱用

#### 直接一条命令测试连接

```bash
redis-cli ping
```

返回 `PONG` 说明正常。

### 10.7 Redis GUI 工具：RedisInsight

官网：

- [RedisInsight](https://redis.io/insight/)

安装：

```bash
brew install --cask redis-insight
```

安装成功校验：

- Launchpad 能看到 `Redis Insight`
- 或者 `Applications` 目录里能看到 `Redis Insight.app`

怎么用：

1. 打开 RedisInsight
2. 新建 Redis 连接
3. Host：`127.0.0.1`
4. Port：`6379`
5. 无密码先留空
6. 保存并连接

连接后你可以：

- 看所有 key
- 看字符串、哈希等数据结构
- 看 TTL
- 手动删测试 key

### 10.8 Redis 在这个项目里的实际用法

后面它主要用于：

- 限流计数
- 缓存热点数据
- 辅助会话和 AI 临时上下文

---

## 11. VS Code CLI

### 11.1 作用

让你可以从终端直接打开项目和文件。

### 11.2 官方地址

- [Visual Studio Code](https://code.visualstudio.com/)

### 11.3 安装命令

```bash
brew install --cask visual-studio-code
```

### 11.4 安装成功校验

```bash
code --version
which code
```

### 11.5 如果 `code` 命令还不可用

在 VS Code 里执行：

1. `Cmd + Shift + P`
2. 输入 `Shell Command: Install 'code' command in PATH`
3. 回车执行

### 11.6 基础使用

```bash
code .
code study/local-environment-setup-handbook.md
```

---

## 12. 可选辅助工具

### 12.1 `lazydocker`

安装：

```bash
brew install lazydocker
```

校验：

```bash
lazydocker --version
```

用途：

- 用 TUI 看容器、日志、镜像

### 12.2 `jq`

安装：

```bash
brew install jq
```

校验：

```bash
jq --version
```

用途：

- 格式化 JSON

### 12.3 `httpie`

安装：

```bash
brew install httpie
```

校验：

```bash
http --version
```

用途：

- 调试 HTTP 接口，比 `curl` 好读

---

## 13. 一份可以直接照抄执行的安装清单

如果你想直接照着执行，按这个顺序来：

```bash
# 1. Docker Desktop
brew install --cask docker-desktop

# 2. PostgreSQL CLI
brew install libpq
brew link --force libpq

# 3. Redis CLI
brew install redis

# 4. PostgreSQL GUI 二选一
brew install --cask tableplus
# 或
brew install --cask pgadmin4

# 5. Redis GUI
brew install --cask redis-insight

# 6. VS Code
brew install --cask visual-studio-code

# 7. 可选辅助工具
brew install lazydocker jq httpie
```

---

## 14. 全部装完后的统一验收

执行：

```bash
node -v
pnpm -v
git --version
brew --version
docker --version
docker compose version
docker info
psql --version
redis-cli --version
code --version
```

如果这些都正常，再进入项目开发阶段。

---

## 15. 你下一步应该怎么做

最稳妥顺序：

1. 先处理 Docker Desktop
2. 再安装 `psql`
3. 再安装 `redis-cli`
4. 然后装一个 PostgreSQL GUI 和一个 Redis GUI
5. 最后做一次统一验收

> 只要你按这份文档顺着做，后面进入 `Phase 0` 时，环境层面的不确定性会少很多。
