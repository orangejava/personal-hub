import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { Public } from '../../common/decorators/public.decorator';
import { InfrastructureHealthIndicator } from './health.indicator';

/** live 只证明进程在；ready 才探 Postgres/Redis，避免存活探针被依赖拖死。 */
@Public()
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly infrastructure: InfrastructureHealthIndicator,
  ) {}

  @Get('live')
  @HealthCheck()
  @ApiOperation({ summary: '存活检查', description: '只确认 HTTP 进程仍可处理请求。' })
  @ApiOkResponse({ description: '进程可用。' })
  live() {
    return this.health.check([() => Promise.resolve({ application: { status: 'up' } })]);
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: '就绪检查', description: '确认 PostgreSQL 与 Redis 均可用。' })
  @ApiOkResponse({ description: '所有关键依赖可用。' })
  @ApiServiceUnavailableResponse({ description: '至少一个关键依赖不可用。' })
  ready() {
    return this.health.check([
      () => this.infrastructure.database(),
      () => this.infrastructure.redisConnection(),
    ]);
  }
}
