import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../../common/decorators/current-auth.decorator';
import type { RequestAuthContext } from '../../common/types/request-id';
import { AppUploadTaskQueryDto } from './dto/file.dto';
import { FileService } from './file.service';

@ApiTags('App Upload Tasks')
@ApiBearerAuth()
@Controller('app/upload-tasks')
export class AppUploadTaskController {
  constructor(private readonly files: FileService) {}

  @Get()
  list(@Query() query: AppUploadTaskQueryDto, @CurrentAuth() auth: RequestAuthContext) {
    return this.files.listUploadTasks(auth, query);
  }
}
