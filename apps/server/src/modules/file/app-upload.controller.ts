import { Body, Controller, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentAuth } from '../../common/decorators/current-auth.decorator';
import { RequireIdempotency } from '../../common/idempotency/require-idempotency.decorator';
import type { RequestAuthContext } from '../../common/types/request-id';
import { CompleteUploadDto, CreateUploadDto } from './dto/file.dto';
import { FileService } from './file.service';

@ApiTags('App Uploads')
@ApiBearerAuth()
@Controller('app')
export class AppUploadController {
  constructor(private readonly files: FileService) {}

  @Post('uploads')
  @RequireIdempotency()
  create(@Body() body: CreateUploadDto, @CurrentAuth() auth: RequestAuthContext, @Req() request: Request) {
    return this.files.createUpload(auth, body, headerKey(request));
  }

  @Post('uploads/:uploadId/complete')
  @RequireIdempotency({ highRisk: true })
  complete(
    @Param('uploadId', new ParseUUIDPipe()) uploadId: string,
    @Body() body: CompleteUploadDto,
    @CurrentAuth() auth: RequestAuthContext,
  ) {
    return this.files.completeUpload(auth, uploadId, body.parts);
  }
}

function headerKey(request: Request): string {
  return request.header('idempotency-key')?.trim() ?? '';
}
