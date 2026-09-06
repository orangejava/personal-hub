import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { SystemService } from './system.service';

/** 给后台下拉用：只能选已登记 routeKey，与前端 NEST_ROUTE_REGISTRY 对齐。 */
@ApiTags('Admin Menu Routes')
@ApiBearerAuth()
@Controller('admin/menu-route-options')
export class AdminMenuRouteOptionsController {
  constructor(private readonly systemService: SystemService) {}

  @Get()
  @RequirePermission('menu:manage')
  @ApiOperation({ summary: '当前可选内部路由注册表' })
  list() {
    return this.systemService.listRouteOptions();
  }
}
