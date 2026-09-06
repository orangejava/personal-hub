import { Injectable } from '@nestjs/common';
import { HealthIndicator, type HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

/**
 * ready 探针用。失败返回 down 而不是抛异常，避免 Terminus 把整次 health 打成 500 不好区分依赖。
 */
@Injectable()
export class InfrastructureHealthIndicator extends HealthIndicator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    super();
  }

  async database(): Promise<HealthIndicatorResult> {
    try {
      // 固定 SQL 也采用 tagged template，避免健康检查成为复制不安全 raw query 的范例。
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus('database', true);
    } catch {
      return this.getStatus('database', false);
    }
  }

  async redisConnection(): Promise<HealthIndicatorResult> {
    try {
      await this.redis.ping();
      return this.getStatus('redis', true);
    } catch {
      return this.getStatus('redis', false);
    }
  }
}
