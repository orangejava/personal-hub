# Prisma + PostgreSQL 学习手册

> 面向第一次认真做数据建模的前端开发者。
> 最后更新：2026-06-01

---

## 1. 先把这两者分别当成什么

### PostgreSQL

它是你的真实数据存储。

你要关心：

- 表
- 字段
- 关系
- 索引
- 约束

### Prisma

它是你用 TypeScript 操作 PostgreSQL 的桥梁。

你要关心：

- `schema.prisma`
- migration
- generate
- 查询 API

---

## 2. 当前项目里，为什么这部分特别重要

这个项目不是简单 CRUD 后台，而是有多条复杂业务线：

- 用户与权限
- 内容与分类标签
- AI 会话与消息
- 收藏与阅读进度
- 系统配置与日志

如果表结构一开始想不清楚，后面接口和页面都会越来越别扭。

---

## 3. 你先只学这 6 件事

1. model 怎么写
2. 一对多关系
3. 多对多关系
4. 唯一约束
5. 索引
6. `migrate dev / generate / studio`

---

## 4. 一套最小工作流

```text
改 schema.prisma
→ 执行 migrate dev
→ Prisma Client 生成
→ 用 Studio 或接口验证数据
```

常用命令：

```bash
pnpm --filter server prisma:migrate
pnpm --filter server prisma:generate
pnpm --filter server prisma:studio
```

---

## 5. 这个项目里，你先要建哪几类表

### 第一组：认证与权限

- `users`
- `roles`
- `permissions`
- `user_roles`
- `role_permissions`
- `refresh_tokens`

### 第二组：内容系统

- `contents`
- `content_chapters`
- `categories`
- `tags`
- `content_tags`
- `favorites`
- `reading_records`
- `files`

### 第三组：AI 系统

- `ai_sessions`
- `ai_messages`
- `ai_usage_logs`
- `token_transactions`
- `ai_models`
- `ai_providers`

---

## 6. 你现在最该掌握的建模问题

每建一张表，都先问这 5 个问题：

1. 这张表的主键是什么
2. 它属于哪个业务域
3. 它和别的表是一对多还是多对多
4. 哪些字段必须唯一
5. 哪些字段未来一定会被筛选或排序

---

## 7. 以内容系统为例，怎么思考关系

### `Content` 和 `Category`

通常先做一对多：

- 一个分类下有多篇内容
- 一篇内容属于一个主分类

### `Content` 和 `Tag`

通常做多对多：

- 一篇内容可有多个标签
- 一个标签可被多篇内容使用

### `Content` 和 `ContentChapter`

一对多：

- 一篇小册内容下有多个章节

---

## 8. 为什么索引和唯一约束要早点想

前端开发者转全栈时，容易把字段当成“只是数据”。

但这些约束其实是在定义业务规则：

- `slug` 唯一：决定内容 URL 是否稳定
- `email` 唯一：决定注册是否安全
- `(user_id, content_id)` 唯一：决定收藏是否会重复

索引则影响：

- 列表页速度
- 后台筛选速度
- 搜索和排序体验

---

## 9. 当前项目最常见的几个坑

### 坑 1：先写接口，再凑表结构

这样很容易导致表设计是临时补丁式的。

更好的顺序：

- 先明确核心实体
- 再明确关系
- 再写 Prisma Schema
- 最后写接口

### 坑 2：不用迁移，只手改数据库

这会让团队和环境状态失控。

### 坑 3：多对多关系想得太晚

内容标签、角色权限这类关系，后面补救成本比较高。

### 坑 4：没有状态字段

内容系统至少要提前想：

- 草稿
- 已发布
- 已下线

---

## 10. 当前阶段最小实践任务

1. 建 `User` 表
2. 建 `Role` 与 `Permission` 相关表
3. 建 `Content`、`Category`、`Tag`
4. 完成一次 migration
5. 用 Prisma 查一条内容详情
6. 给 `slug` 和 `email` 加唯一约束

---

## 11. 学完后至少要达到什么标准

1. 能自己改 `schema.prisma`
2. 能完成 migration
3. 能解释一对多和多对多
4. 能知道哪些字段要加唯一约束
5. 能写基本的分页查询

---

## 12. 遇到问题先怎么排查

1. 关系字段两端是否都定义正确
2. migration 是否真的执行成功
3. 查询字段名和 Prisma 生成类型是否一致
4. 是否遗漏了唯一约束或索引
5. 问题是 Prisma 层，还是数据库真实结构不一致

> 你后面做得顺不顺，很多时候不是页面决定的，而是数据模型是不是一开始就想清楚了。
