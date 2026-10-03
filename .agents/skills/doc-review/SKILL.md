---
name: doc-review
description: >-
  Reviews a PRD or implementation plan from senior architecture, frontend, and
  backend perspectives, then scores it with plan-review. Use when the user
  asks for a document review, 文档评审, 方案评审, 架构评审, or a joint
  review by 资深架构, 资深前端, and 资深后端. Add Flutter or Tauri lenses
  when the document mentions those clients. Do not use this for a finished
  diff; that is fullstack-code-review. Do not use this for a completed task;
  that is task-quality-review.
compatibility: Works with Cursor, Claude Code, Codex, and other Agent Skills clients.
metadata:
  author: personal-hub
  version: "1.0"
---

# 多角色文档评审

评审的是**将要开工的文档**（PRD、实现计划、接口与页面约定）。对照仓库里已经存在的代码和配置，找出文档写了但落不到文件、状态或验收上的缺口。

## 放置与优先级

| 副本 | 路径 | 用途 |
| --- | --- | --- |
| 仓库 | `.agents/skills/doc-review/` | 随 git clone 带到其它电脑；**本仓库以此为准** |
| 用户级 | `~/.agents/skills/doc-review/` | 其它没有本 skill 的项目，包括以后的 Flutter、Tauri |

两边 `name` 相同。同一会话里两份都出现时，只执行仓库这份。更新时两处正文保持同步。

## 不要和这些 skill 混用

| Skill | 评什么 |
| --- | --- |
| `plan-review` | 动手前的五维打分。本 skill 的分数**必须**用它的量表，不另起一套 |
| `fullstack-code-review` | 已经写出来的 diff / PR |
| `task-quality-review` | 功能做完之后的质量分 |

本 skill 默认只改文档缺口。用户没有明确要求时，不改业务代码，不 commit。

## 流程

1. 读完要评的文档，以及它点名的现有文件（schema、路由、布局、上传策略、视口配置）。文档和代码不一致时，以代码里的已有约束为准，把冲突写进发现。
2. 先用下面三个角色各写发现。文档没涉及的角色不要硬评。
3. 文档写到 Flutter、Tauri / 桌面、管理端或原生壳时，再加对应的附加角色。
4. 未决事项保持未决，不要为了提分写成已经定案。
5. 按 `plan-review` 五个维度各打 0–20。仓库或 `~/.agents/skills/plan-review/` 有该 skill 时，打开它并遵守它的门槛：**总分大于 90** 才可以按该计划改业务代码。没有该 skill 的仓库，用文末同一张表。
6. 总分小于或等于 90：先改文档里的缺口，再重新打分。重新超过 90 之前，不要开始改业务代码。

## 架构

看边界和长期会不会打架，不看像素。

- 模块谁拥有数据：目录、密钥、账本、配置组是否拆开；有没有两套价格、两套开关、两套密钥表。
- 依赖方向：页面是否绕过已有契约直接读内部 ID；后合并的分支会不会改同一文件。
- 失败与幂等：重复提交、登录失败、刷新令牌、发放失败是否把主流程拖垮。
- 明确不做的范围是否还留在本期文件表里。留着又没有列，算缺口。
- 换客户端（Web、Flutter、Tauri）时，哪些契约必须共用，哪些只属于某一个壳。

## 前端

看的是人能点到的界面，以及窄屏会不会把宽屏方案挤坏。

- 视口必须落到项目已有档位。本仓库用户端是 `apps/user-web/src/config/viewport-bands.json`，不要另起一套断点。
- 空态、未登录、加载失败、按钮高度、滚动发生在卡片内部还是把整页撑出横向滚动条。
- 新交互放在已有页面时，写明哪一块保持原样（例如 mock 表单不要顺手改成真接口）。
- 样式谁盖住谁：布局、顶栏、全局动效、主题 token。只写「优化体验」而没有文件和状态，不能开工。
- 验收要是可以手动做的步骤：打开哪条路由、用哪个视口、看到什么、什么必须还在。

## 后端

看请求从入口到落库，而不是只看字段名词。

- 新表或新列落在哪张已有表上；密钥、备案号、文件 ID 是否会出现在公开响应、日志、幂等记录里。
- 上传用途、MIME、大小是否沿用现有策略，而不是新造一个用途却没写校验。
- 接口路径、权限、幂等键、事务：扣减失败时是否整笔拒绝。
- 与现有运行方式的衔接：环境变量回退、Fake、已有赠额、刷新令牌。
- 验收里跨时间的规则（自然日、断签）要写明浏览器步骤和服务端测试各验什么，不要要求改操作系统时钟。

## 附加角色

只在文档真的写到该端时启用。

| 角色 | 何时加 | 看什么 |
| --- | --- | --- |
| Flutter | 出现 Flutter、Dart、移动端 App | UI / 数据分层，状态不要写在 Widget 里；导航和离线缓存；与 Web 共用的 API 契约；`flutter analyze` 能覆盖的验收 |
| Tauri / 桌面 | 出现 Tauri、桌面端、WebView | 复用现有 Web 还是另做界面；系统 WebView 差异（Windows WebView2、macOS WKWebView、Linux WebKitGTK）；权限按能力声明；密钥不进前端包；Linux 是否后置 |
| 管理端 | 只改 `admin-web` 且不改用户端视口 | 配置组不要用一个保存按钮写错组；预览是否反映未保存的值；失败走现有错误态 |

Flutter 的分层和状态归属参考 [flutter/skills](https://github.com/flutter/skills) 的架构实践，以及 [ECC 的 Flutter 审查清单](https://github.com/affaan-m/ECC/blob/main/skills/flutter-dart-code-review/SKILL.md)。Tauri 以当前仓库的桌面选型文档为准，不把 Electron 方案写进已选 Tauri 的计划。

## 输出

用中文，先给能不能开工，再给表。

1. 总分表：每个可独立开工的切片一行。文档自己写明后置的阶段单独注明「不在本期」，不要为了它把本期打失败，也不要把它算成已经能写代码。
2. 三个角色各一段：架构、前端、后端。有附加角色再加一段。每条扣分写清缺的是哪条行为或哪份现有代码。
3. 仍故意不做的范围。
4. 总分不超过 90 时，列出要补进文档的缺口。用户要求优化时再改文档并重打分。

## 评分表

与 `plan-review` 相同。这里只为没有该 skill 的仓库备用。

| 维度 | 分值 | 看什么 |
| --- | ---: | --- |
| 需求覆盖 | 20 | 用户明确说过的行为是否都有对应做法 |
| 边界与继承 | 20 | 宽窄屏、高度、空态、登录态是否互相打架；较窄档是否跟着较宽档的紧凑方案走 |
| 可执行性 | 20 | 文件、状态、样式谁盖住谁，是否具体到能直接改 |
| 回归风险 | 20 | 桌面或相邻页面里要保留的交互是否写明 |
| 验收 | 20 | 是否有用户能手动执行的验证路径，而不是只写「看一下」 |

## 参考，不照搬

这些仓库把角色拆开，或只做代码架构审查。本 skill 把角色收成一次文档评审，并继续用 `plan-review` 打分。

| 来源 | 借鉴 |
| --- | --- |
| [ai-cortex `review-architecture`](https://github.com/nesnilnehc/ai-cortex/blob/main/skills/review-architecture/SKILL.md) | 只看边界、依赖方向和耦合，不把安全或风格审查混进来 |
| [soderlind `document-architecture`](https://github.com/soderlind/skills/blob/main/skills/document-architecture/SKILL.md) | 文档要能对上代码里的边界、失败路径和改动文件 |
| [CpBruceMeena/skills](https://github.com/CpBruceMeena/skills) | 前端、后端、架构分成不同视角，而不是一份笼统意见 |
| [flutter/skills](https://github.com/flutter/skills) | Flutter 分层（UI、逻辑、数据），只在文档涉及 Flutter 时使用 |
| [ECC `flutter-dart-code-review`](https://github.com/affaan-m/ECC/blob/main/skills/flutter-dart-code-review/SKILL.md) | 状态管理无关的 Flutter 检查项；那是代码审查清单，不替代本 skill |
