import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { AdminFileController } from './admin-file.controller';
import { AppFileController } from './app-file.controller';
import { AppUploadController } from './app-upload.controller';
import { AppUploadTaskController } from './app-upload-task.controller';
import { FileService } from './file.service';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [
    AppUploadController,
    AppFileController,
    AppUploadTaskController,
    AdminFileController,
  ],
  providers: [FileService],
  exports: [FileService],
})
export class FileModule {}
