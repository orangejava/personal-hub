import { Module, RequestMethod } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { HealthModule } from './modules/health/health.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { SystemModule } from './modules/system/system.module';
import { ContentModule } from './modules/content/content.module';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRoot({
      // Express 5 不再接受旧式 `*` 通配路由；显式使用 Nest 11 兼容的命名通配写法。
      forRoutes: [{ path: '{*path}', method: RequestMethod.ALL }],
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        // 只在本地开发启用终端美化：保留生产 JSON 日志的机器可读性，也让 error 与普通日志直观区分。
        ...(process.env.NODE_ENV === 'development'
          ? {
              transport: {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  levelFirst: true,
                  translateTime: 'SYS:standard',
                  ignore: 'pid,hostname',
                  singleLine: true,
                },
              },
            }
          : {}),
        // pino-http 的请求类型比 Express 更通用，显式读取可选字段以保留跨适配器兼容性。
        customProps: (request) => ({
          requestId: (request as { requestId?: string }).requestId,
        }),
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.password',
          'req.body.refreshToken',
          'res.headers.set-cookie',
        ],
      },
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    SystemModule,
    ContentModule,
    AdminModule,
  ],
})
export class AppModule {}
