import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentAuth } from '../../common/decorators/current-auth.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RequireIdempotency } from '../../common/idempotency/require-idempotency.decorator';
import type { RequestAuthContext } from '../../common/types/request-id';
import { ContentService } from './content.service';
import { ListAppContentQueryDto } from './dto/list-app-content.query.dto';
import { CreateContentDto, PatchContentDto, PublishContentDto } from './dto/mutate-content.dto';

@ApiTags('App Content')
@ApiBearerAuth()
@Controller('app/contents')
export class AppContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  @RequirePermission('content:read')
  list(@Query() query: ListAppContentQueryDto, @CurrentAuth() auth: RequestAuthContext) {
    return this.contentService.listApp(auth, query);
  }

  @Post()
  @RequirePermission('content:create')
  @RequireIdempotency()
  create(@Body() body: CreateContentDto, @CurrentAuth() auth: RequestAuthContext) {
    return this.contentService.create(auth, body);
  }

  @Get(':contentId')
  @RequirePermission('content:read')
  getOne(
    @Param('contentId', new ParseUUIDPipe()) contentId: string,
    @CurrentAuth() auth: RequestAuthContext,
  ) {
    return this.contentService.getApp(auth, contentId);
  }

  @Patch(':contentId')
  @RequirePermission('content:update')
  @RequireIdempotency()
  patch(
    @Param('contentId', new ParseUUIDPipe()) contentId: string,
    @Body() body: PatchContentDto,
    @CurrentAuth() auth: RequestAuthContext,
  ) {
    return this.contentService.patch(auth, contentId, body);
  }

  @Post(':contentId/publish')
  @RequirePermission('content:publish')
  @RequireIdempotency()
  publish(
    @Param('contentId', new ParseUUIDPipe()) contentId: string,
    @Body() body: PublishContentDto = {},
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
  ) {
    return this.contentService.publish(auth, contentId, request.requestId, body ?? {});
  }

  @Post(':contentId/archive')
  @RequirePermission('content:publish')
  @RequireIdempotency()
  archive(
    @Param('contentId', new ParseUUIDPipe()) contentId: string,
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
  ) {
    return this.contentService.archive(auth, contentId, request.requestId);
  }

  @Delete(':contentId')
  @RequirePermission('content:delete')
  @RequireIdempotency()
  remove(
    @Param('contentId', new ParseUUIDPipe()) contentId: string,
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
  ) {
    return this.contentService.softDelete(auth, contentId, request.requestId);
  }

  @Post(':contentId/restore')
  @RequirePermission('content:restore')
  @RequireIdempotency()
  restore(
    @Param('contentId', new ParseUUIDPipe()) contentId: string,
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
  ) {
    return this.contentService.restore(auth, contentId, request.requestId);
  }
}
