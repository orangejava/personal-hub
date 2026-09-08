---
name: fullstack-code-review
description: >-
  Reviews local code changes and pull requests for correctness, concurrency,
  security, API contracts, tests, performance, and deprecated frontend APIs.
  Use when asked to review code, changes, diffs, a branch, a PR, test coverage,
  security, performance, or migration risks; also when the user says review,
  change, PR, 审查, 安全, 性能, 废弃 API, or 测试覆盖.
compatibility: Works with Cursor, Claude Code, Codex, and other Agent Skills clients.
metadata:
  author: personal-hub
  version: "1.1"
---

# 全栈代码审查

本 skill **不替代**仓库 `AGENTS.md`、项目 rules，或专门的安全审查流程。仓库里有这些文件时先读它们，再按本清单审查。

## 放置与优先级

| 副本 | 路径 | 用途 |
| --- | --- | --- |
| 仓库 | `.agents/skills/fullstack-code-review/` | 随 git clone 带到其它电脑；**本仓库以此为准** |
| 用户级 | `~/.agents/skills/fullstack-code-review/` | 其它没有本 skill 的项目 |

两边 `name` 相同。Cursor / 其它客户端**没有保证**自动去重：若同一会话里两份都出现，只执行仓库这份，不要把两份当成互相独立的规则。更新时两处正文保持同步。

## 范围与安全

- 默认只读。未经明确要求，不要改代码、commit、push 或发起部署。
- 先看指定的 diff。用户没指定时，写明审查的是未提交改动、分支相对主线，还是某个命名目标。
- 只报告有代码、运行输出或文档支撑的问题；不要用空泛的风格建议撑满报告。

## 审查流程

1. 收集 `git status --short`、`git diff --check`、改动文件统计，以及适用的测试 / lint 命令。
2. 沿每条被改请求路径走完：controller → service → 持久化 → 客户端 service → UI 调用方 → 测试。
3. 检查状态迁移、重试、幂等、授权范围、事务、分页、空输入，以及并发相同请求。
4. 前端改动：对照当前框架迁移指引、浏览器可见行为、i18n、无障碍、过期闭包、轮询、加载/错误态。
5. 用断言对照被改分支和失败路径，评估测试是否够用。测试通过 ≠ 覆盖充分。
6. 跑安全、相关的校验。跑不了的命令要写明原因。

分层顺序：正确性 → 并发/安全 → API 契约 → 测试 → 前端废弃 API。

## 问题阈值

- **P0**：丢数据、提权、安全暴露、不可逆的重复写入，或会挡住发版的故障。
- **P1**：用户路径坏了、状态错误、重试无法恢复、分页错误，或明显回归。
- **P2**：兼容性、可维护性、可观测性、文案/i18n，或影响面有限的迁移债。
- 可选清理若不能明显防止以后再踩坑，不要写进报告。

每条问题必须包含：

```text
优先级 — 短标题
位置: 文件:行号
证据: 具体控制流 / 数据流
影响: 谁或什么会坏
建议: 最小安全改动
验证: 如何证明修对了
```

## 全栈契约检查

- 每个边界只保留一种成功/失败约定。请求层已经解包成业务值时，不要让页面再去读旧信封。
- 后端已实现的路由，不要再加 mock 回落。
- 变更类 HTTP：检查幂等键复用、并发相同请求、重试行为、响应回放。
- 权限：同时校验动作和数据范围，不能只靠 UI 隐藏当授权。
- 队列和对象存储：看事务边界和补偿，失败后仍可重试。

## 报告格式

开头写：审查范围、校验摘要、是否建议发布（直接结论）。

随后按优先级从高到低列问题，再写：

- 已经有的覆盖；
- 按风险排序的缺测；
- 废弃 API / 迁移项；
- 明确推迟的事项。

没有可执行问题时，明确写「无待修项」，并概括做了哪些检查。
