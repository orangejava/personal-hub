# React 功能到 Canonical Nest 后端需求总览

> 状态：🟢 已确认；后续开发按领域 PRD、Canonical API 和数据模型拆分
> 最后更新：2026-08-02
> 目的：把 React-first 已实现的页面/Mock 能力映射到不依赖 React 的 NestJS 领域要求。

---

## 1. 客户端长期边界

| 当前 React 区域                        | 长期客户端归属 | Nest API 分区      |
| -------------------------------------- | -------------- | ------------------ |
| 首页、内容中心、详情、小册、项目、关于 | Next           | `/api/v1/public/*` |
| 登录后工作区、收藏、阅读、资料、AI     | Next           | `/api/v1/app/*`    |
| 管理后台                               | React          | `/api/v1/admin/*`  |
| 登录、会话、刷新、注册                 | 全部客户端     | `/api/v1/auth/*`   |

React-first 文档记录当前实现阶段；不得再把其 mock 路径当成长期后端路径。

## 2. 功能映射

| React 功能           | Nest 领域                     | 必须实现的后端行为                                                                  |
| -------------------- | ----------------------------- | ----------------------------------------------------------------------------------- |
| 登录/登出/路由权限   | Auth、Session、RBAC           | 8 小时 Access、7 天 Refresh Cookie、版本化会话、单角色、动作权限 + OWN/ALL 数据范围 |
| 公开内容/详情/搜索   | Content、Category、Tag        | published/visibility SQL 过滤、LOGIN 锁定摘要、私有资源 404、公开 slug 筛选         |
| Markdown/富文本创作  | Content、ContentBody、Version | 草稿、发布/归档、快照、Markdown 源文、富文本 JSON + 净化 HTML                       |
| 小册阅读             | Booklet、Storage              | 章节索引与正文分离、单章按需读取、私有导入限制                                      |
| ZIP 小册导入         | Upload、BookletImport、Queue  | 预签名上传、异步任务、Zip 安全校验、失败重试、CLI 迁移存量小册                      |
| 收藏/继续阅读        | Favorite、Reading             | 用户归属、幂等收藏、章节级进度、最近阅读                                            |
| 个人资料/设备管理    | User、Session                 | 资料 PATCH、头像 FileAsset、设备列表、撤销其他会话、邮箱变更验证                    |
| AI Chat/文本         | AI Conversation、Quota        | 服务端 SSE 持久化、匿名 30 天历史、预占/结算、Stop/Variant 语义                     |
| AI 图片/视频/资产    | AI Generation、Asset、File    | 图片异步任务、视频 MockProvider、轮询、文件夹、软删除                               |
| AI 模板/权益         | AI Template、Entitlement      | 系统与私有模板、角色/套餐的只读权益，不接支付                                       |
| Admin 用户/角色/日志 | Admin、RBAC、Audit            | 用户状态/角色变更即时失效、super_admin 保护、分级审计                               |
| Admin 内容/分类/文件 | Admin、Content、File          | 跨作者管理、分类树、标签引用保护、30 天内容回收、7 天文件回收                       |
| Admin AI/配置/菜单   | Admin、AI、System、Menu       | 资源写 + BFF 聚合读、密钥环境变量、类型化配置注册表、菜单 UUID CRUD                 |

## 3. 与 Mock 的明确差异

| Mock 临时行为             | Canonical 行为                           |
| ------------------------- | ---------------------------------------- |
| localStorage 长期 token   | Access 只在内存，Refresh HttpOnly Cookie |
| HTTP 200 + 数字 code      | HTTP 语义状态 + `error.code`             |
| `/workspace/*`            | `/app/*`                                 |
| 前端流式后再 persist Chat | Nest SSE 期间创建和更新消息              |
| 前端主动扣 AI 配额        | 服务端原子预占与实际结算                 |
| 管理菜单整树 PUT          | 菜单项 UUID CRUD + 批量排序              |
| 同步图片/导入             | 资源化异步任务 + 轮询                    |
| 内容/文件物理删除         | 内容 30 天软删；文件 7 天延迟物理清理    |

## 4. 开发顺序

1. `apps/server` 脚手架、环境校验、Prisma、Redis、Health、OpenAPI。
2. Auth/User/RBAC/Session/邮件，接入 React 登录和基础权限。
3. SystemConfig/Menu/公开配置，接入首页与导航。
4. Content/Category/Tag/Favorite/Reading，接入公开阅读与工作区。
5. Storage/Upload/BookletImport/CLI，接入文件和小册。
6. AI 基础、额度账本、SSE、图片任务、资产库。
7. Admin 聚合、审计、后台配置和统计。

每个阶段开始前，必须完成以下“领域实施前契约检查清单”；不把本总览当成跳过细节设计的理由：

1. **DTO / OpenAPI**：请求、成功响应、分页或 cursor、字段可选性与 SSE/异步事件均已定义，可作为客户端类型来源。
2. **枚举 / 错误码**：固定枚举使用 `UPPER_SNAKE_CASE`，领域错误码、HTTP 状态、幂等要求和部分成功语义明确。
3. **权限 / 数据范围**：每个 Controller 动作权限、每个资源用例的 `OWN/ALL` 条件、super_admin 保护与审计要求可唯一推导。
4. **迁移 / 索引**：Prisma migration、唯一约束、查询索引、软删除和数据回填/回滚策略已审阅。
5. **测试 / 前端适配**：单元、集成、HTTP E2E 场景以及 React Mock Adapter 的替换范围、环境变量和 Fake Provider 均列入该阶段验收。
