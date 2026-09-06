import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { IdempotencyInterceptor } from '../../common/idempotency/idempotency.interceptor';
import { IdempotencyRepository } from '../../common/idempotency/idempotency.repository';
import { AdminMenuRouteOptionsController } from './admin-menu-routes.controller';
import { AdminMenusController } from './admin-menus.controller';
import { AdminSystemController } from './admin-system.controller';
import { PublicSystemController } from './public-system.controller';
import { SystemRepository } from './system.repository';
import { SystemService } from './system.service';

/** 幂等拦截器挂在本模块，避免未声明 @RequireIdempotency 的全局写接口也被强制要 Key。 */
@Module({
  controllers: [
    PublicSystemController,
    AdminSystemController,
    AdminMenusController,
    AdminMenuRouteOptionsController,
  ],
  providers: [
    SystemService,
    SystemRepository,
    IdempotencyRepository,
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
  exports: [SystemService],
})
export class SystemModule {}
