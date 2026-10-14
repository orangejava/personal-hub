import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { MetricsService, type MetricsRange } from './metrics.service';

function readRange(value: unknown): MetricsRange {
  if (value === '7d' || value === '30d' || value === '24h') return value;
  return '24h';
}

/** 匿名可读可写。只收聚合后的模板和数值，不要求登录。 */
@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @Get('sampling')
  @ApiOperation({ summary: '当前抽样比例。读取失败时浏览器暂不上报' })
  sampling() {
    return this.metrics.sampleRate().then((sampleRate) => ({ sampleRate }));
  }

  @Public()
  @Post('web-vitals')
  @ApiOperation({ summary: '匿名上报 Web Vitals。限流，非法字段拒绝' })
  accept(@Body() body: unknown, @Req() request: Request) {
    const ip = request.ip ?? request.socket.remoteAddress ?? '0.0.0.0';
    return this.metrics.acceptVitals(body, ip).then(() => ({ accepted: true }));
  }

  @Public()
  @Get('overview')
  @ApiOperation({ summary: '公开聚合。不含管理接口，认证接口只显示分组名' })
  @ApiOkResponse({ description: '24h / 7d / 30d 的 p50、p95 和发布标记' })
  overview(@Query('range') range: unknown) {
    return this.metrics.overview(readRange(range));
  }
}
