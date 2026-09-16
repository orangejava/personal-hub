# apps/server 文档

Nest 工程约定与已落地切片（M0–M6）。跨端 HTTP/数据契约仍在仓库根 `docs/backend/`。当前产品主线是上线部署，不是 M7，见 [../../docs/deploy/go-live-mainline.md](../../docs/deploy/go-live-mainline.md)。

| 文档 | 内容 |
| --- | --- |
| [conventions.md](./conventions.md) | Nest 工程、事务、Redis、安全、测试约定 |
| [nest-dependency-catalog.md](./nest-dependency-catalog.md) | 依赖组合与版本锁定 |
| [prd/nest-server-bootstrap-prd.md](./prd/nest-server-bootstrap-prd.md) | 脚手架 PRD |
| [implementation/foundation/nest-server-bootstrap.md](./implementation/foundation/nest-server-bootstrap.md) | 阶段 0 实现说明 |
| [implementation/auth/README.md](./implementation/auth/README.md) | M2 Auth 切片 |
| [implementation/system/README.md](./implementation/system/README.md) | M3 系统配置与菜单 |
| [implementation/content/README.md](./implementation/content/README.md) | M4 内容域 4.1–4.5 |
| [implementation/file/README.md](./implementation/file/README.md) | M5 文件 / 小册 5.1–5.7 |
| [implementation/ai/README.md](./implementation/ai/README.md) | M6 AI 域 |
| [../../docs/implementation/review-remediation.md](../../docs/implementation/review-remediation.md) | 审查修复：幂等 / 审核 / 上传任务 |
