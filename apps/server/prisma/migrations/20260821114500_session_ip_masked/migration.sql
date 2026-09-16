-- 会话列表只展示脱敏 IP，登录时写入已掩码值，不存精确地址。
ALTER TABLE "auth_sessions" ADD COLUMN "ip_masked" VARCHAR(64);
