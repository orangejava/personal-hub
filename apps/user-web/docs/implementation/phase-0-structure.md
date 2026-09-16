# React-first 阶段 0：工程骨架与目录梳理

> 状态：✅ 已完成
> 最后更新：2026-06-27
> 对应 PRD：[../../prd/react-first/phase-0-3-foundation-prd.md](../../prd/react-first/phase-0-3-foundation-prd.md) 阶段 0

## 1. 交付内容

- 根目录 Monorepo：`package.json`、`pnpm-workspace.yaml`、`turbo.json`、`tsconfig.base.json`、`.editorconfig`、`.prettierrc`、`.nvmrc`（Node 22）、`.gitignore`。
- `apps/user-web`：完整克隆 `ant-design/ant-design-pro` v6.0.2 后改造（删 `.git`、包名改为 `user-web`、接入 workspace、加 `@personal-hub/shared-types` 依赖与 Markdown 编辑/渲染依赖、加 `sync:booklets` 脚本）。
- `packages/shared-types`：首批类型（`ApiResponse`、分页、`User`/`UserRole`、`PermissionCode`/`MenuItem`、`Auth`、`Content*`、`Booklet*`、`Workspace*`、`System*`）。
- `content-local/booklets/react-basic`：极简示例小册（`meta.json` + 3 个 `.md`）。
- 目录级规范：`apps/user-web/AGENT.md` + `.agent/` 分模块细则；`packages/shared-types/AGENT.md`。

## 2. Ant Design Pro v6 关键事实（与原 PRD 假设的差异）

| 项 | PRD 假设 | 实际模板 |
|---|---|---|
| 框架 | Umi | `@umijs/max` v4.6.68（Umi Max） |
| React | — | React 19 |
| antd | v5 | antd v6 |
| pro-components | v2 | v3 |
| Lint | — | Biome（非 ESLint） |
| AI 组件 | 后续装 `@ant-design/x` | 模板已自带 `@ant-design/x` v2.8 |
| 打包 | webpack | utoo/pack |
| Node | — | `>=22`（本机用 nvm 22.22.0） |

> 结论：阶段 1 起的改造按实际模板能力进行；`@ant-design/x` 已可用，AI 阶段无需额外安装。

## 3. clone 后关键文件职责

| 文件 / 目录 | 职责 | 阶段 1 处理 |
|---|---|---|
| `config/config.ts` | Umi 运行时与插件配置（路由、布局、主题、mock、request、access、reactQuery、openapi、tailwindcss） | 改路由/标题/移除 GA 与 openapi 占位 |
| `config/routes.ts` | 路由表（模板示例页） | 替换为 public/workspace/admin 路由 |
| `config/defaultSettings.ts` | ProLayout 默认设置（标题、主色、布局） | 改标题/品牌色 |
| `src/app.tsx` | `getInitialState`、`layout`、`request`、`rootContainer` | 改造成 personal-hub 登录态与布局 |
| `src/access.ts` | 权限判断（模板仅 `canAdmin`） | 扩展为 `PermissionCode` 体系 |
| `src/global.less` | 全局样式（含 AlibabaSans 字体） | 改为 `@import src/styles/*` 入口 |
| `src/components` | 模板组件（AvatarDropdown、Footer、ErrorBoundary 等） | 保留可用部分，清理模板专属 |
| `src/pages` | 模板示例页（dashboard/form/list/profile/account/chatbot/user） | 清理示例，新增 public/workspace/admin |
| `src/services` | 模板 openapi 生成的 service | 按模块重建 |
| `mock/` | 模板 mock（user/route/notices/fakeList/listTableList） | 按模块重建 |
| `cloudflare-worker/` | 模板演示用 worker（带 48 个 tsc 错误） | 阶段 1 清理删除 |

## 4. 验收结果

- ✅ `pnpm install` 成功（Node 22，1m3s）。
- ✅ `pnpm dev:react` 成功启动，`http://localhost:8000` 返回 HTTP 200。
- ✅ `apps/user-web` 能 import `@personal-hub/shared-types`（探针文件 `src/sharedTypesProbe.ts` tsc 无解析错误）。
- ✅ `packages/shared-types` typecheck 通过。
- ⚠️ 模板自带 48 个 tsc 错误，全部来自 `cloudflare-worker/` 与 `src/pages/dashboard/monitor/components/Map`（d3/topojson），阶段 1 清理示例页时一并移除。

## 5. 启动方式

```bash
nvm use 22
pnpm install
pnpm dev:react   # http://localhost:8000
```

> 注：模板 `dev` 脚本带 `MOCK=none`，阶段 1 改造时需调整以启用 Umi mock。
