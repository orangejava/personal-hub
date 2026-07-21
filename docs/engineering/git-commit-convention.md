# Git Commit 规范

> 适用于 `personal-hub` 仓库。AI 与人工提交均遵循本文件。
> 相关规则：`.cursor/rules/git-commit-authorization.mdc`（未授权不得 commit）

---

## 1. 授权原则

- **默认不 commit**：功能做完 ≠ 可以提交。
- **仅当用户明确授权**时才执行 `git commit` / `git push`。
- 授权话术示例：「提交第 1 批」「可以 commit」「推送到 GitHub」。

---

## 2. Conventional Commits 格式

```text
<type>(<scope>): <summary>

[optional body]

[optional footer]
```

### 2.1 type（必填）

| type | 含义 | 示例 |
| --- | --- | --- |
| `feat` | 新功能 | `feat(booklet): add sync allowlist` |
| `fix` | 修复缺陷 | `fix(reader): chapter list omit body` |
| `docs` | 仅文档 | `docs: add server deployment plan` |
| `chore` | 工程杂项（依赖、配置、脚本） | `chore: bootstrap monorepo workspace` |
| `refactor` | 重构（无行为变化） | `refactor(api): extract storage provider` |
| `style` | 格式（不影响逻辑） | `style: format prettier ignore` |
| `test` | 测试 | `test(booklet): cover allowlist filter` |
| `perf` | 性能 | `perf(mock): slim chapter list payload` |
| `ci` | CI/CD | `ci: add github actions lint` |
| `build` | 构建系统 | `build: bump turbo config` |

### 2.2 scope（可选，推荐）

常用 scope：`react-web`、`shared-types`、`booklet`、`docs`、`ops`、`mock`、`api`。

### 2.3 summary（必填）

- 使用英文祈使句，或中文简述均可；**同一仓库保持一种习惯**（本仓库推荐：**英文 type + 中文或英文 summary 均可，优先简洁中文说明意图**）。
- 聚焦 **why**，不要堆文件列表。
- 不超过约 72 字符。
- 句末不加句号。

**推荐示例：**

```text
chore: 初始化 monorepo 工作区与基础工具链
feat(booklet): 本地小册同步支持白名单
docs(ops): 补充阶段 A 服务器目录与部署步骤
```

**避免：**

```text
update
fix bug
提交代码
```

### 2.4 body（可选）

说明动机、影响范围、破坏性变更。与 summary 空一行分隔。

---

## 3. 禁止提交的内容

| 路径 / 类型 | 原因 |
| --- | --- |
| `content-local/` | 小册正文，体积大，走 rsync / 后续 COS |
| `**/node_modules/` | 依赖用 lockfile 还原 |
| `apps/react-web/mock/data/local-booklets.generated.ts` | 本地生成物 |
| `.env` / `*.pem` / 密钥 | 安全 |
| `.umi/` / `dist/` / `.turbo/` | 构建缓存与产物 |

---

## 4. 分批入库约定（当前仓库）

首次将本地工程推上 GitHub 时，按下列批次提交（每批一次 commit）：

| 批次 | 内容 | 建议 message |
| --- | --- | --- |
| 1 | 工作区骨架、工具链、gitignore、commit 规范与授权规则 | `chore: 初始化 monorepo 工作区与提交规范` |
| 2 | `packages/shared-types` | `feat: 新增 shared-types 共享类型包` |
| 3 | `docs/`、`study/`、`completed/`、`AGENTS.md` 等文档 | `docs: 补充产品、工程与学习文档` |
| 4 | `apps/react-web` 主体（排除生成物与依赖） | `feat: 新增 react-web 应用与 mock 服务` |
| 5 | 小册白名单同步、mock 章节列表瘦身等（若未进第 4 批） | `feat(booklet): 白名单同步并精简章节列表 mock` |
| 6 | `ecosystem.dev.cjs`、部署相关收尾 | `chore(ops): 增加阶段 A PM2 与部署辅助` |

批次可按实际 diff 微调，但**不要**一次把全部未跟踪文件打成一个巨型 commit。

---

## 5. 操作检查清单（每次 commit 前）

1. `git status` / `git diff` 确认暂存范围正确  
2. 确认无密钥、无 `content-local`、无 `node_modules`  
3. message 符合本规范  
4. 用户已授权本批 commit  
5. commit 后 `git status` 确认成功  
6. 仅在用户授权 push 时执行 `git push`

---

## 6. 与远程仓库

- 生产远程：`https://github.com/orangejava/personal-hub.git`
- `main` 为默认分支
- 小册与代码分离：Git 只管代码；服务器小册用 rsync
