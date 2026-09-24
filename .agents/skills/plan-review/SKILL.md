---
name: plan-review
description: >-
  Scores an implementation plan before any code changes, using five 20-point
  checks. Use when the user asks to review a plan, score a plan, or start
  coding only if the plan is above 90. Do not use this for a finished diff;
  that is task-quality-review.
---

# 计划评审

动手改业务代码之前，给实现计划打分。这是对话里的高频步骤，和完成后的 `task-quality-review` 不是同一件事。

## 何时使用

- 用户要求 review 计划、给计划打分，或写明「超过 90 分再执行」。
- 计划跨多个页面、断点或交互取舍，准备一次性实现之前。

未出现上述意图时，不要主动把一次普通讨论变成打分流程。

## 流程

1. 只评当前计划，不改业务代码，不补做实现。
2. 按下面五个维度各打 0–20 分。每个扣分写清缺的是哪条行为或哪处边界。
3. 总分 **大于 90** 才可以按该计划开始改代码。
4. 总分 **小于或等于 90**：改计划并重新打分。在重新超过 90 之前，不要开始改业务代码。
5. 回复里给出总分、分项、仍故意不做的范围。不要用分数代替未决定的点。

## 量表

| 维度 | 分值 | 看什么 |
| --- | ---: | --- |
| 需求覆盖 | 20 | 用户明确说过的行为是否都有对应做法 |
| 边界与继承 | 20 | 宽窄屏、高度、空态、登录态是否互相打架；较窄档是否跟着较宽档的紧凑方案走 |
| 可执行性 | 20 | 文件、状态、样式谁盖住谁，是否具体到能直接改 |
| 回归风险 | 20 | 桌面或相邻页面里要保留的交互是否写明 |
| 验收 | 20 | 是否有用户能手动执行的验证路径，而不是只写「看一下」 |

## 纪律

- 未决定的点保持未决定，不要为了凑分写成已经定案。
- 不评 diff、不评测试证据、不代替完成后的任务质量评审。
- 计划里的视口数字若属于本仓库用户端，要能落到 `apps/user-web/src/config/viewport-bands.json`，不要另起一套断点。
