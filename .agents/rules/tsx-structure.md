# TSX 方法放置（短约束）

新增或修改 `apps/*/src/**/*.tsx` 时，**不要把方法一律抽到外层文件**，也不要在一个标签里塞大段业务。

细则见 `.agents/skills/tsx-structure/SKILL.md`。匹配时**必须加载**。

## 硬门槛

- 纯函数、无 hooks → 同文件组件上方；多页复用再进共享模块。
- JSX 里超过大约 5～8 行的回调 → 提到组件内具名函数，标签只转发。
- 单文件约 400+ 行且一块 UI 自带 state → 拆子组件或 `useXxx`，不要塞进无 React 的 `utils`。
- 关着 `message` / `form` / `reload` 的提交留在组件里（或自定义 hook），不要抽到工具模块。
- `ProTable` 的 `request` 只做参数映射时可留在标签上。
- mock 大页（如 AI 配置 / 素材库 / 对话）不为结构单独重构，等接 Nest 时再拆。
- 本约定不写进 `fullstack-impact`。
