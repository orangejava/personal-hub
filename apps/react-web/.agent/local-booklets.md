# 本地小册同步脚本规范

> 适用：`src/scripts/sync-local-booklets.ts`

## 输入与输出
- 输入目录：`content-local/` 与 `content-local/booklets/`（仓库根）。
- 白名单：`apps/react-web/src/scripts/sync-allowlist.json`（非空则只同步列出的文件夹名）。
- 输出：`apps/react-web/mock/data/local-booklets.generated.ts`。
- 命令：`pnpm --filter react-web sync:booklets` 或根目录 `pnpm sync:booklets`。

## 解析规则
- 每个子文件夹视为一本小册。
- 若白名单 `folders` 非空，**仅同步白名单内的文件夹**（用于远程阅读时减负）。
- 优先读 `meta.json`；无则用文件夹名生成标题。
- 只读 `.md`；按文件名数字前缀（`01-`、`001-`）排序，无前缀按文件名排序。
- 章节标题取 Markdown 第一个 `# 标题`，无则用文件名。
- 输出 `Booklet` 与 `BookletChapter`（类型来自 `@personal-hub/shared-types`）。
- Mock 的 `GET .../chapters` **不返回 body**，正文走单章接口。

## 错误处理
| 场景 | 处理 |
|---|---|
| 目录不存在 | 生成空数组，提示创建目录 |
| `meta.json` JSON 错误 | 跳过 meta，记录 warning |
| `.md` 为空 | 仍生成章节，标记 `empty:true` |
| 文件名重复 | 用路径 hash 生成稳定 ID |
| 无任何 `.md` | 不生成该小册，记录 warning |

## 约束
- 浏览器页面不直接扫描本地文件夹，同步由 Node 脚本完成。
- 脚本用 `tsx` 执行，扫描用 `fast-glob`。
