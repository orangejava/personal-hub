---
name: git-commit
description: >-
  Create Conventional Commits with user authorization. Use when the user asks to
  commit, git commit, push, 提交, 推送, or write a commit message. Covers
  authorization gates, message format, staging safety, and batched commits for
  personal-hub.
compatibility: Requires git. Works with Cursor, Claude Code, Codex, and other Agent Skills clients.
metadata:
  author: personal-hub
  version: "1.1"
---

# Git Commit（personal-hub）

本 skill 是本仓库 **Git 提交的唯一权威规范**：授权门槛 + Conventional Commits 格式 + 执行步骤。

依据：[Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)

示例对照见 [references/examples.md](references/examples.md)。

---

## 1. 授权硬门槛（先于一切）

### 何时可以 `git commit`

**仅当**用户在本轮对话中明确授权，例如：

- 「提交」「帮我 commit」「执行第 N 批 commit」
- 「按计划提交」「可以 commit 了」

### 何时禁止 commit

- 只完成了功能/文档，用户未提提交
- 用户只说「写好规范 / 先 stage / 暂不 commit」
- 仅询问 message 怎么写（可起草，不可执行 commit）

### push

- `git push` 同样需要明确授权（「推送」「push 到 GitHub」）
- 未授权时最多完成本地 commit，并说明尚未 push

### 安全禁令

- 不修改 git config
- 不用 `--no-verify` / `--no-gpg-sign` 绕过 hook（除非用户明确要求）
- 不做 force push `main`（除非用户明确要求）
- 不提交密钥、`content-local/`、`node_modules/`、生成物（见 §5）

---

## 2. Message 格式

```text
<type>(<optional-scope>)<!>: <summary>

<optional body>

<optional footer>
```

### 2.1 type（必填）

| type | 何时用 |
| --- | --- |
| `feat` | 用户/调用方可感知的新能力 |
| `fix` | 修复缺陷 |
| `docs` | **仅**文档（含 `.agents` / AGENTS 说明性改动若纯文档） |
| `chore` | 工具链、配置、脚本、杂项（无产品行为变化） |
| `refactor` | 重构，行为不变 |
| `perf` | 性能 |
| `test` | 测试 |
| `style` | 格式化，无逻辑变化 |
| `ci` | CI 配置 |
| `build` | 构建系统 / 依赖构建相关 |

**判定提示：**

- 文档 + 代码同改 → 优先按代码选 type，或拆成两次 commit
- 只有移动/重命名文档目录 → `docs`
- 新增 skill/rule 文件且含行为约定 → 可用 `chore` 或 `docs`（本仓库偏好 `chore(agents): …`）

### 2.2 scope（推荐）

小写短词，本仓库常用：

`user-web` · `shared-types` · `booklet` · `docs` · `deploy` · `mock` · `api` · `auth` · `agents`

### 2.3 summary（必填）

- **type / scope 用英文**；**summary 优先中文**说明意图（也可英文祈使句）
- **祈使语气**：像在下命令（「增加…」「修复…」），不要「增加了」
- 聚焦 **why / 意图**，不要堆文件名列表
- 建议 ≤ 72 字符；句末不加句号
- 破坏性变更：在 type/scope 后加 `!`，例如 `feat(api)!: …`

### 2.4 body（可选）

两种正文写法**都保留**，按变更跨度选用；不要互相替代。

**默认：短段落**（单点或一个意图）

- 与 summary 空一行
- 写动机、影响范围、取舍；不要复述 diff
- 需要时可用简短列表

**编号提纲**（一次提交覆盖多个相关意图时）

- 标题仍是一条 Conventional `type(scope): summary`，写**总意图**
- 正文用 `1. 2. 3.` 列出子意图，每条一行
- 条目只写中文短语，**不要**再写 `feat(ai):` 这类 type/scope
- 适用：用户明确要求一笔提交、且 diff 跨多个相关能力
- 不适用：单点小改、或用户未要求合并时（此时仍按 §3 拆批，用默认短段落）

```text
feat(ai): 对齐工作台主题导航并补齐各工具真实交互

1. 工作台深浅色 token 与顶栏主题设置
2. 导航缓存并让后台启用入口同步工具状态
3. 对话先建会话并补齐额度与游客限制
4. 图视频历史详情与生成参数落库
```

### 2.5 footer（可选）

```text
BREAKING CHANGE: <说明>
Closes #123
```

---

## 3. 原子性与分批

- **一次 commit = 一个逻辑变更**
- 用户说「全部提交」时：按逻辑拆多批，依次 commit，并在对话中列出本批与剩余批次
- 无关改动（格式化大扫除、无关重构）不要塞进功能 commit

---

## 4. 执行步骤（必须按序）

1. **确认授权**；无授权则只可起草 message，停止
2. 并行查看：`git status`、`git diff` / `git diff --staged`、`git log -5 --oneline`
3. 决定暂存范围；`git add` 仅相关文件
4. 自检暂存区：无 §5 禁止项
5. 按 §2 起草 message：单点用默认短段落，多意图合并用编号提纲；复杂时先向用户展示再等一句确认（若用户已说「按规范直接提交」则可直接 commit）
6. 使用 HEREDOC 提交：

```bash
git commit -m "$(cat <<'EOF'
type(scope): 摘要

可选正文。
EOF
)"
```

7. `git status` 确认成功
8. 仅在用户授权后 `git push`

---

## 5. 禁止提交

| 路径 / 类型 | 原因 |
| --- | --- |
| `content-local/` | 小册正文，走 rsync / COS |
| `**/node_modules/` | lockfile 还原 |
| `apps/user-web/mock/data/local-booklets.generated.ts` | 本地生成物 |
| `.env` / `*.pem` / 密钥 | 安全 |
| `.umi/` / `dist/` / `.turbo/` / `.cache/` | 构建产物 |

远程：`https://github.com/orangejava/personal-hub.git`（`main`）。小册与代码分离。

---

## 6. 附录：首次入库批次（历史）

以下批次在 2026-07 已完成，仅作历史参考，**不是**日常流程：

1. monorepo 骨架 → 2. shared-types → 3. docs/study → 4. react-web → 5/6. booklet + PM2
