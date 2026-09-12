import { z } from 'zod';

const DEFAULT_CORS_ORIGIN = 'http://localhost:8000,http://localhost:8001';
const DEFAULT_PUBLIC_APP_ORIGIN = 'http://localhost:8000';

function emptyToUndefined(value: unknown) {
  return typeof value === 'string' && value.trim() === '' ? undefined : value;
}

/**
 * 把 `CORS_ORIGIN` 解析成 Origin 白名单。
 * 环境变量仍是逗号分隔字符串，方便本地同时放行用户端 :8000 与管理端 :8001。
 *
 * @param raw 逗号分隔的绝对 Origin，不要带 path。空字符串表示不额外放行，Cookie 鉴权回退 `PUBLIC_APP_ORIGIN`
 * @returns 去重、去掉末尾 `/` 后的列表；空输入得到 `[]`
 */
export function parseCorsOriginList(raw: string): string[] {
  const parts = raw
    .split(',')
    .map((item) => item.trim().replace(/\/$/, ''))
    .filter((item) => item.length > 0);

  for (const origin of parts) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`CORS_ORIGIN 含有非法地址: ${origin}`);
    }
    if (parsed.search || parsed.hash) {
      throw new Error(`CORS_ORIGIN 不能包含 query 或 hash: ${origin}`);
    }
    if (parsed.pathname !== '/' && parsed.pathname !== '') {
      throw new Error(`CORS_ORIGIN 不能包含 path: ${origin}`);
    }
  }

  return [...new Set(parts)];
}

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
  /**
   * 允许带 Cookie 调用 refresh/logout 的前端 Origin 列表。
   * 空列表表示不额外放行（生产同站可留空），鉴权回退 `PUBLIC_APP_ORIGIN`。
   * 与 `PUBLIC_APP_ORIGIN` 分离：后者还用于拼验证/重置邮件里的用户端链接。
   */
  CORS_ORIGIN: z
    .string()
    .default(DEFAULT_CORS_ORIGIN)
    .transform((value, ctx) => {
      try {
        return parseCorsOriginList(value);
      } catch (error) {
        ctx.addIssue({
          code: 'custom',
          message: error instanceof Error ? error.message : String(error),
        });
        return z.NEVER;
      }
    }),
  /** 验证邮箱、重置密码邮件里的用户端根地址，不要写成管理端 */
  PUBLIC_APP_ORIGIN: z
    .url()
    .default(DEFAULT_PUBLIC_APP_ORIGIN)
    .transform((value) => value.replace(/\/$/, '')),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  MINIO_ENDPOINT: z.string().min(1),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_BUCKET: z.string().min(3),
  MAILPIT_HOST: z.string().min(1).default('localhost'),
  MAILPIT_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  MAIL_FROM: z.string().min(1).default('Personal Hub <noreply@localhost>'),
  /** Chat/Text Provider：默认 Fake；有 Key 时才切到 OpenAI 兼容协议。 */
  AI_TEXT_PROVIDER: z.enum(['fake', 'openai_compatible']).default('fake'),
  AI_OPENAI_BASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  AI_OPENAI_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  AI_OPENAI_MODEL: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  AI_OPENAI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(60000),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  return envSchema.parse(config);
}
