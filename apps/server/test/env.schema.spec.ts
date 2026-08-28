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
    expect(env.CORS_ORIGIN).toBe('http://localhost:8000');
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
});
