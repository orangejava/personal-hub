# apps/admin-web 文档

后台管理台专属文档。产品范围见 `docs/product/admin.md`。

本地 `pnpm dev:admin` 监听 `:8001`（默认无 mock）。需要后台 CRUD mock 时用 `pnpm dev:admin:mock`。资源前缀 `/`。生产若由 Nginx 把 `/admin` 指到本应用静态资源，构建时设置 `PUBLIC_PATH=/admin/`。生产进程模型见仓库 `docs/deploy/nest-compose-strategy.md`（Nginx + Compose，不要用 PM2）。

| 文档 | 内容 |
| --- | --- |
| [prd/phase-4-admin-preview-prd.md](./prd/phase-4-admin-preview-prd.md) | 阶段 4 后台运营 PRD |
| [implementation/phase-4-closeout.md](./implementation/phase-4-closeout.md) | 阶段 4 收尾实现 |
| [implementation/phase-4-review-fixes.md](./implementation/phase-4-review-fixes.md) | 阶段 4 审阅修复 |
| [implementation/phase-4-5-planning.md](./implementation/phase-4-5-planning.md) | 4.5 规划 |
| [implementation/phase-4-5-experience-deepening.md](./implementation/phase-4-5-experience-deepening.md) | 4.5 体验深化 |
