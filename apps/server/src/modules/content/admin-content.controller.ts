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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { Request } from 'express';
import { CurrentAuth } from '../../common/decorators/current-auth.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RequireIdempotency } from '../../common/idempotency/require-idempotency.decorator';
import type { RequestAuthContext } from '../../common/types/request-id';
import { ContentService } from './content.service';
import {
  CreateCategoryDto,
  CreateTagDto,
  FeaturedDto,
  PatchCategoryDto,
  PurgeContentDto,
  SortCategoriesDto,
} from './dto/mutate-content.dto';

class AdminContentQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  keyword?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  types?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

@ApiTags('Admin Content')
@ApiBearerAuth()
@Controller('admin')
export class AdminContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get('contents')
  @RequirePermission('content:read')
  list(@Query() query: AdminContentQueryDto, @CurrentAuth() auth: RequestAuthContext) {
    return this.contentService.listAdmin(auth, query);
  }

  @Get('contents/:contentId')
  @RequirePermission('content:read')
  getOne(
    @Param('contentId', new ParseUUIDPipe()) contentId: string,
    @CurrentAuth() auth: RequestAuthContext,
  ) {
    return this.contentService.getApp(auth, contentId);
  }

  @Post('contents/:contentId/publish')
  @RequirePermission('content:publish')
  @RequireIdempotency()
  publish(
    @Param('contentId', new ParseUUIDPipe()) contentId: string,
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
  ) {
    return this.contentService.publish(auth, contentId, request.requestId);
  }

  @Post('contents/:contentId/archive')
  @RequirePermission('content:publish')
  @RequireIdempotency()
  archive(
    @Param('contentId', new ParseUUIDPipe()) contentId: string,
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
  ) {
    return this.contentService.archive(auth, contentId, request.requestId);
  }

  @Post('contents/:contentId/restore')
  @RequirePermission('content:restore')
  @RequireIdempotency()
  restore(
    @Param('contentId', new ParseUUIDPipe()) contentId: string,
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
  ) {
    return this.contentService.restore(auth, contentId, request.requestId);
  }

  @Patch('contents/:contentId/featured')
  @RequirePermission('content:featured')
  @RequireIdempotency()
  featured(
    @Param('contentId', new ParseUUIDPipe()) contentId: string,
    @Body() body: FeaturedDto,
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
  ) {
    return this.contentService.setFeatured(auth, contentId, body.featured, request.requestId);
  }

  @Delete('contents/:contentId')
  @RequirePermission('content:delete')
  @RequireIdempotency()
  @ApiOperation({ summary: '后台软删除（与工作区同一回收站）' })
  remove(
    @Param('contentId', new ParseUUIDPipe()) contentId: string,
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
  ) {
    return this.contentService.softDelete(auth, contentId, request.requestId);
  }

  @Delete('contents/:contentId/purge')
  @RequirePermission('content:purge')
  @RequireIdempotency()
  purge(
    @Param('contentId', new ParseUUIDPipe()) contentId: string,
    @Body() body: PurgeContentDto,
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
  ) {
    return this.contentService.purge(auth, contentId, body.reason, request.requestId);
  }

  @Get('categories')
  @RequirePermission('category:manage')
  categories() {
    return this.contentService.listCategoriesAdmin();
  }

  @Post('categories')
  @RequirePermission('category:manage')
  @RequireIdempotency()
  createCategory(
    @Body() body: CreateCategoryDto,
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
  ) {
    return this.contentService.createCategory(auth, body, request.requestId);
  }

  @Patch('categories/sort')
  @RequirePermission('category:manage')
  @RequireIdempotency()
  sortCategories(
    @Body() body: SortCategoriesDto,
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
  ) {
    return this.contentService.sortCategories(auth, body.ids, request.requestId);
  }

  @Patch('categories/:categoryId')
  @RequirePermission('category:manage')
  @RequireIdempotency()
  patchCategory(
    @Param('categoryId', new ParseUUIDPipe()) categoryId: string,
    @Body() body: PatchCategoryDto,
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
  ) {
    return this.contentService.patchCategory(auth, categoryId, body, request.requestId);
  }

  @Delete('categories/:categoryId')
  @RequirePermission('category:manage')
  @RequireIdempotency()
  deleteCategory(
    @Param('categoryId', new ParseUUIDPipe()) categoryId: string,
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
  ) {
    return this.contentService.deleteCategory(auth, categoryId, request.requestId);
  }

  @Get('tags')
  @RequirePermission('tag:manage')
  tags() {
    return this.contentService.listTagsAdmin();
  }

  @Post('tags')
  @RequirePermission('tag:manage')
  @RequireIdempotency()
  createTag(
    @Body() body: CreateTagDto,
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
  ) {
    return this.contentService.createTag(auth, body, request.requestId);
  }

  @Delete('tags/:tagId')
  @RequirePermission('tag:manage')
  @RequireIdempotency()
  deleteTag(
    @Param('tagId', new ParseUUIDPipe()) tagId: string,
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
  ) {
    return this.contentService.deleteTag(auth, tagId, request.requestId);
  }
}
