import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { CurrentAuth } from '../../common/decorators/current-auth.decorator';
import type { RequestAuthContext } from '../../common/types/request-id';
import { ContentService } from './content.service';
import { UpsertReadingDto } from './dto/mutate-content.dto';

class PageQueryDto {
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

@ApiTags('App Reading')
@ApiBearerAuth()
@Controller('app')
export class AppReadingController {
  constructor(private readonly contentService: ContentService) {}

  @Get('dashboard')
  @ApiOperation({ summary: '工作台内容统计' })
  dashboard(@CurrentAuth() auth: RequestAuthContext) {
    return this.contentService.dashboard(auth);
  }

  @Get('favorites')
  listFavorites(@Query() query: PageQueryDto, @CurrentAuth() auth: RequestAuthContext) {
    return this.contentService.listFavorites(auth, query.page, query.pageSize);
  }

  @Put('favorites/:contentId')
  putFavorite(
    @Param('contentId', new ParseUUIDPipe()) contentId: string,
    @CurrentAuth() auth: RequestAuthContext,
  ) {
    return this.contentService.putFavorite(auth, contentId);
  }

  @Delete('favorites/:contentId')
  deleteFavorite(
    @Param('contentId', new ParseUUIDPipe()) contentId: string,
    @CurrentAuth() auth: RequestAuthContext,
  ) {
    return this.contentService.deleteFavorite(auth, contentId);
  }

  @Get('reading-records/recent')
  recent(@CurrentAuth() auth: RequestAuthContext) {
    return this.contentService.recentReading(auth);
  }

  @Put('reading-records/:contentId')
  upsertReading(
    @Param('contentId', new ParseUUIDPipe()) contentId: string,
    @Body() body: UpsertReadingDto,
    @CurrentAuth() auth: RequestAuthContext,
  ) {
    return this.contentService.upsertReading(auth, contentId, body);
  }
}
