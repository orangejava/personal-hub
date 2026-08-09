import { Injectable } from '@nestjs/common';
import { HealthIndicator, type HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

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
