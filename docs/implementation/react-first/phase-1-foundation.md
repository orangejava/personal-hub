# 阶段 1：基础底座

## 1. 目标与范围
- 搭建 `apps/react-web` 的运行底座：全局初始状态、权限、请求封装、mock 数据层。
- 让后续业务页面只关心「调用 service、读 model、渲染」，不重复处理鉴权与错误。
- 非目标：真实后端、真实数据库、AI 能力。

## 2. 页面与入口
- 登录页 `src/pages/user/login`：三套 mock 账号（admin / editor / member），提交后写 token 并跳工作区。
- 工作区/Admin 占位页 `src/pages/workspace/*`、`src/pages/admin/Home`。

## 3. 接口与数据流
统一响应 `ApiResponse<T> = { code, message, data }`，`code === 0` 视为成功。

数据流：
```
mock/*.ts 路由 ──► request 拦截器(错误码/401) ──► service(*.ts) ──► useRequest/useModel ──► 页面
                                       └─ getInitialState 拉取 currentUser/permissions/menu/systemConfig
```

关键约定：
- `useRequest` 默认 `formatResult: r => r?.data`，所以组件里 `data` 直接是 `T`，不是 `ApiResponse<T>`。
- `getInitialState` 在 `src/app.tsx`，结构定义在 `src/types/app.ts` 的 `InitialState`。
- `access.ts` 依据 `initialState.permissions`（`PermissionCode[]`）生成 `canAdmin / canEdit` 等。

## 4. 关键实现
- `src/app.tsx`：`getInitialState` 并发拉取用户/权限/菜单/系统配置；`layout` 基于 `InitialState` 动态生成 ProLayout 菜单；`request` 配置统一 header 与错误处理。
- `src/requestErrorConfig.ts`：`errorHandler` 处理 `ApiResponse` 业务错误与 401 跳转。
- `src/access.ts`：从 `PermissionCode` 派生访问函数。
- mock 分层：
  - `mock/*.ts`：路由定义（`'GET /api/xxx'`）。
  - `mock/data/*.ts`：纯数据，被路由文件 import。
  - `mock/utils.ts`：`ok / fail / parsePagination / waitTime`，需在 `config.ts` 的 `mock.exclude` 排除，避免被当作路由扫描。
- `config/config.ts`：`mock.include = ['mock/*.ts', ...]` 只扫顶层文件，避免把 `mock/data` 目录当模块加载。

## 5. 权限与异常
- 权限码集中在 `@personal-hub/shared-types` 的 `PermissionCode`。
- 401 → 清 token → 跳 `/user/login`；业务 `code !== 0` → message 提示。

## 6. 验证方式
- `npx tsc --noEmit` 0 错误；`npx biome check src mock` 通过。
- `curl http://localhost:8000/api/system/config` 返回 `code:0`。
- 用 admin 登录后菜单出现「后台管理」，member 不出现。

## 7. 已知限制与后续扩展
- mock 仅内存态，刷新后写入内容丢失；阶段 4+ 接 NestJS 后替换 service 实现即可。
- 权限目前只控制菜单与路由 `access`，按钮级细粒度待 `PermissionGate` 在业务页铺开。
