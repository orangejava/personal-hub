# 阶段 4 审阅与工程修复记录

> 状态：已完成本轮修复
> 最后更新：2026-07-04
> 对应 PRD：[../../prd/react-first/phase-4-admin-preview-prd.md](../../prd/react-first/phase-4-admin-preview-prd.md)

## 1. 目标与范围

本轮不是新增业务页面，而是对当前阶段 4 代码做一次审阅后的收口：

- 修复 Vitest 与 Vite 版本不兼容导致测试无法启动。
- 修复 Biome 明确报错。
- 删除 `apps/react-web/package-lock.json`，避免 pnpm workspace 与 npm lock 混用。
- 补齐内容列表类型中的运营字段，去掉工作区页面的临时 `any` 强转。
- 修复依赖调整后旧 dev server / Umi MFSU 缓存不一致导致的开发态 `dispose` 报错。
- 修复 PDF mock 预览在开发态偶发的 PDF.js stream transport 兼容问题。
- 补充阶段 4/5 和 Next API Bridge 文档，为后续开发提供更细计划。

权限契约本轮暂不直接改代码，原因见阶段 4 PRD 的“权限契约是否现在完善”。

## 2. 关键实现

### 2.1 Vitest 版本收口

当前 Umi 依赖链使用 `vite@4.5.2`。原先 `vitest@4.1.8` 启动时会访问 Vite 新版本才导出的 `./module-runner`，导致测试命令在启动阶段失败。

本轮将以下包调整到支持 Vite 4 的版本：

- `vitest@0.34.6`
- `@vitest/coverage-v8@0.34.6`
- `@vitest/ui@0.34.6`

### 2.2 PDF Viewer lint

`PdfViewer` 原先使用数组 index 作为 React key。现在先生成页码数组，再用 `page-${pageNumber}` 作为稳定 key。

### 2.3 内容列表类型

`ContentItem` 新增可选字段：

- `status`
- `visibility`
- `createdAt`
- `updatedAt`

设计取舍：

- 公开内容中心仍可以只关心展示字段。
- 工作区和后台列表可以直接读取运营字段，不再使用 `(r as any)`。
- 这些字段设为可选，避免强迫所有公开 mock 数据立即补齐管理字段。

### 2.4 Mock 内容形状

工作区创建内容时补默认字段，保证新增 mock 内容至少具备：

- 标题、类型、摘要
- 阅读数、收藏数
- 状态、可见性
- 创建时间、更新时间

### 2.5 开发态 `dispose` 报错

本轮依赖版本调整后，旧的 Umi dev server 仍在运行，MFSU / HMR 继续复用旧进程和旧缓存，页面热更新时出现：

```text
Cannot read properties of undefined (reading 'dispose')
```

排查结论：

- 业务代码中没有直接调用 `dispose`。
- 报错链路落在 Webpack runtime / MFSU 虚拟入口。
- 停止旧 dev server 并清理 `apps/react-web/src/.umi`、`apps/react-web/node_modules/.cache/mfsu*` 后重新启动，首页和内容页不再出现该开发态 overlay。

后续如果调整 Umi、Vite、Vitest、Webpack、React-PDF 等构建期依赖，建议执行一次干净重启：

```bash
rm -rf apps/react-web/src/.umi apps/react-web/src/.umi-production apps/react-web/node_modules/.cache/mfsu apps/react-web/node_modules/.cache/mfsu-deps
corepack pnpm --filter react-web dev
```

### 2.6 PDF 预览稳定性

`react-pdf` 在当前开发态 mock 文件预览中，直接传 URL 会触发 PDF.js stream transport 兼容问题，表现为：

```text
Cannot set properties of undefined (setting 'onPull')
```

本轮改为先通过 `fetch` 读取 `ArrayBuffer`，再以 `{ data: Uint8Array }` 传给 `Document`。同时在 mock 预览中关闭 worker、stream 和 auto fetch，优先保证本地阶段验证稳定。后续接真实对象存储或大文件预览时，可以再单独恢复 worker 与分片加载，并补充大文件性能验证。

## 3. 权限契约判断

短期给少量用户试用时，当前简化权限不会阻塞主要流程。因为路由层已有 admin/editor/member 的入口控制。

但如果要开放后台角色配置或接真实后端，必须统一到长期 RBAC 权限点。统一时会影响共享类型、mock 用户、菜单、按钮权限、后台角色页和后端 Guard，属于中等规模改动，建议单独开任务做。

## 4. 文档补充

本轮新增或更新：

- `docs/prd/react-first/phase-5-ai-platform-prd.md`
- `docs/prd/react-first/phase-5-5-next-api-bridge-prd.md`
- `docs/prd/react-first/phase-4-admin-preview-prd.md`
- `docs/react-first/roadmap.md`
- `docs/prd/README.md`
- `docs/prd/react-first/README.md`
- `docs/overview.md`

## 5. 验证方式

本轮应验证：

1. `corepack pnpm --filter react-web test`
2. `corepack pnpm --filter react-web biome:lint`
3. `corepack pnpm typecheck`
4. `corepack pnpm --filter react-web tsc`
5. 打开 `/content/c-pdf-01`，确认 PDF 预览可加载。
6. 打开 `/workspace/content`，确认状态、可见性列正常展示。

## 6. 后续扩展

- 阶段 4 优先补 `/admin/homepage`、`/admin/menus` 和内容状态 mock 持久更新。
- 阶段 5 可按新 PRD 先做纯前端 AI 工具与 mock。
- 如果用户确认，可在阶段 5.5 增加 `apps/next-api` 作为过渡 API 层。
