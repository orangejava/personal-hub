# packages/shared-types 开发规范

> 适用：`packages/shared-types` 下所有类型定义

## 定位

前后端共享的业务类型、枚举、接口响应结构、分页结构。供 `apps/react-web`、未来 `apps/next-web`、`apps/api` 共用，避免各写一套。

## 规则

- 只导出**类型、接口、枚举及只读常量映射**（如 `XxxLabel`），不放运行时业务逻辑。
- 不引入 React、Umi、NestJS 等框架依赖，保持纯类型包。
- 文件按域拆分：`common`、`pagination`、`user`、`permission`、`auth`、`content`、`booklet`、`workspace`、`system`，统一从 `src/index.ts` 出口。
- 字段命名贴近后续 NestJS API 与数据库表结构（见 `docs/backend/canonical-api.md`、`docs/backend/canonical-data-model.md`）。
- 新增类型必须同步更新 `src/index.ts` 导出。
- 枚举用 `enum`，并提供配套中文标签 `XxxLabel` 供 UI 展示。

## 引用

- 在 React 工程中：`import { ContentType } from '@personal-hub/shared-types'`。
- 包内不编译产物，直接以 `src/index.ts` 作为入口（`main`/`types`/`exports` 均指向源码）。

## 校验

- `pnpm --filter @personal-hub/shared-types typecheck`。
