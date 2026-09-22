import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AiOwnerType } from '@prisma/client';
import { CurrentAuth } from '../../common/decorators/current-auth.decorator';
import { SkipResponseEnvelope } from '../../common/decorators/skip-response-envelope.decorator';
import { RequireIdempotency } from '../../common/idempotency/require-idempotency.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { RequestAuthContext } from '../../common/types/request-id';
import { AiService } from './ai.service';
import {
  CreateFolderDto,
  CreateSessionDto,
  CreateTemplateDto,
  CreateAssetDto,
  FeedbackDto,
  ImageGenerateDto,
  JobListQueryDto,
  PageQueryDto,
  PatchAssetDto,
  PatchSessionDto,
  PatchTemplateDto,
  SendMessageDto,
  TextGenerateDto,
  UsageQueryDto,
  VideoGenerateDto,
} from './dto/ai.dto';

@ApiTags('App AI')
@ApiBearerAuth()
@Controller('app/ai')
export class AppAiController {
  constructor(private readonly ai: AiService) {}

  @Get('home')
  @RequirePermission('ai:use')
  home(@CurrentAuth() auth: RequestAuthContext) {
    return this.ai.home({ type: AiOwnerType.USER, id: auth.userId, userId: auth.userId });
  }

  @Get('models')
  @RequirePermission('ai:use')
  models(@CurrentAuth() auth: RequestAuthContext) {
    return this.ai.listVisibleModels({ type: AiOwnerType.USER, id: auth.userId, userId: auth.userId });
  }

  @Get('entitlement')
  @RequirePermission('ai:use')
  entitlement(@CurrentAuth() auth: RequestAuthContext) {
    return this.ai.entitlement(auth.userId);
  }

  @Get('navigation')
  @RequirePermission('ai:use')
  navigation() {
    return this.ai.listNavigation();
  }

  @Get('generation-jobs')
  @RequirePermission('ai:use')
  generationJobs(@Query() query: JobListQueryDto, @CurrentAuth() auth: RequestAuthContext) {
    return this.ai.listJobs(auth.userId, query);
  }

  @Get('membership')
  @RequirePermission('ai:use')
  membership(@CurrentAuth() auth: RequestAuthContext) {
    return this.ai.membership(auth.userId);
  }

  @Get('profile-summary')
  @RequirePermission('ai:use')
  profileSummary(@CurrentAuth() auth: RequestAuthContext) {
    return this.ai.profileSummary(auth.userId);
  }

  @Get('creation-center')
  @RequirePermission('ai:use')
  creationCenter(@CurrentAuth() auth: RequestAuthContext) {
    return this.ai.creationCenter(auth.userId);
  }

  @Get('publish-drafts')
  @RequirePermission('ai:use')
  publishDrafts(@CurrentAuth() auth: RequestAuthContext) {
    return this.ai.publishDrafts(auth.userId);
  }

  @Get('tutorials')
  @RequirePermission('ai:use')
  tutorials() {
    return this.ai.tutorials();
  }

  @Get('templates')
  @RequirePermission('ai:use')
  async templates(@CurrentAuth() auth: RequestAuthContext) {
    const home = await this.ai.home({ type: AiOwnerType.USER, id: auth.userId, userId: auth.userId });
    return home.templates;
  }

  @Post('templates')
  @RequirePermission('ai:use')
  @RequireIdempotency()
  createTemplate(@Body() body: CreateTemplateDto, @CurrentAuth() auth: RequestAuthContext) {
    return this.ai.createUserTemplate(auth.userId, body);
  }

  @Patch('templates/:templateId')
  @RequirePermission('ai:use')
  @RequireIdempotency()
  patchTemplate(
    @Param('templateId', new ParseUUIDPipe()) templateId: string,
    @Body() body: PatchTemplateDto,
    @CurrentAuth() auth: RequestAuthContext,
  ) {
    return this.ai.patchUserTemplate(auth.userId, templateId, body);
  }

  @Delete('templates/:templateId')
  @RequirePermission('ai:use')
  @RequireIdempotency()
  deleteTemplate(
    @Param('templateId', new ParseUUIDPipe()) templateId: string,
    @CurrentAuth() auth: RequestAuthContext,
  ) {
    return this.ai.deleteUserTemplate(auth.userId, templateId);
  }

  @Get('sessions')
  @RequirePermission('ai:use')
  sessions(@Query() query: PageQueryDto, @CurrentAuth() auth: RequestAuthContext) {
    return this.ai.listSessions({ type: AiOwnerType.USER, id: auth.userId }, query.page, query.pageSize);
  }

  @Post('sessions')
  @RequirePermission('ai:use')
  @RequireIdempotency()
  createSession(@Body() body: CreateSessionDto, @CurrentAuth() auth: RequestAuthContext) {
    return this.ai.createSession({ type: AiOwnerType.USER, id: auth.userId, userId: auth.userId }, body);
  }

  @Patch('sessions/:sessionId')
  @RequirePermission('ai:use')
  @RequireIdempotency()
  patchSession(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Body() body: PatchSessionDto,
    @CurrentAuth() auth: RequestAuthContext,
  ) {
    return this.ai.patchSession(
      { type: AiOwnerType.USER, id: auth.userId, userId: auth.userId },
      sessionId,
      body,
    );
  }

  @Delete('sessions/:sessionId')
  @RequirePermission('ai:use')
  @RequireIdempotency()
  deleteSession(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @CurrentAuth() auth: RequestAuthContext,
  ) {
    return this.ai.deleteSession({ type: AiOwnerType.USER, id: auth.userId }, sessionId);
  }

  @Get('sessions/:sessionId/messages')
  @RequirePermission('ai:use')
  messages(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @CurrentAuth() auth: RequestAuthContext,
  ) {
    return this.ai.listMessages({ type: AiOwnerType.USER, id: auth.userId }, sessionId);
  }

  @Post('sessions/:sessionId/messages')
  @RequirePermission('ai:use')
  @RequireIdempotency({ highRisk: true, stream: true })
  @SkipResponseEnvelope()
  send(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Body() body: SendMessageDto,
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.ai.streamChat({
      owner: {
        type: AiOwnerType.USER,
        id: auth.userId,
        userId: auth.userId,
        permissionVersion: auth.permissionVersion,
      },
      sessionId,
      body,
      requestId: request.requestId,
      response,
    });
  }

  @Post('messages/:messageId/stop')
  @RequirePermission('ai:use')
  @RequireIdempotency({ highRisk: true })
  stop(
    @Param('messageId', new ParseUUIDPipe()) messageId: string,
    @CurrentAuth() auth: RequestAuthContext,
  ) {
    return this.ai.stopMessage({ type: AiOwnerType.USER, id: auth.userId }, messageId);
  }

  @Post('messages/:messageId/regenerate')
  @RequirePermission('ai:use')
  @RequireIdempotency({ highRisk: true, stream: true })
  @SkipResponseEnvelope()
  regenerate(
    @Param('messageId', new ParseUUIDPipe()) messageId: string,
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.ai.regenerate(
      {
        type: AiOwnerType.USER,
        id: auth.userId,
        userId: auth.userId,
        permissionVersion: auth.permissionVersion,
      },
      messageId,
      request.requestId,
      response,
    );
  }

  @Patch('messages/:messageId/feedback')
  @RequirePermission('ai:use')
  feedback(
    @Param('messageId', new ParseUUIDPipe()) messageId: string,
    @Body() body: FeedbackDto,
    @CurrentAuth() auth: RequestAuthContext,
  ) {
    return this.ai.feedback({ type: AiOwnerType.USER, id: auth.userId }, messageId, body.feedback);
  }

  @Post('text-generations')
  @RequirePermission('ai:use')
  @RequireIdempotency({ highRisk: true, stream: true })
  @SkipResponseEnvelope()
  text(
    @Body() body: TextGenerateDto,
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.ai.streamText({
      owner: {
        type: AiOwnerType.USER,
        id: auth.userId,
        userId: auth.userId,
        permissionVersion: auth.permissionVersion,
      },
      body,
      requestId: request.requestId,
      response,
    });
  }

  @Post('image-generations')
  @RequirePermission('ai:use')
  @RequireIdempotency({ highRisk: true })
  @HttpCode(HttpStatus.ACCEPTED)
  image(
    @Body() body: ImageGenerateDto,
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
  ) {
    const key = request.header('idempotency-key') ?? request.requestId;
    return this.ai.createImageJob(auth.userId, body, request.requestId, key);
  }

  @Get('image-generations/:jobId')
  @RequirePermission('ai:use')
  imageJob(@Param('jobId', new ParseUUIDPipe()) jobId: string, @CurrentAuth() auth: RequestAuthContext) {
    return this.ai.getJob(auth.userId, jobId);
  }

  @Post('image-generations/:jobId/cancel')
  @RequirePermission('ai:use')
  @RequireIdempotency({ highRisk: true })
  cancelImage(@Param('jobId', new ParseUUIDPipe()) jobId: string, @CurrentAuth() auth: RequestAuthContext) {
    return this.ai.cancelJob(auth.userId, jobId);
  }

  @Post('video-generations')
  @RequirePermission('ai:use')
  @RequireIdempotency({ highRisk: true })
  @HttpCode(HttpStatus.ACCEPTED)
  video(@Body() body: VideoGenerateDto, @CurrentAuth() auth: RequestAuthContext, @Req() request: Request) {
    const key = request.header('idempotency-key') ?? request.requestId;
    return this.ai.createVideoJob(auth.userId, body, request.requestId, key);
  }

  @Get('video-generations/:jobId')
  @RequirePermission('ai:use')
  videoJob(@Param('jobId', new ParseUUIDPipe()) jobId: string, @CurrentAuth() auth: RequestAuthContext) {
    return this.ai.getJob(auth.userId, jobId);
  }

  @Post('video-generations/:jobId/cancel')
  @RequirePermission('ai:use')
  @RequireIdempotency({ highRisk: true })
  cancelVideo(@Param('jobId', new ParseUUIDPipe()) jobId: string, @CurrentAuth() auth: RequestAuthContext) {
    return this.ai.cancelJob(auth.userId, jobId);
  }

  @Get('assets/:assetId/content')
  @RequirePermission('ai:use')
  @SkipResponseEnvelope()
  async assetContent(
    @Param('assetId', new ParseUUIDPipe()) assetId: string,
    @CurrentAuth() auth: RequestAuthContext,
    @Res() response: Response,
  ) {
    const file = await this.ai.getAssetContent(auth.userId, assetId);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Cache-Control', 'private, max-age=120');
    response.send(file.body);
  }

  @Get('assets')
  @RequirePermission('ai:use')
  assets(@Query() query: PageQueryDto, @CurrentAuth() auth: RequestAuthContext) {
    return this.ai.listAssets(auth.userId, query.page, query.pageSize);
  }

  @Post('assets')
  @RequirePermission('ai:use')
  @RequireIdempotency()
  createAsset(@Body() body: CreateAssetDto, @CurrentAuth() auth: RequestAuthContext) {
    return this.ai.createAsset(auth.userId, body);
  }

  @Patch('assets/:assetId')
  @RequirePermission('ai:use')
  @RequireIdempotency()
  patchAsset(
    @Param('assetId', new ParseUUIDPipe()) assetId: string,
    @Body() body: PatchAssetDto,
    @CurrentAuth() auth: RequestAuthContext,
  ) {
    return this.ai.patchAsset(auth.userId, assetId, body);
  }

  @Delete('assets/:assetId')
  @RequirePermission('ai:use')
  @RequireIdempotency()
  deleteAsset(
    @Param('assetId', new ParseUUIDPipe()) assetId: string,
    @CurrentAuth() auth: RequestAuthContext,
  ) {
    return this.ai.deleteAsset(auth.userId, assetId);
  }

  @Get('asset-folders')
  @RequirePermission('ai:use')
  folders(@CurrentAuth() auth: RequestAuthContext) {
    return this.ai.listFolders(auth.userId);
  }

  @Post('asset-folders')
  @RequirePermission('ai:use')
  @RequireIdempotency()
  createFolder(@Body() body: CreateFolderDto, @CurrentAuth() auth: RequestAuthContext) {
    return this.ai.createFolder(auth.userId, body.name);
  }

  @Patch('asset-folders/:folderId')
  @RequirePermission('ai:use')
  @RequireIdempotency()
  patchFolder(
    @Param('folderId', new ParseUUIDPipe()) folderId: string,
    @Body() body: CreateFolderDto,
    @CurrentAuth() auth: RequestAuthContext,
  ) {
    return this.ai.patchFolder(auth.userId, folderId, body.name);
  }

  @Delete('asset-folders/:folderId')
  @RequirePermission('ai:use')
  @RequireIdempotency()
  deleteFolder(
    @Param('folderId', new ParseUUIDPipe()) folderId: string,
    @CurrentAuth() auth: RequestAuthContext,
  ) {
    return this.ai.deleteFolder(auth.userId, folderId);
  }
}

@ApiTags('App Usage')
@ApiBearerAuth()
@Controller('app')
export class AppUsageController {
  constructor(private readonly ai: AiService) {}

  @Get('usage')
  @RequirePermission('ai:use')
  usage(@Query() query: UsageQueryDto, @CurrentAuth() auth: RequestAuthContext) {
    return this.ai.usage(auth.userId, query);
  }
}
