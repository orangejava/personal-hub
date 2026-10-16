import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminRbacController } from './admin-rbac.controller';
import { AdminUsersController } from './admin-users.controller';

@Module({
  imports: [AuthModule],
  controllers: [AdminUsersController, AdminRbacController, AdminDashboardController],
  providers: [AdminDashboardService],
})
export class AdminModule {}
