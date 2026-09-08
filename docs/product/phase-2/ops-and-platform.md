# 二期想法：文件运维与平台化

> 状态：想法，不进 Nest M5 验收
> 最后更新：2026-09-08

| 项 | 一期 | 二期 |
| --- | --- | --- |
| 文件软删后 7 天物理删对象 | 只软删 | BullMQ `file-cleanup` worker |
| 同 sha256 去重 | 每次新建 FileAsset | 可选复用，注意跨用户引用 |
| 封面转 webp | 存原图 | 导入/上传后转码 |
| `scan_status` 杀毒 | 列预留，恒空 | 接扫描服务 |
| 头像资料页 | `AVATAR` 白名单已留，无 UI | 个人中心上传头像 |
| 生产 COS 实桶 | 本地 MinIO，同一 StorageProvider | 换 endpoint / 凭证 |
| Prisma 内容枚举改后台可增删 | 枚举留在代码 | 见讨论：只做「已有类型开关」，不让管理员发明 `ContentType` |
