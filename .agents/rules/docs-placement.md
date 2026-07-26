# 文档放置规则

完整目录说明见 `docs/README.md`。新增或移动文档时必须遵守。

## 目录速查

| 内容类型 | 目录 |
| --- | --- |
| 产品需求 / 验收 PRD | `docs/prd/` |
| 部署、服务器、上线、备份 | `docs/deploy/` |
| 已落地实现说明 | `docs/implementation/` |
| 本地开发规范、工具链 | `docs/engineering/` |
| 产品功能范围 | `docs/product/` |
| Git 提交工作流（权威） | `.agents/skills/git-commit/` |
| 学习笔记 | `study/features/` 或 `study/` |

## 硬性禁止

- **禁止**把部署方案、Linux 上线步骤、服务器目录规划放进 `docs/prd/`
- **禁止**同一主题维护两份完整长文（权威一份，其它只留链接）
- **禁止**新增 docs 文件却不更新 `docs/overview.md` 或所属 `README.md`
- **禁止**把 commit 规范长文放回 `docs/`（权威在 `.agents/skills/git-commit`）

## 做完功能后的文档

遵循 `AGENTS.md`：PRD → implementation → 可选 study；涉及部署变更时同步 `docs/deploy/`。

## Review 文档时

先打开 `docs/README.md` 核对是否放错目录，再改正文；发现错放先提议搬迁。
