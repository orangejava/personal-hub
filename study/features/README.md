# 功能学习文档归档规范

> 状态：规划中
> 最后更新：2026-06-09
> 目标：把“这次功能为什么这样做、下次自己怎么做、常见坑是什么”沉淀成可复用学习笔记。

---

## 1. 放在哪里

和具体功能直接相关的学习文档，统一放在 `study/features/` 下。

示例：

- `study/features/content-markdown-reader.md`
- `study/features/content-booklet-import.md`
- `study/features/ai-chat-streaming.md`

`study/` 根目录继续保留项目级、长期复用的通用手册，例如 Next.js、NestJS、Prisma、Docker 学习文档。

---

## 2. 推荐内容结构

- 场景背景：这类需求通常什么时候出现
- 核心概念：需要先理解哪些机制
- 实现步骤：从页面、状态、接口到数据表的顺序
- 关键代码：只摘最能说明问题的片段
- 常见错误：本项目里容易踩坑的位置
- 手动验证：如何自己确认功能正确

---

## 3. 维护要求

- 新增功能学习文档后，同步在本文件追加索引。
- 如果某篇笔记已经沉淀成长期通用手册，再考虑移动到 `study/` 根目录并在 `study/README.md` 更新入口。

---

## 4. 已有文档

- [nest-http-adapter-comparison.md](./nest-http-adapter-comparison.md)：Nest Fastify/Express 技术比较、AI 流式/并发 API 边界与已完成迁移记录。
- [nest-stage0-retrospective.md](./nest-stage0-retrospective.md)：Nest 阶段 0 问题复盘与排障过程；面试题见 [`../interview/`](../interview/README.md)。
- [nest-server-bootstrap.md](./nest-server-bootstrap.md)：NestJS + Express 阶段 0、配置校验、基础设施和健康检查。
- [umi-mock-and-dataflow.md](./umi-mock-and-dataflow.md)：Umi Max mock 数据流与 `useRequest` 自动解包（阶段 1）。
- [markdown-booklet-reading.md](./markdown-booklet-reading.md)：Markdown 渲染、目录、小册阅读、本地同步（阶段 2）。
- [react-first-phase-0-3.md](./react-first-phase-0-3.md)：阶段 0–3 合并复盘（阶段 0–3 收尾与补强）。
- [react-experience-system.md](./react-experience-system.md)：React-first 阶段 4.5 动效、骨架屏、结果态与操作反馈体验系统。
- [ai-platform-mock-workbench.md](./ai-platform-mock-workbench.md)：阶段 5 AI 独立工作台、Ant Design X 本地封装、mock/service 数据流与验收方法。
- [ai-composer-layout.md](./ai-composer-layout.md)：AI 三页统一布局、可配置输入框、配置弹窗和多类型消息渲染。
- [nest-auth-login-slice.md](./nest-auth-login-slice.md)：Nest 登录、内存 Access Token、Refresh Cookie 与 mock 桥接。
- [nest-auth-permissions.md](./nest-auth-permissions.md)：权限快照、菜单过滤、routeKey 注册表与 mock 权限兼容。
- [nest-auth-register.md](./nest-auth-register.md)：公开注册、Mailpit 邮件链接验证与验证赠额幂等。
- [nest-auth-captcha-sessions-password.md](./nest-auth-captcha-sessions-password.md)：登录验证码、设备会话、强制改密、忘记密码与后台踢人。
