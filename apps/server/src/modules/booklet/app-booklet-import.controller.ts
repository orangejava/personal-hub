import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentAuth } from '../../common/decorators/current-auth.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RequireIdempotency } from '../../common/idempotency/require-idempotency.decorator';
import type { RequestAuthContext } from '../../common/types/request-id';
import { CreateBookletImportDto, ListBookletImportQueryDto } from '../file/dto/file.dto';
import { BookletImportService } from './booklet-import.service';

@ApiTags('App Booklet Imports')
@ApiBearerAuth()
@Controller('app/booklet-imports')
export class AppBookletImportController {
  constructor(private readonly imports: BookletImportService) {}

  @Get()
  @RequirePermission('booklet:import')
  list(@Query() query: ListBookletImportQueryDto, @CurrentAuth() auth: RequestAuthContext) {
    return this.imports.listMine(auth, query);
  }

  @Post()
  @RequirePermission('booklet:import')
  @RequireIdempotency({ highRisk: true })
  create(
    @Body() body: CreateBookletImportDto,
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
  ) {
    return this.imports.createJob(auth, body.sourceFileId, request.header('idempotency-key')?.trim() ?? '');
  }

  @Get(':jobId')
  @RequirePermission('booklet:import')
  getOne(@Param('jobId', new ParseUUIDPipe()) jobId: string, @CurrentAuth() auth: RequestAuthContext) {
    return this.imports.getJob(auth, jobId);
  }

  @Post(':jobId/retry')
  @RequirePermission('booklet:import')
  @RequireIdempotency({ highRisk: true })
  retry(
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
    @CurrentAuth() auth: RequestAuthContext,
  ) {
    return this.imports.retry(auth, jobId);
  }

  @Delete(':jobId')
  @RequirePermission('booklet:import')
  hide(
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
    @CurrentAuth() auth: RequestAuthContext,
  ) {
    return this.imports.hideMine(auth, jobId);
  }
}
