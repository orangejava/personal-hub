import { describe, expect, it } from 'vitest';
import { validateEnv } from '../src/config/env.schema';

const validEnvironment = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/personal_hub',
  REDIS_URL: 'redis://:password@localhost:6379',
  JWT_ACCESS_SECRET: 'a-very-long-local-access-secret-for-tests',
  JWT_REFRESH_SECRET: 'a-very-long-local-refresh-secret-for-tests',
  MINIO_ENDPOINT: 'http://localhost:9000',
  MINIO_ACCESS_KEY: 'minio-user',
  MINIO_SECRET_KEY: 'minio-secret',
  MINIO_BUCKET: 'personal-hub-dev',
};

describe('validateEnv', () => {
  it('applies safe local defaults to optional development settings', () => {
    const env = validateEnv(validEnvironment);

    expect(env.PORT).toBe(3001);
    expect(env.NODE_ENV).toBe('development');
    expect(env.CORS_ORIGIN).toEqual(['http://localhost:8000', 'http://localhost:8001']);
    expect(env.PUBLIC_APP_ORIGIN).toBe('http://localhost:8000');
    expect(env.COOKIE_SECURE).toBe(false);
    expect(env.SMTP_HOST).toBe('localhost');
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.SMTP_USER).toBeUndefined();
    expect(env.SMTP_PASSWORD).toBeUndefined();
    expect(env.SMTP_SECURE).toBe(false);
    expect(env.MAILPIT_HOST).toBe('localhost');
    expect(env.MAILPIT_PORT).toBe(1025);
    expect(env.MAIL_FROM).toBe('Personal Hub <noreply@localhost>');
  });

  it('rejects incomplete secrets before the application starts', () => {
    expect(() =>
      validateEnv({
        ...validEnvironment,
        JWT_ACCESS_SECRET: 'too-short',
      }),
    ).toThrow();
  });

  it('parses comma-separated CORS_ORIGIN and rejects paths', () => {
    const env = validateEnv({
      ...validEnvironment,
      CORS_ORIGIN: 'http://localhost:8000, http://localhost:8001/',
    });
    expect(env.CORS_ORIGIN).toEqual(['http://localhost:8000', 'http://localhost:8001']);

    expect(() =>
      validateEnv({
        ...validEnvironment,
        CORS_ORIGIN: 'http://localhost:8000/admin',
      }),
    ).toThrow();
  });

  it('allows empty CORS_ORIGIN so production can rely on PUBLIC_APP_ORIGIN', () => {
    const env = validateEnv({
      ...validEnvironment,
      CORS_ORIGIN: '',
    });
    expect(env.CORS_ORIGIN).toEqual([]);
  });

  it('requires complete OpenAI-compatible settings when real AI is enabled', () => {
    expect(() =>
      validateEnv({
        ...validEnvironment,
        AI_TEXT_PROVIDER: 'openai_compatible',
      }),
    ).toThrow();

    const env = validateEnv({
      ...validEnvironment,
      AI_TEXT_PROVIDER: 'openai_compatible',
      AI_OPENAI_BASE_URL: 'https://api.example.com/v1',
      AI_OPENAI_API_KEY: 'test-key',
      AI_OPENAI_MODEL: 'test-model',
    });
    expect(env.AI_TEXT_PROVIDER).toBe('openai_compatible');
  });
});
