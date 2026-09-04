import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { SystemService } from './system.service';

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
