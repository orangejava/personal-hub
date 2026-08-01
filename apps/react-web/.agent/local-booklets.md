# 本地小册同步脚本规范

> 适用：`src/scripts/sync-local-booklets.ts`、外部导入 `src/scripts/import-external-agent-booklets.py`

## 输入与输出

- 输入目录：`content-local/` 与 `content-local/booklets/`（仓库根）。
- 白名单：`apps/react-web/src/scripts/sync-allowlist.json`（非空则只同步列出的文件夹名）。
- 输出：`apps/react-web/mock/data/local-booklets.generated.ts`（gitignore）。
- 同步：`pnpm sync:booklets`（根目录）或 `pnpm --filter react-web sync:booklets`。
- **Agent 三册导入**（需网络，约 15–25 分钟）：`pnpm import:agent-booklets`，完成后务必再跑 `pnpm sync:booklets`。

## Agent 相关小册（分工）

| 目录名 | 来源 | 用途 |
| --- | --- | --- |
| `AI Agent 工程实战` | `../personal-agent-lab/study/booklets/ai-agent-engineering` | **主学习线**：TypeScript 实现、章末实验、Nest 生产 |
| `菜鸟教程 AI Agent 教程` | runoob.com/ai-agent 全站抓取归档 | 概念、Python、工具广度参考 |
| `AgentGuide AI Agent 开发指南` | GitHub adongwanai/AgentGuide `docs/` | 理论、栈、面试、路线归档 |

- 工程小册章末 `pnpm --filter @personal-agent-lab/...` **在 personal-agent-lab 仓库执行**，Hub 侧仅阅读。
- 归档小册各章含原站/GitHub 来源链接；**仅供个人学习**，勿商用转载。
- **飞书社区文章**（一站式 Agent 入门）：需登录，脚本无法抓取正文；若需要可手动粘贴为独立章节。

## 解析规则

- 每个子文件夹 = 一本小册。
- 白名单 `folders` 非空时，**仅同步白名单内**文件夹。
- 读 `meta.json`；无则用文件夹名。
- 只读 `*.md`；**跳过 `README.md`**（维护索引，不作章节）。
- 按文件名数字前缀排序（`00`、`00A`、`01`…）。
- 章节标题：Markdown 首个 `# 标题`，否则用文件名。
- Mock 的 `GET .../chapters` **不返回 body**；正文走单章接口。

## 错误处理

| 场景 | 处理 |
| --- | --- |
| 目录不存在 | 生成空数组，提示创建目录 |
| `meta.json` JSON 错误 | 跳过 meta，warning |
| `.md` 为空 | 仍生成章节，`empty: true` |
| 无 `.md` | 跳过该小册 |

## 约束

- 浏览器不直接读本地目录；靠 Node 脚本生成 mock。
- `sync-local-booklets.ts` 用 `tsx` + `fast-glob`。
- `import-external-agent-booklets.py` 依赖 `html2text`（`pip3 install html2text`）与系统 `curl`。
