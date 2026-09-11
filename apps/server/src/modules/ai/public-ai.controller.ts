import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AiOwnerType } from '@prisma/client';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { SkipResponseEnvelope } from '../../common/decorators/skip-response-envelope.decorator';
import { RequireIdempotency } from '../../common/idempotency/require-idempotency.decorator';
import { AiAnonymousGuard } from './ai-anonymous.guard';
import { AiService } from './ai.service';
import { PublicChatDto, CreateSessionDto, TextGenerateDto } from './dto/ai.dto';

@ApiTags('Public AI')
@Controller('public/ai')
export class PublicAiController {
  constructor(
    private readonly ai: AiService,
    private readonly anonymous: AiAnonymousGuard,
  ) {}

  @Public()
  @Get('home')
  async home(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.anonymous.peek(request, response);
    return this.ai.home({
      type: AiOwnerType.ANONYMOUS,
      id: request.aiAnonymousId ?? '00000000-0000-4000-8000-000000000000',
    });
  }

  @Public()
  @Get('models')
  async models(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.anonymous.peek(request, response);
    return this.ai.listVisibleModels({
      type: AiOwnerType.ANONYMOUS,
      id: request.aiAnonymousId ?? '00000000-0000-4000-8000-000000000000',
    });
  }

  @Public()
  @Post('sessions')
  @UseGuards(AiAnonymousGuard)
  @RequireIdempotency()
  createSession(@Body() body: CreateSessionDto, @Req() request: Request) {
    return this.ai.createSession(this.owner(request), body);
  }

  @Public()
  @Post('chat')
  @UseGuards(AiAnonymousGuard)
  @RequireIdempotency({ highRisk: true })
  @SkipResponseEnvelope()
  async chat(
    @Body() body: PublicChatDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const owner = this.owner(request);
    const sessionId = body.sessionId ?? (await this.ai.createSession(owner, { title: '访客对话' })).id;
    await this.ai.streamChat({
      owner,
      sessionId,
      body: { content: body.content },
      requestId: request.requestId,
      response,
      ipHash: request.aiAnonymousId,
    });
  }

  @Public()
  @Post('text-generations')
  @UseGuards(AiAnonymousGuard)
  @RequireIdempotency({ highRisk: true })
  @SkipResponseEnvelope()
  async text(
    @Body() body: TextGenerateDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.ai.streamText({
      owner: this.owner(request),
      body,
      requestId: request.requestId,
      response,
      ipHash: request.aiAnonymousId,
    });
  }

  @Public()
  @Post('messages/:messageId/stop')
  @UseGuards(AiAnonymousGuard)
  @RequireIdempotency({ highRisk: true })
  stop(@Param('messageId', new ParseUUIDPipe()) messageId: string, @Req() request: Request) {
    return this.ai.stopMessage(this.owner(request), messageId);
  }

  private owner(request: Request) {
    const id = request.aiAnonymousId;
    if (!id) {
      throw new Error('匿名主体未初始化');
    }
    return { type: AiOwnerType.ANONYMOUS, id };
  }
}
