import { Controller, Delete, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../../common/decorators/current-auth.decorator';
import type { RequestAuthContext } from '../../common/types/request-id';
import { AppFileQueryDto } from './dto/file.dto';
import { FileService } from './file.service';

@ApiTags('App Files')
@ApiBearerAuth()
@Controller('app/files')
export class AppFileController {
  constructor(private readonly files: FileService) {}

  @Get()
  list(@Query() query: AppFileQueryDto, @CurrentAuth() auth: RequestAuthContext) {
    return this.files.listMine(auth, query);
  }

  @Get(':fileId/download-url')
  downloadUrl(
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
    @CurrentAuth() auth: RequestAuthContext,
  ) {
    return this.files.downloadUrl(auth, fileId);
  }

  @Delete(':fileId')
  hideFromTaskList(
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
    @CurrentAuth() auth: RequestAuthContext,
  ) {
    return this.files.hideMineFromTaskList(auth, fileId);
  }
}
