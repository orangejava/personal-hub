# docs 文档目录规范

> **权威约定**：新增或移动文档前先读本文件。  
> Agent 强制规则见：`.agents/rules/docs-placement.md`、根目录 `AGENTS.md`。  
> Git 提交权威规范见：`.agents/skills/git-commit/SKILL.md`（不在本目录维护完整副本）。

---

## 1. 目录职责一览（放哪里）

| 目录 | 放什么 | 不放什么 |
| --- | --- | --- |
| `docs/overview.md` | 总索引、产品定位、子文档入口 | 长文细节 |
| `docs/foundation/` | 技术栈、架构图、框架取舍 | 单次功能 PRD、部署命令 |
| `docs/product/` | 产品功能范围（前台/工作区/后台/内容/AI）；二期想法在 `product/phase-2/` | 实现细节、运维步骤；二期目录不是当前开发依据 |
| `docs/backend/` | **跨端契约**：API 清单、数据模型、mock 迁移对照 | 单应用实现说明、Nest 工程约定（已迁 `apps/server/docs`） |
| `apps/<name>/docs/` | **该应用专属** PRD、实现说明、应用结构 | 跨端产品范围、Canonical API、整站部署 |
| `docs/react-first/` | React-first **路线索引**（长文已迁 history 或 apps） | 运维、单次功能实现记录 |
| `docs/prd/` | **可指导开发的需求/验收**（按 react-first / long-term） | 服务器命令、部署目录规划 |
| `docs/engineering/` | 本地开发环境、工具链、凭证；commit 仅留 stub 入口 | 完整 commit 规范、生产部署命令 |
| `docs/deploy/` | **部署 / 上线 / 备份 / 服务器目录** | 产品需求、页面交互 PRD |
| `docs/implementation/` | **已落地**实现说明、调用链 | 未实施的方案稿、纯 PRD |
| `docs/completed/` | 进度台账（只做索引） | 长实现文（链到 implementation） |
| `docs/history/` | 已被替代的完整决策、方案与复盘 | 当前开发依据、可执行部署命令 |
| `.agents/` | 跨工具 rules / skills | 产品长文 |
| `study/`（仓库根） | 可复用学习笔记 / 手册 | 项目契约的唯一真相源 |

---

## 2. 常见错放（禁止）

| 错放 | 应放到 |
| --- | --- |
| 部署方案写进 `prd/` | `docs/deploy/` |
| 生产 Nginx/PM2 命令写进 `engineering/` | `docs/deploy/` |
| 完整 commit 规范写进 `docs/` | `.agents/skills/git-commit/` |
| 未做完的方案写成 `implementation/` | 先放 `prd/` 或 `deploy/` 方案稿 |
| 同一主题复制两份长文 | 一份权威 + 别处短链 |
| 新增文档不更新索引 | 必须更新本目录 README 或 `overview.md` |
| 将过期方案保留在当前目录 | 移至 `docs/history/`，并在文首注明替代依据 |

---

## 3. 新增文档检查清单

1. 对照上表选对目录（拿不准时问用户或默认问「是需求 / 实现 / 部署 / 学习 / Agent 技能？」）  
2. 文件名用英文 kebab-case 或已有中文主题习惯，避免空格  
3. 文首写清：状态、最后更新、与其它文档的关系  
4. 更新：`docs/overview.md` 对应表格；所属子目录 `README.md`（若有）  
5. 若影响协作方式，同步 `AGENTS.md`  

---

## 4. 部署与 Git 入口

- 部署：[deploy/README.md](./deploy/README.md)
- Git commit skill：[`.agents/skills/git-commit/SKILL.md`](../.agents/skills/git-commit/SKILL.md)
- 前后端 API 影响面：[`.agents/skills/fullstack-impact/SKILL.md`](../.agents/skills/fullstack-impact/SKILL.md)
- TSX 方法放置：[`.agents/skills/tsx-structure/SKILL.md`](../.agents/skills/tsx-structure/SKILL.md)
- 全栈代码审查：[`.agents/skills/fullstack-code-review/SKILL.md`](../.agents/skills/fullstack-code-review/SKILL.md)（用户级镜像 `~/.agents/skills/`）
- docs 内 stub：[engineering/git-commit-convention.md](./engineering/git-commit-convention.md)

---

## 5. 为何容易乱

历史上曾同时存在：`operations/` 与 `prd/` 内部署长文、commit 规范散落在 docs 与 `.cursor`、索引与磁盘不同步。  
**以后以本文件 + `.agents/rules/` + 对应 skills 为准**；review 时先扫本表再改内容。
