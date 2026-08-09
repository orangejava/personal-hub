# Monorepo + Docker 学习手册

> 面向第一次自己搭多工程仓库和本地基础设施的开发者。
> 最后更新：2026-06-01

---

## 1. 先把这三个东西分别当成什么

### pnpm workspace

它负责：

- 在一个仓库里管理多个包
- 统一安装依赖
- 建立包之间的引用关系

### Turborepo

它负责：

- 统一跑 `dev/build/lint/test`
- 管理任务依赖
- 缓存结果

### Docker Compose

它负责：

- 一次起多个本地服务
- 让 PostgreSQL、Redis 这类依赖稳定可复用

---

## 2. 当前项目为什么必须这样组织

这个项目不是单一前端仓库，而是至少包含：

- `apps/react-web`
- `apps/server`
- `packages/shared-types`

未来还会有：

- `apps/mobile`

如果不用 Monorepo，前后端和共享类型会越来越分裂。

---

## 3. 你先只学这 5 件事

1. `pnpm-workspace.yaml` 怎么声明工作区
2. 根 `package.json` 和子项目 `package.json` 的关系
3. `turbo.json` 如何组织任务
4. Docker Compose 怎么起 PostgreSQL + Redis
5. 端口、volume、容器名这些基础概念

---

## 4. 当前项目建议的目录结构

```text
personal-hub/
├── apps/
│   ├── react-web/
│   ├── server/
│   └── mobile/      # 后置
├── packages/
│   └── shared-types/
├── docs/
├── study/
└── docker / ci / scripts
```

---

## 5. 最小初始化顺序

### Step 1：初始化根目录

```bash
pnpm init
pnpm add -D turbo typescript eslint prettier @types/node
```

### Step 2：声明工作区

至少包含：

- `apps/*`
- `packages/*`

### Step 3：初始化 `apps/react-web`

```bash
# 当前仓库已使用 Umi + Ant Design Pro 创建 apps/react-web；
# 后续 Next.js 公开前台位于 apps/next-web。
```

### Step 4：初始化 `apps/server`

```bash
# 当前仓库已完成 Nest + Express 阶段 0；新领域模块在 apps/server 内扩展。
```

### Step 5：初始化共享包

```bash
mkdir -p packages/shared-types/src
```

### Step 6：启动本地服务

```bash
docker compose -f compose.dev.yml up -d
```

---

## 6. 你要怎么理解 Docker Compose

对当前项目来说，它最重要的作用不是“部署”，而是：

- 让本地 PostgreSQL 稳定可用
- 让本地 Redis 稳定可用
- 降低环境差异

你现在阶段只需要先理解：

- image
- container
- port
- volume
- environment

---

## 7. 常用命令

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm test
```

```bash
docker compose -f compose.dev.yml up -d
docker compose -f compose.dev.yml ps
docker compose -f compose.dev.yml logs
docker compose -f compose.dev.yml down
```

---

## 8. 当前项目里最常见的几个坑

### 坑 1：根目录和子项目依赖装混

判断标准：

- 整个仓库通用的工具，装在根目录
- 某个应用专用依赖，装在对应子项目

### 坑 2：把共享类型直接复制来复制去

应该放进 `packages/shared-types`，避免前后端类型分叉。

### 坑 3：数据库和 Redis 手工装在本机环境里

短期看省事，长期最容易出现环境漂移。

### 坑 4：不看容器日志，只盯着前端报错

有时候问题根源其实是：

- 数据库没起来
- Redis 没起来
- 端口冲突
- 环境变量没读到

---

## 9. 当前阶段最小实践任务

1. 跑通 `apps/react-web`
2. 跑通 `apps/server`
3. 跑通 PostgreSQL 容器
4. 跑通 Redis 容器
5. 让根目录一个命令能同时启动 Web 和 API

---

## 10. 学完后至少要达到什么标准

1. 能解释为什么这个项目要用 Monorepo
2. 能看懂根目录和子项目的职责边界
3. 能启动和关闭本地基础设施
4. 能排查端口、容器、依赖安装问题
5. 能知道什么时候该改 `apps/*`，什么时候该改 `packages/*`

---

## 11. 遇到问题先怎么排查

1. 先看依赖是否装在正确位置
2. 再看 `pnpm-workspace.yaml` 是否包含对应目录
3. 再看 `docker compose ps` 是否真的启动成功
4. 再看端口是否冲突
5. 再看环境变量和容器日志

> 你对工程化能力的成长，很多时候不是来自业务代码，而是来自你能不能稳定地把一整套开发环境跑起来。
