import { Controller, Get, Param, ParseUUIDPipe, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { OptionalAuth } from '../../common/decorators/current-auth.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { RequestAuthContext } from '../../common/types/request-id';
import { ContentService } from './content.service';
import { ListPublicContentQueryDto } from './dto/list-public-content.query.dto';

@ApiTags('Public Content')
@Controller('public/contents')
export class PublicContentController {
  constructor(private readonly contentService: ContentService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: '公开内容列表' })
  async list(@Query() query: ListPublicContentQueryDto, @OptionalAuth() auth?: RequestAuthContext) {
    const viewer = await this.contentService.resolveViewerFromAuth(auth);
    return this.contentService.listPublic(query, viewer);
  }

  @Public()
  @Get('featured')
  @ApiOperation({ summary: '精选或最新公开内容' })
  async featured(@OptionalAuth() auth?: RequestAuthContext) {
    const viewer = await this.contentService.resolveViewerFromAuth(auth);
    return this.contentService.featured(viewer);
  }

  @Public()
  @Get('meta')
  @ApiOperation({ summary: '公开分类与标签' })
  async meta(@OptionalAuth() auth?: RequestAuthContext) {
    const viewer = await this.contentService.resolveViewerFromAuth(auth);
    return this.contentService.publicMeta(viewer);
  }

  @Public()
  @Get(':contentId/chapters')
  @ApiOperation({ summary: '小册章节索引，不含正文' })
  async chapters(
    @Param('contentId', new ParseUUIDPipe()) contentId: string,
    @OptionalAuth() auth?: RequestAuthContext,
  ) {
    const viewer = await this.contentService.resolveViewerFromAuth(auth);
    return this.contentService.listChapters(contentId, viewer);
  }

  @Public()
  @Get(':contentId')
  @ApiOperation({ summary: '公开内容详情' })
  async detail(
    @Param('contentId', new ParseUUIDPipe()) contentId: string,
    @OptionalAuth() auth?: RequestAuthContext,
    @Req() request?: Request,
  ) {
    const viewer = await this.contentService.resolveViewerFromAuth(auth);
    const hash = this.contentService.viewSubjectHash(auth?.userId, request?.ip);
    return this.contentService.publicDetail(contentId, viewer, hash);
  }
}
