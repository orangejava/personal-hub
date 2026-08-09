import { z } from 'zod';

/**
 * 服务只从受控环境变量读取基础设施与密钥配置。
 * 业务可运营配置后续进入 PostgreSQL，避免把它们混入部署密钥。
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  REDIS_KEY_PREFIX: z.string().min(1).default('ph:dev'),
  CORS_ORIGIN: z.url().default('http://localhost:8000'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  MINIO_ENDPOINT: z.string().min(1),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_BUCKET: z.string().min(3),
  MAILPIT_HOST: z.string().min(1).default('localhost'),
  MAILPIT_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  return envSchema.parse(config);
}
