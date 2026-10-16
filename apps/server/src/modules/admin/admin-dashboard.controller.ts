import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataScope } from '@prisma/client';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AdminDashboardService } from './admin-dashboard.service';

@ApiTags('Admin Dashboard')
@ApiBearerAuth()
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  @Get('overview')
  @RequirePermission('dashboard:read', DataScope.ALL)
  @ApiOperation({ summary: '后台运营概览' })
  overview() {
    return this.dashboard.overview();
  }
}
