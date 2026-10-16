import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminRbacController } from './admin-rbac.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminDashboardController } from './admin-dashboard.controller';

@Module({
  imports: [AuthModule],
  controllers: [AdminUsersController, AdminRbacController, AdminDashboardController],
})
export class AdminModule {}
