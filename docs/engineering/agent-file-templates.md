# 目录级 AGENT.md 模板

> 状态：规划中
> 最后更新：2026-06-27
> 目标：工程创建后，在前端、运营端、后端目录分别放置局部开发规范，避免后续实现细节漂移。
>
> ⚠️ **当前阶段已按 React-first 落地**：实际目录级规范见
> `apps/react-web/AGENT.md`（含 `.agent/` 分模块细则）与 `packages/shared-types/AGENT.md`。
> 下方前端模板最初按 Next.js（`apps/web`）路径编写，仅保留为未来 `apps/next-web` 参考；后端模板适用于下一阶段的 `apps/server`。
> React-first 阶段请以上述实际 AGENT.md 为准。

---

## 1. 落地位置

工程骨架创建后，应新增：

| 文件                          | 适用范围                         |
| ----------------------------- | -------------------------------- |
| `apps/web/AGENT.md`           | 公开前台 + 工作区 + Web 通用规范 |
| `apps/web/app/admin/AGENT.md` | 运营端 / 后台管理台专用规范      |
| `apps/server/AGENT.md`        | 后端 NestJS 专用规范             |

说明：

- 当前工程目录还没创建，所以本文件先保存模板。
- 真正搭建工程时，应把下方模板复制到对应目录。
- 如果后续目录调整，必须同步更新本文件和实际 `AGENT.md`。

---

## 2. `apps/web/AGENT.md` 模板

```md
# Web 前台与工作区开发规范

## 适用范围

本文件适用于 `apps/web` 下除 `/app/admin` 之外的前台、工作区和 Web 通用代码。

## 技术栈

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui + Radix UI
- TanStack Query
- Zustand
- react-hook-form + zod

## 页面开发规则

- 默认使用 Server Component。
- 只有需要状态、事件、副作用、浏览器 API、TanStack Query、Zustand 时才使用 Client Component。
- SEO 页面优先服务端取数：首页、内容列表、内容详情、关于我、项目页。
- 工作区和 AI 工具页可使用 Client Component + TanStack Query。

## 主题与导航

- 不允许在页面中硬编码主题色、站点名称、导航位置。
- 主题色必须来自公开系统配置，并转换为 CSS Variables。
- 前台导航位置支持 `top` / `left` / `right`。
- 阅读页应优先保证正文区域，不得因导航位置配置挤压核心阅读区。

## 组件目录

- `components/ui`：shadcn/ui 基础组件，尽量不写业务逻辑。
- `components/public`：公开前台业务组件。
- `components/workspace`：登录后工作区业务组件。
- `components/shared`：跨区域共享组件。

## 请求与状态

- 服务端组件优先使用封装后的服务端 fetch。
- 客户端服务端状态使用 TanStack Query。
- 客户端全局状态使用 Zustand。
- 不要用 Zustand 缓存所有接口列表数据。
- API 函数放在 `lib/api`，不要在组件中散落 axios 调用。

## 表单

- 表单使用 react-hook-form。
- 校验使用 zod。
- 表单字段需要写清业务含义、默认值和错误提示。

## 内容阅读

- Markdown 正文默认使用后端返回的安全 HTML。
- 渲染 HTML 必须确认已 sanitize。
- 代码块复制、目录定位、阅读进度保存应拆成独立组件或 Hook。

## 注释

- 复杂 Hook、配置转换、阅读进度、权限判断需要中文 JSDoc。
- 简单 JSX 布局不需要为了注释而注释。
```

---

## 3. `apps/web/app/admin/AGENT.md` 模板

```md
# 运营端 / 后台管理台开发规范

## 适用范围

本文件适用于 `apps/web/app/admin` 及后台管理相关组件。

## 技术栈

- Next.js App Router
- Ant Design v5
- @ant-design/pro-components
- TanStack Query
- TypeScript

## 定位

后台管理台负责运营配置和数据管理，不追求前台强视觉表现，优先保证信息密度、表格效率、表单稳定性和权限安全。

## UI 规则

- 后台优先使用 Ant Design 和 Pro Components。
- 不在后台大面积使用 shadcn/ui。
- 表格优先使用 ProTable。
- 复杂表单优先使用 ProForm。
- 删除、下线、禁用等危险操作必须二次确认。

## 配置管理

- 主题色、导航位置、站点信息、功能开关统一从系统配置读取和保存。
- 配置表单需要提供默认值、校验、保存失败提示。
- 保存配置后，需要考虑前台缓存失效或重新拉取。

## 权限规则

- `/admin/*` 仅管理员可访问。
- 前端按钮显隐只改善体验，真正权限校验必须依赖后端。
- 无权限访问跳转 403。

## 请求规则

- 管理端 API 函数放在 `lib/api/admin` 或明确的 admin API 文件中。
- 表格筛选条件应与 URL 或 ProTable state 保持可恢复。
- 不在页面组件里直接拼装复杂请求参数，优先封装转换函数。

## 文档同步

- 新增后台配置项时，同步更新 `docs/prd/react-first/theme-navigation-config-prd.md` 或对应 PRD。
- 新增后台模块时，同步更新 `docs/product/admin.md` 和对应 PRD。
```

---

## 4. `apps/server/AGENT.md` 模板

```md
# 后端 API 开发规范

## 适用范围

本文件适用于 `apps/server` 下所有 NestJS 后端代码。

## 技术栈

- NestJS
- Fastify Adapter
- Prisma
- PostgreSQL
- Redis
- Swagger
- class-validator / class-transformer

## 模块边界

- 每个业务域必须独立模块：module / controller / service / dto。
- Controller 只负责协议、参数、状态码，不写业务规则。
- Service 负责业务流程和数据访问编排。
- 跨模块调用通过依赖注入，不直接跨目录访问内部实现。

## 扩展性规则

- 新增功能优先考虑是否需要独立模块。
- 可运营配置进入 `system_configs`，不要硬编码。
- 权限点必须进入权限枚举和 seed，不要只写在 Guard 字符串里。
- 复杂能力预留扩展字段时优先使用明确字段；确实不稳定的类型专属信息可放 JSONB。

## DTO 与校验

- 所有写接口必须有 DTO。
- DTO 字段必须用 class-validator 校验。
- Swagger 装饰器要写清字段含义。
- 不信任前端传参，权限和归属关系必须后端校验。

## 统一响应与异常

- 所有接口走统一响应结构。
- 业务错误使用统一错误码。
- 不向前端暴露数据库原始错误。
- 全局异常过滤器负责格式化错误。

## Prisma 规则

- Prisma 查询不写在 Controller 中。
- 删除数据前检查关联关系。
- 涉及事务的创建/导入/批量操作必须使用 transaction。
- 查询列表必须分页。

## 内容与阅读

- Markdown 渲染后 HTML 必须 sanitize。
- 小册章节必须校验属于对应 content。
- 阅读记录 upsert 时必须校验当前用户和内容权限。

## 注释

- 核心 Service 方法需要中文 JSDoc，说明用途、参数、返回值和副作用。
- 复杂权限判断、事务、导入流程必须写中文注释解释业务原因。
```

---

## 5. 后续维护

- 如果实际开发中修改了目录结构，先改真实 `AGENT.md`，再同步本模板。
- 如果某个模块出现专属复杂规范，可以在模块目录下继续增加更细的 `AGENT.md`。
- 局部 `AGENT.md` 不应与根目录 `AGENTS.md` 冲突，只做更具体的补充。
- 每次功能完成后，相关实现文档统一进入 `docs/implementation/`，相关学习文档统一进入 `study/features/`，局部 `AGENT.md` 可以补本目录更细的命名约定，但不要改变总归档位置。
