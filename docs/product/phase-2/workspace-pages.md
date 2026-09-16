# 二期想法：工作区任务与文件库

> 状态：上传任务已落地；「我的文件库」仍是想法，不进当前验收
> 最后更新：2026-09-09

| 页 | 现状 | 后续 |
| --- | --- | --- |
| 上传 / 导入任务 | `/workspace/uploads` 已接 `GET /app/upload-tasks` 真分页与 `taskKind` 过滤；失败小册可重试同一任务 | 保持 `QUEUED`/`VALIDATING`/`IMPORTING` 轮询；不要再当未排期功能开刀 |
| 我的文件库 | 文件在 MinIO + `file_assets`；后台有全站文件列表 | 是否做 `/workspace/files`（仅自己的封面/图片/附件）待定，避免和后台文件管理重复 |

任务列表不要复用 `GET /admin/files`。
