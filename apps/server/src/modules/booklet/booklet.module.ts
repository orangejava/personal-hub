import { Module } from '@nestjs/common';
import { OutboxService } from '../../infrastructure/queue/outbox.service';
import { AuthModule } from '../auth/auth.module';
import { FileModule } from '../file/file.module';
import { AppBookletImportController } from './app-booklet-import.controller';
import { BookletImportService } from './booklet-import.service';

@Module({
  imports: [AuthModule, FileModule],
  controllers: [AppBookletImportController],
  providers: [BookletImportService, OutboxService],
  exports: [BookletImportService, OutboxService],
})
export class BookletModule {}
