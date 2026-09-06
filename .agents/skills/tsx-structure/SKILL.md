---
name: tsx-structure
description: >-
  Keep React TSX readable: hoist pure helpers above the component, name long
  JSX callbacks inside the component, split files only when a UI block has its
  own state. Do not extract handlers that close over form/message/reload into
  utils. Use when adding or editing apps/*/src/**/*.tsx pages, layouts, or
  components.
compatibility: Works with Cursor, Claude Code, Codex, and other Agent Skills clients.
metadata:
  author: personal-hub
  version: "1.0"
---

# TSX 方法放置（personal-hub）

防止「一个标签里塞一大段方法」，同时禁止把关着组件状态的处理函数一律抽到外层文件。

短约束：`.agents/rules/tsx-structure.md`。  
本约定**不写进** `fullstack-impact`：改 API 不必读 JSX 拆分；改页面即使不碰 Nest 也必须加载本 skill。

---

## 1. 何时必须加载

触及 `apps/user-web/src/**/*.tsx` 或 `apps/admin-web/src/**/*.tsx` 的新增、修改（页面、布局、组件）则加载。

纯 CSS / 文案微调、且不新增回调或辅助函数时，可只遵守短规则、不必逐条对照本文件。

---

## 2. 按依赖放置，不要按「在不在 tsx」一刀切

事件处理函数关着 `state` / `form` / `message` 时，放在组件里是正常写法。硬提到另一个 `utils.ts`，就要把一堆参数传进去，可读性更差。

### 优先级（从低成本到高成本）

1. **纯函数、无 hooks** → 同文件、组件上方。多页复用再进共享模块 / `utils`。
2. **JSX 属性里超过大约 5～8 行的回调** → 先提到组件内具名函数，标签上只转发。
3. **单文件超过约 400 行，且能按「一块 UI + 自己的 state」切开** → 拆子组件或 `useXxx` hook，不要塞进无 React 的工具模块。
4. **不要**把关着 `message` / `form` / `reload` / `setState` 的提交函数抽到无 React 的工具模块。

`onClick={() => setOpen(true)}` 这种 1～3 行写在标签上即可，不必为了「外层」再包一层。

---

## 3. 本仓库正例 / 反例

| 该怎么放 | 例子 | 原因 |
| --- | --- | --- |
| 组件上方纯函数 | 后台 `Menus` 的 `cloneMenu`、`toTreeData`、`updateMenuItem`、`findMenuItem`；登录 `formatCooldown`；分类 `toTree` | 只吃数据，不关抽屉开没开 |
| 组件内具名函数 + 标签转发 | 后台 `Homepage` 的 `save`，`onFinish={async (values) => save(values)}`；登录/注册的 `handleSubmit` | 关着 form / message / refresh |
| 仍待提到组件内（改 Menus 时做） | `titleRender`、抽屉 `onFinish` 目前仍写在 JSX 属性里 | 超过 5～8 行，且依赖 `editing` / `form`，**不要**提到文件外 |
| 允许留在标签上 | `ProTable` 的 `request` 只做 `params → { data, success, total }` 映射（约十余行） | 本仓库列表页的既有写法；变长或被多处复用再提取 |
| 现在不要为结构单独拆 | 后台 `AiConfig`、前台 `Assets` / `Chat`（仍 mock、各 500～800+ 行） | 等对应 Nest 接入时再按第 3 档拆子组件 / hook |

---

## 4. 改已有页面时

- 只整理**当前任务碰到的**文件；禁止顺手全仓抽函数。
- 已接 Nest 的小页（系统配置、主题）若 `onFinish` 已超过约 8 行，可收到组件内 `handleFinish`；文件本来就短时不要为对齐去改无关页。
- mock 大页不为「结构整洁」单独开一轮重构。

---

## 5. 交付自检

- [ ] 新增的数据变换不读 hooks，且写在组件上方（或共享模块）
- [ ] 没有在 JSX 属性里新增长达十余行的业务回调
- [ ] 没有把 `form` / `message` / `reload` 处理函数丢进纯 `utils`
- [ ] 没有把仅一页使用的 handler 拆成只被 import 一次的 `xxx.helpers.ts`
