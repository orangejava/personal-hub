# Commit message 示例

## 推荐

```text
feat(booklet): 本地小册同步支持白名单
```

```text
fix(reader): 章节列表接口不再返回正文

避免一次下发整本数百章 body，与正式 API 契约对齐。
```

```text
docs(deploy): 将部署文档迁入 docs/deploy
```

```text
chore(agents): 新增跨工具 git-commit skill
```

```text
feat(api)!: 阅读进度字段改名为 progressPercent

BREAKING CHANGE: 客户端需改用 progressPercent，旧字段 progress 已移除。
```

## 避免

```text
update
fix bug
提交代码
临时保存
wip
```

```text
feat: 修改了 apps/user-web/src/pages/... 和 mock/... 等等很多文件
```
（应写意图，而非文件清单。）
