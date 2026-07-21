# 阶段 4/5 规划与菜单分组调整记录

> 状态：已完成本轮规划整理
> 最后更新：2026-07-04
> 对应 PRD：[../../prd/react-first/phase-4-admin-preview-prd.md](../../prd/react-first/phase-4-admin-preview-prd.md)、[../../prd/react-first/phase-5-ai-platform-prd.md](../../prd/react-first/phase-5-ai-platform-prd.md)

## 1. 目标与范围

本轮不是完整开发阶段 5，而是先把阶段 4 收尾、阶段 4.5 体验底座、阶段 5 AI 平台的文档和菜单信息架构定稳。

本轮解决：

- 明确阶段 4 当前还不能标记完成。
- 补充阶段 4 后台配置缺口和收尾顺序。
- 将网站体验优化前置为阶段 4.5。
- 重写阶段 5 AI 平台 PRD，补齐 AI 独立工作台、侧边栏、页面布局、mock 和验收。
- 优化 React-first PRD 文件命名，去掉目录内重复的 `react-first` 前缀。
- 调整后台菜单分组：内容管理、AI 管理、系统管理。

## 2. 关键结论

阶段 4 当前是“可体验后台骨架”，还不是“完成态”。P0 仍需补首页配置联动、菜单配置联动、内容状态 mock 持久更新；P1 需要补分类树、文件引用校验和操作日志写入。

阶段 5 可以只有前端先做，但应在 AI 专属布局、mock 契约和体验组件明确后再开发。AI 平台会隐藏公开顶部导航，使用独立左侧工作栏承载创作、资产、会员、教程、API 等入口。

全站体验优化建议放在阶段 4.5：先统一 loading、骨架屏、空状态、错误态、基础动效，再进入阶段 5。这样后续开发 AI 页面时可以直接复用，不需要等功能很多后再返工。

## 3. 后台菜单调整

后台菜单分组调整为：

- `运营概览`
- `内容管理`：文档列表、小册管理、分类管理、标签管理、文件管理、首页配置
- `系统管理`：用户管理、角色管理、菜单管理、系统配置、主题配置、操作日志

阶段 5 再新增：

- `AI 管理`：AI 配置、AI 统计、工具配置、套餐配置

文件管理归入内容管理，因为当前文件主要服务内容预览、封面、附件和后续 AI 资产引用。用户管理和角色管理归入系统管理，因为它们控制账号、角色和平台访问边界。

## 4. 文档命名调整

`docs/prd/react-first/` 内文件已改名为更清楚的阶段名：

- `bootstrap-prd.md`
- `phase-0-3-foundation-prd.md`
- `phase-4-admin-preview-prd.md`
- `phase-5-ai-platform-prd.md`
- `phase-5-5-next-api-bridge-prd.md`

这样打开 `react-first` 文件夹时，不再重复看到 `react-first-*` 前缀。

## 5. 验证方式

本轮需要验证：

1. `corepack pnpm --filter react-web biome:lint`
2. `corepack pnpm typecheck`
3. 打开 `/admin/dashboard`，确认侧边栏分组符合新结构。

## 6. 后续动作

1. 做阶段 4 P0 收尾：首页配置、菜单配置、内容状态 mock。
2. 做阶段 4.5 体验底座：loading、骨架、空态、错误态。
3. 再进入阶段 5 AI Layout 与 AI 首页开发。
