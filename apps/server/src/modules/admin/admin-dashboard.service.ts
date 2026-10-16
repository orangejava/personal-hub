import { Injectable } from '@nestjs/common';
import { shanghaiDate, shanghaiWeekStart } from '../../common/time/shanghai-date';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** 以数据库聚合得到后台概览；读者按同日 subjectHash 跨内容去重。 */
  async overview(now = new Date()) {
    const [contentTotal, userTotal, readers, publishedThisWeek] = await Promise.all([
      this.prisma.content.count({ where: { deletedAt: null } }),
      this.prisma.user.count(),
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT v.subject_hash) AS count
        FROM content_view_days v
        JOIN contents c ON c.id = v.content_id
        WHERE v.view_date = CAST(${shanghaiDate(now).toISOString().slice(0, 10)} AS date)
          AND c.deleted_at IS NULL
      `,
      this.prisma.content.count({
        where: {
          deletedAt: null,
          publishedAt: { gte: shanghaiWeekStart(now), lte: now },
        },
      }),
    ]);
    return {
      contentTotal,
      userTotal,
      contentReadersToday: Number(readers[0]?.count ?? 0),
      publishedThisWeek,
    };
  }
}
