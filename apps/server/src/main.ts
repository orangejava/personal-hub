import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureHttpApp } from './bootstrap';
import type { Env } from './config/env.schema';

/** HTTP 进程入口。横切中间件在 bootstrap.configureHttpApp，测试可复用那份而不走 listen。 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService<Env, true>);
  const logger = app.get(Logger);

  configureHttpApp(app, config, logger);
  const port = config.getOrThrow('PORT');
  await app.listen(port, '0.0.0.0');

  const localBaseUrl = `http://localhost:${port}`;
  // 只输出启动后最常用的访问入口，避免常驻终端日志被无关信息淹没。
  logger.log(
    `服务已启动 · API: ${localBaseUrl}/api/v1 · Health: ${localBaseUrl}/api/v1/health/live`,
  );

  if (config.getOrThrow('NODE_ENV') !== 'production') {
    logger.log(`Swagger: ${localBaseUrl}/api/docs`);
  }
}

void bootstrap();
