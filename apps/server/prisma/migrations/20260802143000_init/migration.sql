-- 为后续 UUID 默认值保留 PostgreSQL 原生能力。
-- 本迁移不创建业务表；Auth 阶段会通过新的 Prisma migration 引入首批领域模型。
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
