# MVP 开发排期

> 状态：🟢 已完成
> 最后更新：2026-06-09
> 说明：这份文档只关注阶段目标、优先级和里程碑；具体执行步骤请看 `development-plan.md`。

---

## 1. 三个版本层级

```text
MVP（可用版）       → 工程骨架 + 配置底座 + 内容阅读闭环
增强版（可运营版）   → 内容生产 + 后台运营 + AI 工具闭环
平台版（成熟版）     → 认证增强 + 部署体系 + Flutter + 搜索/计费扩展
```

---

## 2. 当前推荐阶段顺序

1. 工程骨架
2. 配置与布局底座
3. 内容阅读闭环
4. 内容生产闭环
5. 后台运营闭环
6. AI 工具闭环
7. 认证与权限增强
8. 测试、部署、上线
9. Flutter 接入

---

## 3. 阶段里程碑

## 阶段 0：工程骨架

### 目标

- 建立 `web + api + db + redis` 的可运行工程。

### 关键任务

- [ ] 初始化 Monorepo、Next.js、NestJS、Prisma、Docker Compose
- [ ] 建立 `packages/shared-types`
- [ ] 落地目录级 `AGENT.md`

### 参考文档

- [Nest Server 脚手架 PRD](../prd/long-term/nest-server-bootstrap-prd.md)
- [agent-file-templates.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/engineering/agent-file-templates.md)
- [历史执行手册](./development-plan.md)

### 阶段完成标记

- [ ] `pnpm dev` 可启动
- [ ] Swagger 可访问
- [ ] 数据库连接正常

---

## 阶段 1：配置与布局底座

### 目标

- 跑通主题色、导航位置、公开配置读取链路。

### 关键任务

- [ ] 建立 `system_configs`
- [ ] 完成 `/api/system/config/public` 与 `/api/system/theme`
- [ ] 前台支持主题色和导航位置切换
- [ ] 后台支持主题与导航配置保存

### 参考文档

- [theme-navigation-config-prd.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/prd/react-first/theme-navigation-config-prd.md)
- [Canonical API](../backend/canonical-api.md)
- [Canonical 数据模型](../backend/canonical-data-model.md)

### 阶段完成标记

- [ ] 主题配置可影响前台
- [ ] 导航布局可切换

---

## 阶段 2：内容阅读闭环

### 目标

- 最先交付 Markdown 与掘金小册阅读能力。

### 关键任务

- [ ] 内容列表与详情接口
- [ ] Markdown 阅读页
- [ ] 小册章节阅读页
- [ ] 收藏与阅读进度

### 参考文档

- [content-reading-prd.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/prd/react-first/content-reading-prd.md)
- [product/content-system.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/product/content-system.md)
- [Canonical API](../backend/canonical-api.md)

### 阶段完成标记

- [ ] Markdown 可阅读
- [ ] 小册可分章阅读
- [ ] 阅读进度可恢复

---

## 阶段 3：内容生产闭环

### 目标

- 交付工作区创建、编辑、导入和发布能力。

### 关键任务

- [ ] 我的内容列表
- [ ] Markdown 编辑器
- [ ] 小册 ZIP 导入
- [ ] 草稿 / 发布 / 归档

### 参考文档

- [content-workspace-prd.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/prd/react-first/content-workspace-prd.md)
- [product/workspace.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/product/workspace.md)
- [Canonical 数据模型](../backend/canonical-data-model.md)

### 阶段完成标记

- [ ] 能创建 Markdown 内容
- [ ] 能导入一本小册
- [ ] 能从工作区发布内容

---

## 阶段 4：后台运营闭环

### 目标

- 交付管理员后台常用运营能力。

### 关键任务

- [ ] 内容管理
- [ ] 分类与标签管理
- [ ] 首页配置
- [ ] 菜单与系统配置
- [ ] 操作日志

### 参考文档

- [后台内容与配置历史 PRD](./admin-content-config-prd.md)
- [product/admin.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/product/admin.md)
- [Canonical API](../backend/canonical-api.md)

### 阶段完成标记

- [ ] 管理员能运营内容和配置
- [ ] 关键操作有日志

---

## 阶段 5：AI 工具闭环

### 目标

- 交付 Chat、文本生成、图片生成和用量统计。

### 关键任务

- [ ] AI 工具广场
- [ ] Chat 多会话与 SSE
- [ ] 文本生成场景
- [ ] 图片生成
- [ ] 模型配置与用量统计

### 参考文档

- [ai-tools-prd.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/prd/long-term/ai-tools-prd.md)
- [product/ai-tools.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/product/ai-tools.md)
- [Canonical API](../backend/canonical-api.md)

### 阶段完成标记

- [ ] 三类 AI 工具可用
- [ ] Token 用量可追踪

---

## 阶段 6：认证与权限增强

### 目标

- 补齐正式登录、RBAC、管理权限与安全控制。

### 关键任务

- [ ] 注册 / 登录 / 刷新 / 登出
- [ ] 角色、权限、菜单权限
- [ ] 工作区与后台守卫

### 参考文档

- [auth-rbac.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/product/auth-rbac.md)
- [Canonical API](../backend/canonical-api.md)
- [Canonical 数据模型](../backend/canonical-data-model.md)

### 阶段完成标记

- [ ] 工作区与后台受保护
- [ ] 角色权限可验证

---

## 阶段 7：测试、部署、上线

### 目标

- 形成可重复执行的上线链路。

### 关键任务

- [ ] 构建、Lint、测试
- [ ] Docker Compose 生产配置
- [ ] HTTPS、域名、环境变量
- [ ] 备份与回滚

### 参考文档

- [deployment.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/deploy/deployment.md)
- [历史执行手册](./development-plan.md)

### 阶段完成标记

- [ ] 生产环境可访问
- [ ] 部署流程已文档化

---

## 阶段 8：Flutter 接入

### 目标

- 在 Web 核心流程稳定后接入移动端。

### 关键任务

- [ ] 复用登录、阅读、收藏、AI Chat API
- [ ] 处理移动端缓存和进度同步

### 参考文档

- [flutter.md](/Users/wangchaocheng/Documents/Code/git/projects/personal-hub/docs/product/flutter.md)
- [历史执行手册](./development-plan.md)

### 阶段完成标记

- [ ] Flutter 跑通最小闭环

---

## 4. 文档同步要求

每完成一个阶段，至少同步这三类内容：

- 受影响的 `docs/backend/` 或 `docs/product/` 文档
- 对应实现文档到 `docs/implementation/`
- 对应学习文档到 `study/features/`
