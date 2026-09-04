# `.agents/` — 跨工具 Agent 规则与技能

本目录遵循 [Agent Skills](https://agentskills.io) 约定，供 Cursor、Claude Code、Codex 等读取。

## 结构

```text
.agents/
├── README.md                 # 本说明
├── rules/                    # 始终应遵守的短约束
│   ├── docs-placement.md
│   ├── dev-workflow.md
│   └── fullstack-impact.md   # 前后端契约改动必须评估影响面
└── skills/
    ├── git-commit/
    │   ├── SKILL.md          # 提交权威规范 + 执行流程
    │   └── references/
    │       └── examples.md
    ├── fullstack-impact/
    │   └── SKILL.md          # Nest/API：计划门槛、Umi 全局解包、调用方清单
    └── task-quality-review/
        └── SKILL.md          # 手动触发的 AI 开发任务质量评分
```

## 与其它目录的关系

| 路径 | 用途 |
| --- | --- |
| `AGENTS.md` | 项目入口；**强制**要求先读本目录 |
| `.agents/rules/` | 跨工具短规则（文档放置、开发流程） |
| `.agents/skills/` | 可调用的完整工作流（如 git-commit） |
| `.cursor/rules/` | 仅 Cursor：薄包装，指向本目录，避免双源 |
| `apps/*/.agent/` | 包内模块细则（非 Skills 规范），继续保留 |
| `docs/` | 给人读的产品/架构/部署长文，**不是** commit 权威源 |

## Agent 使用方式

1. 打开任务时先读 `AGENTS.md` 与 `.agents/rules/*`
2. 任务匹配某 skill 的 description 时，加载对应 `SKILL.md`；要求“执行任务质量评审”时，加载 `skills/task-quality-review/SKILL.md`
3. 涉及 commit / push 时，**必须**加载 `skills/git-commit/SKILL.md`
4. 涉及 Nest / Canonical API / Prisma / api-client / Umi services / mock 回落时，**必须**加载 `skills/fullstack-impact/SKILL.md`
