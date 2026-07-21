# React-first 工程初始化 PRD

> 状态：规划中
> 最后更新：2026-06-27
> 优先级：P0
> 目标：在当前仓库中先建立 React-first Monorepo 工程骨架，为后续快速完成功能页面、mock 数据和 NestJS 接入打基础。

---

## 1. 背景

当前项目原长期规划为 Next.js 15 + NestJS + PostgreSQL + Redis + Turborepo。现在新增实施策略：

- 首版前端先使用 React + Umi + Ant Design Pro 快速完成。
- 后端目标仍为 NestJS + PostgreSQL + Redis。
- 工程仍使用 pnpm + Turborepo。
- 后续将部分公开页面抽到 Next.js 15 重写。

本 PRD 只描述 React-first 工程初始化，不改变已有产品功能范围。

---

## 2. 初始化范围

### 2.1 必须完成

- 根目录 Monorepo 配置。
- `apps/react-web` 创建。
- 完整克隆 Ant Design Pro 后改造。
- `packages/shared-types` 创建。
- React 工程接入共享类型。
- mock 数据基础目录。
- React 工程目录级 `AGENT.md`。

### 2.2 暂不完成

- 不创建完整 NestJS API。
- 不创建 PostgreSQL / Redis 本地服务。
- 不接真实 AI 厂商 API。
- 不创建 Next.js 应用。
- 不实现完整业务页面。

---

## 3. 目标目录

```txt
personal-hub/
├── apps/
│   └── react-web/
├── packages/
│   └── shared-types/
├── docs/
├── study/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

---

## 4. 初始化步骤

### Step 1：根目录 Monorepo

创建：

- `package.json`
- `pnpm-workspace.yaml`
- `turbo.json`
- `tsconfig.base.json`
- `.editorconfig`
- `.prettierrc`

建议脚本：

```json
{
  "scripts": {
    "dev": "turbo dev",
    "dev:react": "pnpm --filter react-web dev",
    "build": "turbo build",
    "build:react": "pnpm --filter react-web build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "format": "prettier --write ."
  }
}
```

### Step 2：创建 `apps/react-web`

执行：

```bash
git clone --depth=1 https://github.com/ant-design/ant-design-pro.git apps/react-web
```

克隆后处理：

- 删除 `apps/react-web/.git`。
- 修改包名为 `react-web`。
- 保留 Ant Design Pro 基础能力。
- 清理与 personal-hub 无关的示例页面。
- 接入 workspace 依赖。

### Step 3：创建 `packages/shared-types`

首批文件：

```txt
packages/shared-types/src/
├── index.ts
├── common.ts
├── auth.ts
├── user.ts
├── permission.ts
├── content.ts
├── ai.ts
├── system.ts
└── pagination.ts
```

首批内容：

- `ApiResponse<T>`
- `PaginationQuery`
- `PaginationResult<T>`
- 内容类型枚举。
- 内容状态枚举。
- 可见性枚举。
- 权限点类型。
- AI 工具类型。
- 系统主题配置类型。

### Step 4：建立 mock 基础

在 `apps/react-web` 中保留或创建：

```txt
mock/
├── auth.ts
├── system.ts
├── content.ts
├── workspace.ts
├── admin.ts
├── ai.ts
└── data/
```

要求：

- mock 响应使用统一 `ApiResponse<T>`。
- mock 数据覆盖 admin / editor / member。
- mock 接口路径尽量贴近未来 NestJS API。

### Step 5：创建目录级规范

创建：

- `apps/react-web/AGENT.md`
- `packages/shared-types/AGENT.md`

核心约定：

- 页面不能直接写死大段 mock 数据。
- 共享业务类型优先进入 `packages/shared-types`。
- React-first 不推翻后续 Next.js 和 NestJS 规划。
- 公开前台组件尽量降低 Umi 绑定，方便后续迁移。

---

## 5. 验收标准

- [ ] `pnpm install` 成功。
- [ ] `pnpm dev:react` 成功启动。
- [ ] `apps/react-web` 页面可打开。
- [ ] `apps/react-web` 能引用 `packages/shared-types`。
- [ ] mock 登录能返回当前用户。
- [ ] 文档中能找到 React-first 路线入口。

---

## 6. 后续衔接

初始化完成后，进入：

1. 主题、布局、权限、mock 底座。
2. 公开前台与内容阅读。
3. 工作区与内容生产。
4. 后台运营台。
5. AI 工具平台。
6. NestJS API 接入。
7. Next.js 公开页面抽离。

详细见 [../react-first/roadmap.md](../react-first/roadmap.md)。

