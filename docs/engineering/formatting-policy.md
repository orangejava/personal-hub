# 代码与文档格式化方案

> 状态：方案已确定，工具配置尚未实施
> 最后更新：2026-10-27
> 范围：`apps/user-web`、`apps/admin-web`、`apps/server`、`packages` 与仓库文档

## 1. 现状与问题

根目录已有 Prettier 3 配置，当前根目录和服务端实际解析的版本均为 `3.9.0`。服务端 CI 用 Prettier 检查格式；用户端和管理端用 Biome 做 lint，两端的 `biome` 脚本和 `.lintstagedrc` 还会执行 `biome check --write`。根目录的 `pnpm format` 则是 `prettier --write .`。因此，同一个前端文件可能被两个格式化器依次改写。

两端 Biome 配置没有显式声明行宽，根目录 Prettier 则设为 100。除此之外，两端 Biome 排除了 `src/services`、`mock` 等目录，这些目录并未获得同一套格式检查。当前 Web CI 只运行 `biome lint`，没有格式检查。旧文件中的排版差异不代表代码错误，但会在功能 diff 中制造无关的换行重排。

## 2. 推荐的唯一写入者

**所有人工维护、且 Prettier 支持的文件，统一由根目录 Prettier 3 格式化。** Biome 和 ESLint 继续负责代码质量检查，不写入排版。这样服务端现有的 Prettier 检查可以沿用，前端的 `services`、`mock` 也有相同的格式规则。

| 区域                                                                          | 格式化           | 静态检查                      | 备注                                                   |
| ----------------------------------------------------------------------------- | ---------------- | ----------------------------- | ------------------------------------------------------ |
| `apps/user-web`、`apps/admin-web` 的 TS/TSX、JS/JSX、CSS/Less、JSON、Markdown | 根目录 Prettier  | 各应用 Biome lint、TypeScript | 两端相同；包含手写 `services` 与 mock 代码             |
| `apps/server` 的 TS/JS、JSON、Markdown                                        | 根目录 Prettier  | ESLint、TypeScript            | 保留现有 `format:check`，使其与根目录版本一致          |
| `packages/**` 的可格式化源码与配置                                            | 根目录 Prettier  | 各包现有 typecheck/lint       | 不在共享包另设 formatter                               |
| `docs/**`、`study/**`、根目录人工维护的 Markdown/YAML/JSON 等                 | 根目录 Prettier  | Markdown 链接与内容人工审阅   | 格式化不改变 PRD 的决策状态                            |
| Prisma schema、`pnpm-lock.yaml`、生成文件与二进制素材                         | 对应生成器或工具 | 对应构建/生成检查             | Prisma schema 用 `prisma format`；锁文件只由 pnpm 维护 |

根 `.prettierrc` 保持现有规则：100 字符行宽、单引号、尾逗号、分号、2 空格缩进和 LF。根及服务端的 Prettier 依赖应锁到同一实际版本；编辑器、提交钩子和 CI 都使用仓库安装的版本，不使用全局安装的 formatter。现有 `.editorconfig` 已规定 UTF-8、2 空格、LF 和结尾换行，可继续作为编辑器的基础约束。

## 3. 实施时需要同步修改的入口

此节是后续实施清单；本文件落库时不代表下列配置已生效。

1. 根目录 `package.json`：把可能写遍整个仓库的 `prettier --write .` 改为显式文件参数或安全的、限定人工维护文件的命令；提供只读 `format:check`。单次开发可以直接执行 `pnpm exec prettier --write <本次修改的文件>`。
2. 根目录新增 `.prettierignore`：排除 `node_modules`、`dist`、`.umi*`、`.turbo`、`coverage`、`.cache`、`content-local`、生成的本地小册文件、快照、锁文件和其他明确由工具生成的目录。不能整体排除前端 `src/services`、`mock` 或人工编写的文档。
3. 两端 `biome.json` 与 `package.json`：停用 Biome formatter，保留 `biome lint`；移除或改名现有会写入格式的 `biome check --write` 命令，避免误用。
4. 两端 `.lintstagedrc`：对受支持的暂存源码和 Markdown 先运行仓库版本的 Prettier，再运行只读 `biome lint`；不要让 Biome 对同一文件执行格式写入。检查 lint-staged 对绝对路径、未暂存改动及部分暂存文件的处理，确保提交钩子不会把其他工作区改动带进提交。
5. 编辑器配置：TS/TSX、JS/JSX、CSS/Less、JSON、Markdown、YAML 的保存时格式化统一指向 Prettier；Biome 扩展只提供诊断和 lint。VS Code 可用仓库级 `.vscode/settings.json` 表达，其他编辑器遵守同一职责。
6. CI：前端仍运行 Biome lint 和 TypeScript；服务端仍运行 ESLint、TypeScript 与 Prettier 检查。完成存量格式基线后，给 Web CI 和共享包增加同一版本的 Prettier 只读检查。

## 4. 排除范围与增量迁移

`pnpm-lock.yaml`、生成的 API/路由代码、构建产物、上传内容和二进制文件不能交给通用格式化命令。Prisma 迁移 SQL 也不由 Prettier 改写；数据库 schema 走 Prisma 自带的格式化器。

落地分三步：

1. 先调整脚本、提交钩子、编辑器约定与忽略清单，停止 Prettier 和 Biome 对同一文件的交替写入；这一步不批量重排存量文件。
2. 按应用或目录单独建立存量格式基线。Prettier 会格式化整份文件，即使只改一行也可能扩展 diff，所以纯格式化必须用独立提交，避免混入功能或修复提交。
3. 每个范围完成基线后再开启对应 CI `prettier --check`。未完成基线的范围仅对新文件和本次明确整理的文件做格式检查，不能让全仓检查因历史排版而长期失败。

执行提交前先看 `git diff` 与暂存区。若格式化器修改了未计划文件，保留原有用户改动并单独处理格式差异，不把这些文件加入功能提交。

## 5. 验收标准

- 对同一份代表性 TSX、service、Less、Markdown 文件，编辑器保存、提交钩子和手动格式化后的输出一致；再次执行格式化没有新 diff。
- 用户端与管理端的 Biome lint、TypeScript、服务端 ESLint 与 `format:check` 继续通过；所有新加的 CI 格式检查为只读。
- `src/services`、mock、共享包和文档均有明确的格式归属；`pnpm-lock.yaml`、本地内容及生成目录不出现在格式化 diff 中。
- 功能提交中不包含无关页面、语言包或文档的整篇排版变化；需要重排的存量文件通过独立格式提交进入基线。

这里复用现有 Prettier、Biome、ESLint 与 `.editorconfig`，不增加第三套格式工具或单独的 Agent skill。协作约束在实施时加入 `.agents/rules/dev-workflow.md` 的短条，并链接本文作为细则。
