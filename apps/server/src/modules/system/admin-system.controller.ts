import { Body, Controller, Get, Param, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentAuth } from '../../common/decorators/current-auth.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RequireIdempotency } from '../../common/idempotency/require-idempotency.decorator';
import type { RequestAuthContext } from '../../common/types/request-id';
import { ListSystemConfigQueryDto } from './dto/list-system-config-query.dto';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';
import { SystemService } from './system.service';

/** 后台配置写入必须带 Idempotency-Key，body.version 与库内不一致则 409。 */
@ApiTags('Admin System Config')
@ApiBearerAuth()
@Controller('admin/system-configs')
export class AdminSystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get()
  @RequirePermission('system:config:manage')
  @ApiOperation({ summary: '按 group 读取类型化配置，不传 group 则返回全部' })
  list(@Query() query: ListSystemConfigQueryDto) {
    return this.systemService.listAdminConfigs(query.group);
  }

  @Put(':group')
  @RequirePermission('system:config:manage')
  @RequireIdempotency()
  @ApiOperation({ summary: '原子更新一个配置组' })
  update(
    @Param('group') group: string,
    @Body() body: UpdateSystemConfigDto,
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
  ) {
    return this.systemService.updateConfigGroup({
      group,
      value: body.value,
      expectedVersion: body.version,
      actorId: auth.userId,
      requestId: request.requestId,
    });
  }
}
