import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataScope } from '@prisma/client';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@ApiTags('Admin Dashboard')
@ApiBearerAuth()
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly prisma: PrismaService) {}

  /** 按服务端本地日期统计今日访问和本周发布，与内容访问去重口径一致。 */
  @Get()
  @RequirePermission('dashboard:read', DataScope.ALL)
  @ApiOperation({ summary: '后台运营概览统计' })
  async stats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));

    const [contentTotal, userTotal, visitToday, publishedThisWeek] = await Promise.all([
      this.prisma.content.count({ where: { deletedAt: null } }),
      this.prisma.user.count(),
      this.prisma.contentViewDay.count({ where: { viewDate: today } }),
      this.prisma.content.count({
        where: { deletedAt: null, publishedAt: { gte: weekStart } },
      }),
    ]);
    return { contentTotal, userTotal, visitToday, publishedThisWeek };
  }
}
