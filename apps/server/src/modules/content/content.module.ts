import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FileModule } from '../file/file.module';
import { AdminContentController } from './admin-content.controller';
import { AdminContentReviewController } from './admin-content-review.controller';
import { AppContentController } from './app-content.controller';
import { AppReadingController } from './app-reading.controller';
import { ContentRepository } from './content.repository';
import { ContentService } from './content.service';
import { PublicContentController } from './public-content.controller';

/** 公开读、工作区写作、收藏进度、后台运营共用同一 ContentService。 */
@Module({
  imports: [AuthModule, FileModule],
  controllers: [
    PublicContentController,
    AppContentController,
    AppReadingController,
    AdminContentController,
    AdminContentReviewController,
  ],
  providers: [ContentService, ContentRepository],
  exports: [ContentService],
})
export class ContentModule {}
