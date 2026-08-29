import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { assignRequestId } from './common/middleware/request-id.middleware';
import type { Env } from './config/env.schema';

/**
 * 配置所有 HTTP 横切能力；生产启动与集成测试共用此函数，避免两条链路行为漂移。
 */
export function configureHttpApp(
  app: NestExpressApplication,
  config: ConfigService<Env, true>,
  logger: Logger,
): void {
  app.useLogger(logger);
  // requestId 必须先于其它 middleware 写入，才能覆盖其潜在异常与后续完整日志链路。
  app.use(assignRequestId);
  app.use(cookieParser());
  app.use(helmet());

  if (config.getOrThrow('NODE_ENV') !== 'production') {
    app.enableCors({
      origin: config.getOrThrow('CORS_ORIGIN'),
      credentials: true,
      exposedHeaders: ['X-Request-Id'],
    });
  }

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  if (config.getOrThrow('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Personal Hub API')
      .setDescription('Personal Hub NestJS API')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }
}
