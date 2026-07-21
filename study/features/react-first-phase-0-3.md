# React-first 阶段 0–3 开发复盘

> 适用于回顾「Ant Design Pro 工程从 0 到内容阅读 + 工作区 mock 闭环」的完整路径。

## 场景背景

personal-hub 采用 React-first：先用 Umi Max + Ant Design Pro 在 mock 下跑通公开前台、内容阅读与工作区生产，再逐步接 NestJS / Next.js。阶段 0–3 是一次性交付骨架、底座、阅读与工作区。

## 核心概念

### 1. 权限放在哪？

**标准答案：`@@initialState` + `access.ts`，不需要为了 Pro 再建 `auth.ts`。**

- `getInitialState` 拉用户与菜单 → 写入 `initialState`
- `access.ts` 读 `permissions` 生成 `canWorkspace` 等
- 路由 `access: 'canWorkspace'` 拦截 member

若只有「登出、刷新权限」等动作需要复用，再抽 `models/auth.ts` 作薄封装即可。

### 2. 公开区 vs 工作区主题

两套状态互不干扰：

```
publicSettings  → PublicLayout ConfigProvider
settings        → ProLayout SettingDrawer
```

公开区用精简 `PublicThemeDrawer`（风格 + 主色）；工作区用 Pro 自带 `SettingDrawer`。

### 3. 菜单 i18n

mock 菜单 `name` 存 **locale id**（如 `workspace.dashboard`），在 `menuDataRender` 里 `getIntl().formatMessage({ id: 'menu.' + name })`。

注意：父路径不要用 `/workspace` 这种会被所有子路由前缀匹配的路径做叶子菜单 path。

### 4. 目录滚动高亮

```ts
const observer = new IntersectionObserver(entries => {
  const visible = entries.filter(e => e.isIntersecting)
    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
  if (visible[0]?.target.id) setActiveAnchor(visible[0].target.id);
}, { rootMargin: '-72px 0px -55% 0px' });
```

标题 `id` 必须与目录 `anchor` 一致（`MarkdownViewer` 的 `h2`/`h3`）。

### 5. 文档预览选型（阶段 4）

| 格式 | 推荐 | 说明 |
|---|---|---|
| PDF | react-pdf | 基于 PDF.js，React 生态最常用 |
| Word | docx-preview | 浏览器端 docx → HTML |
| 富文本 | Textbus | 产品文档已定 |

配置集中在 `apps/react-web/src/config/documentViewers.ts`。

## 实现步骤（推荐顺序）

1. Monorepo + clone Pro → 改路由、清模板页
2. `getInitialState` + mock 登录 + `access.ts`
3. `PublicLayout` + 公开页 + `services` + mock 分层
4. `MarkdownViewer` / `TocPanel` / 小册阅读
5. 工作区 ProTable + Markdown 编辑 + `sync-local-booklets`
6. 补强：菜单 path、主题分离、Toc 高亮、i18n、mock 全类型

## 常见错误

| 现象 | 原因 | 处理 |
|---|---|---|
| 工作台菜单一直选中 | 菜单 path 为 `/workspace` 前缀匹配 | 改为 `/workspace/dashboard` |
| 公开区改主题无效 | 只用了 Pro `settings` | 使用 `publicSettings` + `ConfigProvider` |
| 工作区切语言无效果 | 文案硬编码中文 | `useIntl` + `workspace.ts` locale |
| 三按钮同时 hover | 三个 action 包在同一 avatar 容器 | 拆 `actionsRender` + 独立 `AvatarDropdown` |
| mock 小册不更新 | generated 文件需重启 dev | `pnpm sync:booklets` 后重启 |

## 手动验证

1. admin 登录 → 工作区切换英文 → 菜单与 Dashboard 标题变化
2. 公开页设置暗色 → 仅公开区变暗
3. `/content/c-md-01` 滚动 → 目录高亮跟随
4. `curl /api/contents?type=word` 能筛到 Word 示例

## 延伸阅读

- [umi-mock-and-dataflow.md](./umi-mock-and-dataflow.md)
- [markdown-booklet-reading.md](./markdown-booklet-reading.md)
- [docs/implementation/react-first/phase-0-3.md](../../docs/implementation/react-first/phase-0-3.md)
