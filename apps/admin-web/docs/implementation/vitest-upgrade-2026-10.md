# 管理端 Vitest 升级记录

> 状态：已验证
> 日期：2026-10-27

## 背景与原因

管理端测试此前锁定在 `vitest@0.34.6`，但本轮测试环境需要恢复可执行；当前工作区 Vitest 所使用的 Vite 解析为 `8.2.0`，因此本次选择升级到支持当前 Vite 主版本的 Vitest `4.1.9`，并同步升级 `@vitest/coverage-v8`、`@vitest/ui`。

需要区分历史配置：旧实现记录曾将 Vitest `0.34.6` 与 Vite `4.5.2` 配套使用。它说明 Vitest 版本应与实际测试运行时的 Vite 配对，而不是仓库长期固定使用 Vitest 4。本轮没有做“Vitest 0.34.6 + 独立 Vite 4”回退实验，因此本记录不声称升级是唯一可行方案；本次选择是让测试工具链对齐当前解析到的 Vite 8。

管理端生产构建仍由 Umi / Webpack 执行；Vitest 升级不改变生产运行时，也不代表生产构建器迁移到 Vite。

## 本次改动

- `vitest`：`0.34.6` → `4.1.9`
- `@vitest/coverage-v8`、`@vitest/ui`：`0.34.6` → `4.1.9`
- 测试 DOM 环境由 `happy-dom` 切换为 `jsdom`。
- Vitest 缓存关闭，避免多个 worktree 复用依赖目录时测试结果互相污染。
- 更新 pnpm 锁文件以匹配依赖声明。

DOM 环境切换是独立的测试环境选择，不是 Vitest 4 的硬性要求。目前测试 setup 只引入 `jest-dom`；本轮没有发现必须依赖 jsdom 特有行为的用例。因此它不应被描述为升级 Vitest 的必要条件，未来如无测试兼容性需求，可以单独评估是否恢复 `happy-dom`。

## 验证结果

2026-10-27 在当前工作区执行：

| 检查 | 结果 |
| --- | --- |
| `pnpm --filter admin-web test` | 通过：3 个测试文件、8 个测试 |
| `pnpm --filter admin-web build` | 通过：Webpack 编译成功并生成全部路由页面 |
| `pnpm --filter user-web build` | 通过：Webpack 编译成功并生成全部路由页面 |

测试运行期间仍有 Vite 关于 `configLoader: 'native'` 的提示；两端构建均提示 Browserslist 数据可更新。这些提示没有导致命令失败，也不是本次 Vitest 升级的产物验收失败。

## 影响与边界

- Vitest 4 改变的是管理端测试工具链；生产应用的 Umi / Webpack 构建入口和运行时不变。
- `pnpm-lock.yaml` 的更新不只包含 Vitest 条目，还重新生成了部分依赖的 peer 组合和间接依赖解析。当前两端生产构建均通过，说明这次解析下的构建链路可用；但这不等同于对每个间接依赖组合做了独立回归测试。
- `jsdom` 仅用于测试环境，不进入生产浏览器 bundle。
- 本次没有执行浏览器逐页视觉验收；构建成功只证明静态编译和打包通过。

## 后续验证建议

Vitest、Vite、Umi 或锁文件发生大范围解析变化时，至少执行管理端测试及管理端、用户端生产构建，并检查 lockfile diff 是否包含非预期的工具链变更。
