import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './env.schema';

/**
 * 测试必须忽略 `.env.local`。@nestjs/config v4 的 ConfigService 会优先用文件里的值，
 * 覆盖测试在 process.env 里写入的 Testcontainers Redis/Postgres。
 * 否则 HTTP 测试会把会话写进开发 Redis（前缀 ph:dev）。
 */
const ignoreEnvFile = process.env.NODE_ENV === 'test';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
  ],
})
export class AppConfigModule {}
