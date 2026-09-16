import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataScope } from '@prisma/client';
import type { Request } from 'express';
import { CurrentAuth } from '../../common/decorators/current-auth.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RequireIdempotency } from '../../common/idempotency/require-idempotency.decorator';
import type { RequestAuthContext } from '../../common/types/request-id';
import { ContentService } from './content.service';
import {
  ApproveContentReviewDto,
  ListContentReviewsQueryDto,
  RejectContentReviewDto,
} from './dto/mutate-content.dto';

@ApiTags('Admin Content Reviews')
@ApiBearerAuth()
@Controller('admin/content-reviews')
export class AdminContentReviewController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  @RequirePermission('content:publish', DataScope.ALL)
  @ApiOperation({ summary: '后台内容审核队列' })
  list(@Query() query: ListContentReviewsQueryDto, @CurrentAuth() auth: RequestAuthContext) {
    return this.contentService.listReviews(auth, query);
  }

  @Post(':reviewId/approve')
  @RequirePermission('content:publish', DataScope.ALL)
  @RequireIdempotency({ highRisk: true })
  @ApiOperation({ summary: '通过内容审核并发布' })
  approve(
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string,
    @Body() body: ApproveContentReviewDto = {},
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
  ) {
    return this.contentService.approveReview(
      auth,
      reviewId,
      body?.copyrightNote,
      request.requestId,
    );
  }

  @Post(':reviewId/reject')
  @RequirePermission('content:publish', DataScope.ALL)
  @RequireIdempotency({ highRisk: true })
  @ApiOperation({ summary: '驳回内容审核' })
  reject(
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string,
    @Body() body: RejectContentReviewDto,
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
  ) {
    return this.contentService.rejectReview(auth, reviewId, body.reason, request.requestId);
  }
}
