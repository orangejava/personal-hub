import {
  Injectable,
  Logger,
  MiddlewareConsumer,
  Module,
  type NestModule,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { SystemModule } from '../system/system.module';
import { MetricsRollup } from './metrics-rollup';
import { MetricsController } from './metrics.controller';
import { MetricsRepository } from './metrics.repository';
import { MetricsRedis } from './metrics.redis';
import { MetricsService, MetricsTimingMiddleware } from './metrics.service';

/** HTTP 进程和 worker 都会启动。同一个提交号只落一行。 */
@Injectable()
class MetricsDeployHook implements OnModuleInit {
  private readonly logger = new Logger(MetricsDeployHook.name);

  constructor(
    private readonly metrics: MetricsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.metrics.recordDeployFromEnv(this.config.get('GIT_SHA'));
    } catch (error) {
      // 迁移还没跑时不要挡住整个进程。概览接口会在表就绪后恢复。
      this.logger.warn(`发布标记未写入: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

@Module({
  imports: [PrismaModule, RedisModule, SystemModule],
  controllers: [MetricsController],
  providers: [
    MetricsService,
    MetricsRepository,
    MetricsRedis,
    MetricsRollup,
    MetricsTimingMiddleware,
    MetricsDeployHook,
  ],
  exports: [MetricsRollup, MetricsService],
})
export class MetricsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(MetricsTimingMiddleware).forRoutes('{*path}');
  }
}
