# 前后端影响面（短约束）

改 Nest / Canonical API / Prisma / `packages/api-client` / Umi request / services 时，**禁止只改一侧就宣布完成**。

细则见 `.agents/skills/fullstack-impact/SKILL.md`。匹配时**必须加载**；**未贴完整计划且用户未确认前，禁止改业务代码**。

## 硬门槛

- 成功/失败在 **Umi 全局拦截器** 统一处理：解包后页面拿到业务对象 T，失败 throw。禁止再包 `toApiResponse` 迁就 `code === 0`。
- 失败 toast 默认用 Nest `error.message`；写接口不要 `skipErrorHandler`。特定文案写在 `DomainHttpException` 第三个参数。
- 不要因为内容/工作区/AI 仍走 mock 而推迟这套收口；那些页面改成按 T 读取即可。
- 已有 Nest 的路径禁止失败后再打已关闭的 mock。
- 单测绿 ≠ 产品验收过。
- 菜单 `name` / `localeKey` 等产品约定看对应 PRD/实现文档，不在本规则展开。
