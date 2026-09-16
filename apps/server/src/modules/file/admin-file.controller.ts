import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../../common/decorators/current-auth.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RequireIdempotency } from '../../common/idempotency/require-idempotency.decorator';
import type { RequestAuthContext } from '../../common/types/request-id';
import { AdminFileQueryDto, BatchDeleteFilesDto } from './dto/file.dto';
import { FileService } from './file.service';

@ApiTags('Admin Files')
@ApiBearerAuth()
@Controller('admin/files')
export class AdminFileController {
  constructor(private readonly files: FileService) {}

  @Get()
  @RequirePermission('file:read')
  list(@Query() query: AdminFileQueryDto, @CurrentAuth() auth: RequestAuthContext) {
    return this.files.listAdmin(auth, query);
  }

  @Delete()
  @RequirePermission('file:delete')
  @RequireIdempotency()
  batch(@Body() body: BatchDeleteFilesDto, @CurrentAuth() auth: RequestAuthContext) {
    return this.files.batchDelete(auth, body.ids);
  }

  @Delete(':fileId')
  @RequirePermission('file:delete')
  @RequireIdempotency()
  remove(@Param('fileId', new ParseUUIDPipe()) fileId: string, @CurrentAuth() auth: RequestAuthContext) {
    return this.files.softDelete(auth, fileId);
  }
}
