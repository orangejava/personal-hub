import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  AiAssetStatus,
  AiAssetType,
  AiFeedback,
  AiFinishReason,
  AiMessageRole,
  AiMessageStatus,
  AiOwnerType,
  AiStoppedBy,
  AiTitleSource,
  AiToolCode,
  AiToolGroup,
  AiToolStatus,
  FileAssetStatus,
  FilePurpose,
  Prisma,
  StorageProviderKind,
} from '@prisma/client';
import type { Response } from 'express';
import { DomainHttpException } from '../../common/errors/domain-http.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { STORAGE_PROVIDER, type StorageProvider } from '../../infrastructure/storage/storage.types';
import { OutboxService } from '../../infrastructure/queue/outbox.service';
import { AI_IMAGE_GENERATION_EVENT, AI_VIDEO_GENERATION_EVENT } from '../../infrastructure/queue/queue.constants';
import { estimateTextTokens, platformCost, AiQuotaService } from './ai-quota.service';
import { AiRuntimeService } from './ai-runtime.service';
import type { SendMessageDto, TextGenerateDto } from './dto/ai.dto';
import { AI_CHAT_PROVIDER, AI_IMAGE_PROVIDER, AI_VIDEO_PROVIDER, type AiChatProvider, type AiImageProvider, type AiVideoProvider } from './providers/ai-provider.types';

const GUEST_MAX_CHARS = 2000;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quota: AiQuotaService,
    private readonly runtime: AiRuntimeService,
    private readonly outbox: OutboxService,
    @Inject(AI_CHAT_PROVIDER) private readonly chatProvider: AiChatProvider,
    @Inject(AI_IMAGE_PROVIDER) private readonly imageProvider: AiImageProvider,
    @Inject(AI_VIDEO_PROVIDER) private readonly videoProvider: AiVideoProvider,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async home(owner: { type: AiOwnerType; id: string; userId?: string }) {
    const [tools, models, templates, entitlement, recent] = await Promise.all([
      this.prisma.aiTool.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.listVisibleModels(owner),
      this.prisma.aiTemplate.findMany({
        where: {
          deletedAt: null,
          status: 'ENABLED',
          // 访客没有 userId；不能写假 UUID（Prisma UUID 列会 500）。
          ...(owner.userId
            ? { OR: [{ isSystem: true }, { ownerId: owner.userId }] }
            : { isSystem: true }),
        },
        orderBy: { sortOrder: 'asc' },
        take: 20,
      }),
      owner.userId ? this.entitlement(owner.userId) : null,
      this.prisma.aiConversation.findMany({
        where: { ownerType: owner.type, ownerId: owner.id, deletedAt: null },
        orderBy: { lastMessageAt: 'desc' },
        take: 8,
      }),
    ]);
    return {
      brandName: 'Personal Hub AI',
      tools: tools.map(mapTool),
      models,
      templates: templates.map(mapTemplate),
      entitlement,
      quota: entitlement
        ? {
            remainingTokens: entitlement.remainingTokens,
            reservedTokens: entitlement.reservedTokens,
            usedTokens: entitlement.usedTokens,
            totalTokens: entitlement.totalTokens,
            lowBalanceThreshold: entitlement.lowBalanceThreshold,
          }
        : {
            remainingTokens: 0,
            reservedTokens: 0,
            usedTokens: 0,
            totalTokens: 0,
            lowBalanceThreshold: 0,
          },
      recentTasks: [],
      recentActivities: recent.map((row) => ({
        id: row.id,
        title: row.title,
        toolType: 'chat',
        status: 'done',
        modelId: row.modelId,
        path: `/ai/chat?sessionId=${row.id}`,
        createdAt: (row.lastMessageAt ?? row.createdAt).toISOString(),
      })),
    };
  }

  async listVisibleModels(owner: { type: AiOwnerType; id: string; userId?: string }) {
    const guest = owner.type === AiOwnerType.ANONYMOUS;
    const models = await this.prisma.aiModel.findMany({
      where: {
        enabled: true,
        userVisible: true,
        deprecatedAt: null,
        ...(guest ? { guestAllowed: true } : {}),
      },
      include: { provider: true },
      orderBy: { displayName: 'asc' },
    });
    if (!owner.userId) {
      return models.map(mapModel);
    }
    const entitlement = await this.prisma.aiEntitlement.findFirst({
      where: { role: { users: { some: { id: owner.userId } } } },
    });
    const allowed = Array.isArray(entitlement?.allowedModelIds)
      ? (entitlement.allowedModelIds as string[])
      : [];
    const filtered = allowed.length === 0 ? models : models.filter((model) => allowed.includes(model.id));
    return filtered.map(mapModel);
  }

  async entitlement(userId: string) {
    const [account, roleEntitlement, usage] = await Promise.all([
      this.prisma.aiQuotaAccount.findUnique({ where: { userId } }),
      this.prisma.aiEntitlement.findFirst({
        where: { role: { users: { some: { id: userId } } } },
      }),
      this.prisma.aiUsageRecord.aggregate({
        where: { userId },
        _sum: { platformCost: true },
      }),
    ]);
    const remaining = Number(account?.availableAmount ?? 0n);
    const reserved = Number(account?.reservedAmount ?? 0n);
    const used = usage._sum.platformCost ?? 0;
    return {
      remainingTokens: remaining,
      reservedTokens: reserved,
      usedTokens: used,
      totalTokens: remaining + reserved + used,
      lowBalanceThreshold: 500,
      maxConcurrent: roleEntitlement?.maxConcurrent ?? 1,
      rpm: roleEntitlement?.rpm ?? 20,
    };
  }

  async usage(userId: string) {
    const entitlement = await this.entitlement(userId);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const records = await this.prisma.aiUsageRecord.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { model: true },
    });
    const byDay = new Map<string, number>();
    const byTool = new Map<string, { tokens: number; calls: number }>();
    for (const row of records) {
      const day = row.createdAt.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + row.platformCost);
      const current = byTool.get(row.toolType) ?? { tokens: 0, calls: 0 };
      current.tokens += row.platformCost;
      current.calls += 1;
      byTool.set(row.toolType, current);
    }
    return {
      ...entitlement,
      trend: [...byDay.entries()].map(([date, tokens]) => ({ date, tokens })),
      toolUsage: [...byTool.entries()].map(([toolType, value]) => ({
        toolType,
        ...value,
      })),
      list: records.map((row) => ({
        id: row.id,
        toolType: row.toolType,
        tokens: row.platformCost,
        createdAt: row.createdAt.toISOString(),
        modelId: row.modelId,
      })),
    };
  }

  async listSessions(owner: { type: AiOwnerType; id: string }, page = 1, pageSize = 20) {
    const where = { ownerType: owner.type, ownerId: owner.id, deletedAt: null };
    const [list, total] = await Promise.all([
      this.prisma.aiConversation.findMany({
        where,
        orderBy: [{ pinnedAt: 'desc' }, { lastMessageAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.aiConversation.count({ where }),
    ]);
    return { list: list.map(mapSession), total, page, pageSize };
  }

  async createSession(
    owner: { type: AiOwnerType; id: string },
    input: { title?: string; modelId?: string; systemPrompt?: string },
  ) {
    const model = await this.resolveModel(input.modelId, owner.type === AiOwnerType.ANONYMOUS, AiToolCode.CHAT);
    return mapSession(
      await this.prisma.aiConversation.create({
        data: {
          ownerType: owner.type,
          ownerId: owner.id,
          title: input.title?.trim() || '新对话',
          modelId: model.id,
          systemPrompt: input.systemPrompt,
        },
      }),
    );
  }

  async patchSession(
    owner: { type: AiOwnerType; id: string },
    sessionId: string,
    input: { title?: string; modelId?: string; systemPrompt?: string },
  ) {
    await this.requireSession(owner, sessionId);
    const data: Prisma.AiConversationUpdateInput = {};
    if (input.title !== undefined) {
      data.title = input.title.trim();
      data.titleSource = AiTitleSource.USER;
    }
    if (input.modelId) {
      const model = await this.resolveModel(input.modelId, owner.type === AiOwnerType.ANONYMOUS, AiToolCode.CHAT);
      data.model = { connect: { id: model.id } };
    }
    if (input.systemPrompt !== undefined) {
      data.systemPrompt = input.systemPrompt;
    }
    return mapSession(await this.prisma.aiConversation.update({ where: { id: sessionId }, data }));
  }

  async deleteSession(owner: { type: AiOwnerType; id: string }, sessionId: string) {
    await this.requireSession(owner, sessionId);
    await this.prisma.aiConversation.update({
      where: { id: sessionId },
      data: { deletedAt: new Date() },
    });
    return { id: sessionId, deleted: true };
  }

  async listMessages(owner: { type: AiOwnerType; id: string }, sessionId: string, cursor?: string) {
    await this.requireSession(owner, sessionId);
    const list = await this.prisma.aiMessage.findMany({
      where: {
        conversationId: sessionId,
        isCurrentVariant: true,
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    return { list: list.map(mapMessage), nextCursor: null, hasMore: false };
  }

  async streamChat(input: {
    owner: { type: AiOwnerType; id: string; userId?: string };
    sessionId: string;
    body: SendMessageDto;
    requestId: string;
    response: Response;
    ipHash?: string;
  }) {
    const session = await this.requireSession(input.owner, input.sessionId);
    if (session.activeMessageId) {
      throw new DomainHttpException(
        HttpStatus.CONFLICT,
        'AI_GENERATION_IN_PROGRESS',
        '该会话已有生成进行中',
      );
    }
    if (input.owner.type === AiOwnerType.ANONYMOUS && input.body.content.length > GUEST_MAX_CHARS) {
      throw new DomainHttpException(HttpStatus.BAD_REQUEST, 'AI_INPUT_TOO_LONG', '访客输入最多 2000 字');
    }
    await this.runtime.acquireConversation(session.id);
    let assistantId = '';
    try {
      if (input.owner.userId) {
        const ent = await this.entitlement(input.owner.userId);
        await this.runtime.acquireUserSlot(input.owner.userId, ent.maxConcurrent);
        await this.runtime.hitRateLimit(`ai:rpm:${input.owner.userId}`, ent.rpm, 60);
      } else {
        await this.runtime.hitRateLimit(`ai:guest:rpm:${input.ipHash ?? input.owner.id}`, 5, 60);
      }
      const model = await this.resolveModel(
        input.body.modelId ?? session.modelId,
        input.owner.type === AiOwnerType.ANONYMOUS,
        AiToolCode.CHAT,
      );
      const inputTokens = estimateTextTokens(input.body.content);
      const reserveAmount = BigInt(model.maxReserveAmount);
      let reservationId: string | undefined;
      if (input.owner.userId) {
        const reservation = await this.quota.reserve({
          userId: input.owner.userId,
          amount: reserveAmount,
          requestId: input.requestId,
        });
        reservationId = reservation.id;
      }
      const excerpt = input.body.contentId
        ? await this.snapshotContent(input.body.contentId, input.owner.userId)
        : null;
      const userMessage = await this.prisma.aiMessage.create({
        data: {
          conversationId: session.id,
          role: AiMessageRole.USER,
          status: AiMessageStatus.DONE,
          content: input.body.content,
          inputTokens,
          requestId: input.requestId,
          references: excerpt
            ? {
                create: {
                  contentId: input.body.contentId,
                  titleSnapshot: excerpt.title,
                  excerptSnapshot: excerpt.excerpt,
                },
              }
            : undefined,
        },
      });
      const assistant = await this.prisma.aiMessage.create({
        data: {
          conversationId: session.id,
          role: AiMessageRole.ASSISTANT,
          status: AiMessageStatus.STREAMING,
          modelId: model.id,
          modelKeySnapshot: model.modelKey,
          reservationId,
          requestId: input.requestId,
          variantGroupId: undefined,
        },
      });
      assistantId = assistant.id;
      await this.prisma.aiConversation.update({
        where: { id: session.id },
        data: {
          activeMessageId: assistant.id,
          messageCount: { increment: 2 },
          lastMessageAt: new Date(),
          lastMessagePreview: input.body.content.slice(0, 200),
          title:
            session.titleSource === AiTitleSource.AUTO && session.messageCount === 0
              ? input.body.content.slice(0, 20)
              : undefined,
        },
      });
      beginSse(input.response);
      writeSse(input.response, { type: 'STARTED', assistantMessageId: assistant.id, sessionId: session.id });
      const signal = this.runtime.begin(assistant.id);
      const history = await this.prisma.aiMessage.findMany({
        where: { conversationId: session.id, isCurrentVariant: true },
        orderBy: { createdAt: 'asc' },
        take: session.contextLimit + 4,
      });
      const promptMessages = history
        .filter((row) => row.id !== assistant.id)
        .map((row) => ({
          role: row.role === AiMessageRole.ASSISTANT ? ('assistant' as const) : ('user' as const),
          content:
            row.id === userMessage.id && excerpt
              ? `${row.content}\n\n引用：${excerpt.title}\n${excerpt.excerpt}`
              : row.content,
        }));
      let output = '';
      try {
        for await (const delta of this.chatProvider.stream({
          modelKey: model.modelKey,
          systemPrompt: session.systemPrompt,
          messages: promptMessages,
          signal,
        })) {
          if (await this.runtime.isStopped(assistant.id)) {
            break;
          }
          output += delta.content;
          writeSse(input.response, { type: 'DELTA', content: delta.content });
        }
      } catch (error) {
        this.logger.warn(`Chat 流失败 ${assistant.id}: ${error instanceof Error ? error.message : error}`);
        await this.failRun({
          assistantId: assistant.id,
          sessionId: session.id,
          reservationId,
          userId: input.owner.userId,
          requestId: input.requestId,
        });
        writeSse(input.response, { type: 'ERROR', code: 'AI_PROVIDER_FAILED' });
        input.response.end();
        return;
      }
      const stopped = await this.runtime.isStopped(assistant.id);
      const outputTokens = estimateTextTokens(output);
      const cost = platformCost({
        inputTokens,
        outputTokens,
        inputPricePer1k: model.inputPricePer1k,
        outputPricePer1k: model.outputPricePer1k,
        fixedPlatformCost: model.fixedPlatformCost,
      });
      await this.prisma.aiMessage.update({
        where: { id: assistant.id },
        data: {
          content: output,
          outputTokens,
          status: stopped ? AiMessageStatus.STOPPED : AiMessageStatus.DONE,
          finishReason: stopped ? AiFinishReason.CANCELLED : AiFinishReason.STOP,
          stoppedBy: stopped ? AiStoppedBy.USER : null,
        },
      });
      await this.prisma.aiConversation.update({
        where: { id: session.id },
        data: {
          activeMessageId: null,
          totalInputTokens: { increment: inputTokens },
          totalOutputTokens: { increment: outputTokens },
        },
      });
      if (reservationId && input.owner.userId) {
        if (stopped && output.length === 0) {
          await this.quota.release(reservationId, input.requestId);
        } else {
          await this.quota.settle(reservationId, BigInt(cost), input.requestId);
        }
      }
      await this.prisma.aiUsageRecord.create({
        data: {
          userId: input.owner.userId,
          ownerType: input.owner.type,
          ownerId: input.owner.id,
          toolType: AiToolCode.CHAT,
          modelId: model.id,
          inputTokens,
          outputTokens,
          platformCost: cost,
          messageId: assistant.id,
        },
      });
      writeSse(input.response, {
        type: 'DONE',
        usage: { inputTokens, outputTokens, platformCost: cost },
      });
      input.response.end();
    } finally {
      this.runtime.finish(assistantId);
      await this.runtime.releaseConversation(session.id);
      if (input.owner.userId) {
        await this.runtime.releaseUserSlot(input.owner.userId);
      }
    }
  }

  async stopMessage(owner: { type: AiOwnerType; id: string }, messageId: string) {
    const message = await this.prisma.aiMessage.findFirst({
      where: { id: messageId, conversation: { ownerType: owner.type, ownerId: owner.id, deletedAt: null } },
    });
    if (!message) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'AI_GENERATION_NOT_FOUND', '生成记录不存在');
    }
    if (message.status !== AiMessageStatus.STREAMING) {
      return mapMessage(message);
    }
    await this.prisma.aiMessage.update({
      where: { id: messageId },
      data: { stopRequestedAt: new Date(), stoppedBy: AiStoppedBy.USER },
    });
    await this.runtime.requestStop(messageId);
    return { id: messageId, status: 'STOPPING' };
  }

  async regenerate(
    owner: { type: AiOwnerType; id: string; userId?: string },
    messageId: string,
    requestId: string,
    response: Response,
    ipHash?: string,
  ) {
    const message = await this.prisma.aiMessage.findFirst({
      where: { id: messageId, role: AiMessageRole.ASSISTANT },
      include: { conversation: true },
    });
    if (!message || message.conversation.ownerType !== owner.type || message.conversation.ownerId !== owner.id) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'AI_GENERATION_NOT_FOUND', '生成记录不存在');
    }
    const parentUser = await this.prisma.aiMessage.findFirst({
      where: {
        conversationId: message.conversationId,
        role: AiMessageRole.USER,
        createdAt: { lte: message.createdAt },
      },
      orderBy: { createdAt: 'desc' },
    });
    await this.prisma.aiMessage.update({
      where: { id: messageId },
      data: { isCurrentVariant: false },
    });
    await this.streamChat({
      owner,
      sessionId: message.conversationId,
      body: { content: parentUser?.content ?? '请重新生成' },
      requestId,
      response,
      ipHash,
    });
  }

  async feedback(owner: { type: AiOwnerType; id: string }, messageId: string, feedback?: AiFeedback | null) {
    const message = await this.prisma.aiMessage.findFirst({
      where: { id: messageId, conversation: { ownerType: owner.type, ownerId: owner.id } },
    });
    if (!message) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'AI_GENERATION_NOT_FOUND', '消息不存在');
    }
    return mapMessage(
      await this.prisma.aiMessage.update({
        where: { id: messageId },
        data: { feedback: feedback ?? null, feedbackAt: feedback ? new Date() : null },
      }),
    );
  }

  async streamText(input: {
    owner: { type: AiOwnerType; id: string; userId?: string };
    body: TextGenerateDto;
    requestId: string;
    response: Response;
    ipHash?: string;
  }) {
    const maxChars = input.owner.type === AiOwnerType.ANONYMOUS ? GUEST_MAX_CHARS : 8000;
    if (!input.body.input.trim()) {
      throw new DomainHttpException(HttpStatus.BAD_REQUEST, 'AI_INPUT_REQUIRED', '输入不能为空');
    }
    if (input.body.input.length > maxChars) {
      throw new DomainHttpException(HttpStatus.BAD_REQUEST, 'AI_INPUT_TOO_LONG', `输入最多 ${maxChars} 字`);
    }
    if (input.body.scenario === 'translate' && !input.body.targetLanguage) {
      throw new DomainHttpException(HttpStatus.BAD_REQUEST, 'AI_INPUT_REQUIRED', '翻译必须选择目标语言');
    }
    const session = await this.createSession(input.owner, {
      title: `文本生成 · ${input.body.scenario}`,
      modelId: input.body.modelId,
    });
    await this.streamChat({
      owner: input.owner,
      sessionId: session.id,
      body: {
        content: `场景:${input.body.scenario}\n语气:${input.body.tone ?? ''}\n长度:${input.body.length ?? ''}\n语言:${input.body.targetLanguage ?? ''}\n\n${input.body.input}`,
        modelId: input.body.modelId,
      },
      requestId: input.requestId,
      response: input.response,
      ipHash: input.ipHash,
    });
  }

  async createImageJob(userId: string, body: {
    prompt: string;
    negativePrompt?: string;
    modelId?: string;
    count?: number;
    size?: string;
    style?: string;
  }, requestId: string, idempotencyKey: string) {
    const model = await this.resolveModel(body.modelId, false, AiToolCode.IMAGE);
    const cost = model.fixedPlatformCost ?? 500;
    const reservation = await this.quota.reserve({
      userId,
      amount: BigInt(cost),
      requestId,
    });
    const job = await this.prisma.$transaction(async (tx) => {
      const created = await tx.aiGenerationJob.create({
        data: {
          userId,
          toolType: AiToolCode.IMAGE,
          modelId: model.id,
          modelKeySnapshot: model.modelKey,
          prompt: body.prompt,
          negativePrompt: body.negativePrompt,
          params: { count: body.count ?? 1, size: body.size, style: body.style },
          idempotencyKey,
          reservationId: reservation.id,
        },
      });
      await this.outbox.enqueue(tx, {
        aggregateType: 'AiGenerationJob',
        aggregateId: created.id,
        eventType: AI_IMAGE_GENERATION_EVENT,
        payload: { jobId: created.id },
      });
      return created;
    });
    return mapJob(job);
  }

  async createVideoJob(userId: string, body: { prompt: string; modelId?: string }, requestId: string, idempotencyKey: string) {
    const model = await this.resolveModel(body.modelId, false, AiToolCode.VIDEO);
    const cost = model.fixedPlatformCost ?? 800;
    const reservation = await this.quota.reserve({
      userId,
      amount: BigInt(cost),
      requestId,
    });
    const job = await this.prisma.$transaction(async (tx) => {
      const created = await tx.aiGenerationJob.create({
        data: {
          userId,
          toolType: AiToolCode.VIDEO,
          modelId: model.id,
          modelKeySnapshot: model.modelKey,
          prompt: body.prompt,
          idempotencyKey,
          reservationId: reservation.id,
        },
      });
      await this.outbox.enqueue(tx, {
        aggregateType: 'AiGenerationJob',
        aggregateId: created.id,
        eventType: AI_VIDEO_GENERATION_EVENT,
        payload: { jobId: created.id },
      });
      return created;
    });
    return mapJob(job);
  }

  async getJob(userId: string, jobId: string) {
    const job = await this.prisma.aiGenerationJob.findFirst({ where: { id: jobId, userId } });
    if (!job) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'AI_GENERATION_NOT_FOUND', '任务不存在');
    }
    return mapJob(job);
  }

  async cancelJob(userId: string, jobId: string) {
    const job = await this.prisma.aiGenerationJob.findFirst({ where: { id: jobId, userId } });
    if (!job) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'AI_GENERATION_NOT_FOUND', '任务不存在');
    }
    if (job.status === 'SUCCEEDED' || job.status === 'FAILED' || job.status === 'CANCELED') {
      return mapJob(job);
    }
    await this.prisma.aiGenerationJob.update({
      where: { id: jobId },
      data: { cancelRequestedAt: new Date(), status: job.status === 'QUEUED' ? 'CANCELED' : job.status },
    });
    await this.runtime.requestStop(jobId);
    if (job.status === 'QUEUED' && job.reservationId) {
      await this.quota.release(job.reservationId, jobId);
    }
    return this.getJob(userId, jobId);
  }

  async processJob(jobId: string): Promise<void> {
    const job = await this.prisma.aiGenerationJob.findUnique({
      where: { id: jobId },
      include: { model: true },
    });
    if (!job || job.status === 'CANCELED') {
      return;
    }
    if (job.cancelRequestedAt) {
      await this.prisma.aiGenerationJob.update({
        where: { id: jobId },
        data: { status: 'CANCELED', finishedAt: new Date() },
      });
      if (job.reservationId) {
        await this.quota.release(job.reservationId, jobId);
      }
      return;
    }
    await this.prisma.aiGenerationJob.update({
      where: { id: jobId },
      data: { status: 'PROCESSING', startedAt: new Date(), progress: 20 },
    });
    const provider = job.toolType === AiToolCode.VIDEO ? this.videoProvider : this.imageProvider;
    const count = Number((job.params as { count?: number } | null)?.count ?? 1);
    const buffers = await provider.generate({
      modelKey: job.modelKeySnapshot,
      prompt: job.prompt,
      negativePrompt: job.negativePrompt,
      count,
      signal: this.runtime.begin(jobId),
    });
    if (await this.runtime.isStopped(jobId)) {
      await this.prisma.aiGenerationJob.update({
        where: { id: jobId },
        data: { status: 'CANCELED', finishedAt: new Date() },
      });
      if (job.reservationId) {
        await this.quota.release(job.reservationId, jobId);
      }
      this.runtime.finish(jobId);
      return;
    }
    const fileIds: string[] = [];
    for (const [index, body] of buffers.entries()) {
      const file = await this.prisma.fileAsset.create({
        data: {
          uploaderId: job.userId,
          originalName: `${job.toolType.toLowerCase()}-${index + 1}.png`,
          objectKey: `ai/${job.userId}/${job.id}/${index}.png`,
          storageProvider: StorageProviderKind.MINIO,
          mimeType: 'image/png',
          size: body.length,
          purpose: FilePurpose.AI_ASSET,
          status: FileAssetStatus.READY,
        },
      });
      await this.storage.putObject(file.objectKey, body, 'image/png');
      fileIds.push(file.id);
      await this.prisma.aiAsset.create({
        data: {
          ownerId: job.userId,
          fileId: file.id,
          type: job.toolType === AiToolCode.VIDEO ? 'VIDEO' : 'IMAGE',
          source: 'GENERATED',
          status: AiAssetStatus.SAVED,
          title: job.prompt.slice(0, 80),
          prompt: job.prompt,
          modelId: job.modelId,
          sourceJobId: job.id,
        },
      });
    }
    const cost = job.model.fixedPlatformCost ?? 500;
    await this.prisma.aiGenerationJob.update({
      where: { id: jobId },
      data: {
        status: 'SUCCEEDED',
        progress: 100,
        resultFileIds: fileIds,
        finishedAt: new Date(),
      },
    });
    if (job.reservationId) {
      await this.quota.settle(job.reservationId, BigInt(cost), jobId);
    }
    await this.prisma.aiUsageRecord.create({
      data: {
        userId: job.userId,
        ownerType: AiOwnerType.USER,
        ownerId: job.userId,
        toolType: job.toolType,
        modelId: job.modelId,
        platformCost: cost,
        jobId,
      },
    });
    this.runtime.finish(jobId);
  }

  async createAsset(
    userId: string,
    input: { title: string; type?: 'TEXT' | 'IMAGE' | 'VIDEO'; prompt?: string; folderId?: string },
  ) {
    const row = await this.prisma.aiAsset.create({
      data: {
        ownerId: userId,
        type: input.type === 'IMAGE' ? AiAssetType.IMAGE : input.type === 'VIDEO' ? AiAssetType.VIDEO : AiAssetType.TEXT,
        source: 'GENERATED',
        status: AiAssetStatus.SAVED,
        title: input.title.slice(0, 160),
        prompt: input.prompt,
        folderId: input.folderId,
      },
    });
    return {
      id: row.id,
      title: row.title,
      type: row.type.toLowerCase(),
      source: 'generated',
      status: 'saved',
      prompt: row.prompt,
      folderId: row.folderId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listAssets(userId: string, page = 1, pageSize = 20) {
    const where = { ownerId: userId, deletedAt: null };
    const [list, total] = await Promise.all([
      this.prisma.aiAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { file: true, folder: true },
      }),
      this.prisma.aiAsset.count({ where }),
    ]);
    const mapped = [];
    for (const row of list) {
      mapped.push({
        id: row.id,
        title: row.title,
        type: row.type.toLowerCase(),
        source: row.source === 'GENERATED' ? 'generated' : row.source === 'UPLOADED' ? 'uploaded' : 'content-reference',
        status: row.status === 'TRASHED' ? 'trashed' : 'saved',
        prompt: row.prompt,
        folderId: row.folderId,
        folderName: row.folder?.name,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        fileUrl: row.file ? await this.storage.createSignedDownloadUrl(row.file.objectKey, 600) : undefined,
      });
    }
    return { list: mapped, total, page, pageSize };
  }

  async patchAsset(userId: string, assetId: string, input: { folderId?: string | null; status?: string; favorite?: boolean }) {
    const asset = await this.prisma.aiAsset.findFirst({ where: { id: assetId, ownerId: userId, deletedAt: null } });
    if (!asset) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'AI_GENERATION_NOT_FOUND', '资产不存在');
    }
    const data: Prisma.AiAssetUpdateInput = {};
    if (input.folderId !== undefined) {
      data.folder = input.folderId ? { connect: { id: input.folderId } } : { disconnect: true };
    }
    if (input.status === 'TRASHED') {
      data.status = AiAssetStatus.TRASHED;
      data.trashedAt = new Date();
    }
    if (input.status === 'SAVED') {
      data.status = AiAssetStatus.SAVED;
      data.trashedAt = null;
    }
    if (input.favorite === true) {
      data.favoriteAt = new Date();
    }
    if (input.favorite === false) {
      data.favoriteAt = null;
    }
    await this.prisma.aiAsset.update({ where: { id: assetId }, data });
    const page = await this.listAssets(userId, 1, 1);
    return page.list[0] ?? { id: assetId };
  }

  async deleteAsset(userId: string, assetId: string) {
    await this.prisma.aiAsset.updateMany({
      where: { id: assetId, ownerId: userId },
      data: { deletedAt: new Date() },
    });
    return { id: assetId, deleted: true };
  }

  async listFolders(userId: string) {
    const list = await this.prisma.aiAssetFolder.findMany({
      where: { ownerId: userId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { assets: true } } },
    });
    return list.map((row) => ({
      id: row.id,
      name: row.name,
      assetCount: row._count.assets,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async createFolder(userId: string, name: string) {
    const row = await this.prisma.aiAssetFolder.create({ data: { ownerId: userId, name: name.trim() } });
    return { id: row.id, name: row.name, assetCount: 0, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
  }

  async patchFolder(userId: string, folderId: string, name: string) {
    const row = await this.prisma.aiAssetFolder.updateMany({
      where: { id: folderId, ownerId: userId, deletedAt: null },
      data: { name: name.trim() },
    });
    if (row.count === 0) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'AI_GENERATION_NOT_FOUND', '文件夹不存在');
    }
    const folders = await this.listFolders(userId);
    return folders.find((item) => item.id === folderId);
  }

  async deleteFolder(userId: string, folderId: string) {
    const count = await this.prisma.aiAsset.count({
      where: { folderId, ownerId: userId, deletedAt: null },
    });
    if (count > 0) {
      throw new DomainHttpException(HttpStatus.CONFLICT, 'AI_FOLDER_NOT_EMPTY', '只能删除空文件夹');
    }
    await this.prisma.aiAssetFolder.updateMany({
      where: { id: folderId, ownerId: userId },
      data: { deletedAt: new Date() },
    });
    return { folderId, deleted: true };
  }

  async adminConfig() {
    const [providers, models, tools, templates, entitlements] = await Promise.all([
      this.prisma.aiProvider.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.aiModel.findMany({ include: { provider: true }, orderBy: { displayName: 'asc' } }),
      this.prisma.aiTool.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.prisma.aiTemplate.findMany({ where: { isSystem: true, deletedAt: null }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.aiEntitlement.findMany({ include: { role: true } }),
    ]);
    return {
      branding: {
        brandName: 'Personal Hub AI',
        logoText: 'PH',
        updatedAt: new Date().toISOString(),
      },
      providers: providers.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.label,
        label: row.label,
        enabled: row.enabled,
        baseUrl: row.baseUrl ?? '',
        apiKeyMasked: row.authEnvKey ? '********' : '',
        hasKey: Boolean(row.authEnvKey),
        updatedAt: row.updatedAt.toISOString(),
      })),
      models: models.map((row) => ({
        ...mapModel(row),
        modelId: row.modelKey,
        displayName: row.displayName,
        providerCode: row.provider.code,
        providerName: row.provider.label,
        visibleToUser: row.userVisible,
        contextTokens: row.contextWindowTokens,
        inputPricePer1k: row.inputPricePer1k,
        outputPricePer1k: row.outputPricePer1k,
      })),
      tools: tools.map((row) => ({
        ...mapTool(row),
        id: row.id,
        defaultModelId: row.defaultModelId ?? undefined,
        tokenCostLabel: '',
        sort: row.sortOrder,
      })),
      templates: templates.map(mapTemplate),
      entitlements: entitlements.map((row) => ({
        id: row.id,
        roleCode: row.role.code,
        roleId: row.roleId,
        maxConcurrent: row.maxConcurrent,
        verificationGrantAmount: Number(row.verificationGrantAmount),
        allowedModelIds: row.allowedModelIds,
      })),
    };
  }

  async adminStats() {
    const [jobs, usage] = await Promise.all([
      this.prisma.aiGenerationJob.groupBy({ by: ['status'], _count: true }),
      this.prisma.aiUsageRecord.aggregate({ _sum: { platformCost: true }, _count: true }),
    ]);
    return {
      summary: {
        totalTokens: usage._sum.platformCost ?? 0,
        totalCalls: usage._count,
        estimatedCost: usage._sum.platformCost ?? 0,
        activeUsers: 0,
      },
      trends: [],
      toolShares: [],
      userRanks: [],
      modelDistributions: [],
      jobs: jobs.map((row) => ({ status: row.status, count: row._count })),
      totalCalls: usage._count,
      totalPlatformCost: usage._sum.platformCost ?? 0,
    };
  }

  async patchProvider(id: string, input: { label?: string; name?: string; enabled?: boolean; baseUrl?: string }) {
    return this.prisma.aiProvider.update({
      where: { id },
      data: {
        label: input.label ?? input.name,
        enabled: input.enabled,
        baseUrl: input.baseUrl,
      },
    });
  }

  async patchModel(id: string, input: { displayName?: string; enabled?: boolean; userVisible?: boolean; visibleToUser?: boolean; isDefault?: boolean }) {
    const current = await this.prisma.aiModel.findUnique({ where: { id } });
    if (!current) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'AI_MODEL_NOT_AVAILABLE', '模型不存在');
    }
    if (input.enabled === true && current.inputPricePer1k === 0 && current.outputPricePer1k === 0 && current.fixedPlatformCost == null) {
      throw new DomainHttpException(HttpStatus.BAD_REQUEST, 'AI_MODEL_NOT_AVAILABLE', '缺少定价的模型不能启用');
    }
    return this.prisma.aiModel.update({
      where: { id },
      data: {
        displayName: input.displayName,
        enabled: input.enabled,
        userVisible: input.userVisible ?? input.visibleToUser,
        isDefault: input.isDefault,
      },
    });
  }

  async patchTool(id: string, input: { name?: string; status?: AiToolStatus; sortOrder?: number }) {
    return this.prisma.aiTool.update({ where: { id }, data: input });
  }

  async putEntitlement(roleId: string, input: { maxConcurrent?: number; allowedModelIds?: string[] }) {
    return this.prisma.aiEntitlement.update({
      where: { roleId },
      data: {
        maxConcurrent: input.maxConcurrent,
        allowedModelIds: input.allowedModelIds,
      },
    });
  }

  async createUserTemplate(userId: string, input: { toolType: AiToolCode; title: string; prompt: string; description?: string }) {
    const row = await this.prisma.aiTemplate.create({
      data: { ownerId: userId, isSystem: false, ...input },
    });
    return mapTemplate(row);
  }

  async patchUserTemplate(userId: string, templateId: string, input: { title?: string; prompt?: string }) {
    const row = await this.prisma.aiTemplate.findFirst({
      where: { id: templateId, ownerId: userId, isSystem: false, deletedAt: null },
    });
    if (!row) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'AI_GENERATION_NOT_FOUND', '模板不存在');
    }
    return mapTemplate(await this.prisma.aiTemplate.update({ where: { id: templateId }, data: input }));
  }

  async deleteUserTemplate(userId: string, templateId: string) {
    await this.prisma.aiTemplate.updateMany({
      where: { id: templateId, ownerId: userId, isSystem: false },
      data: { deletedAt: new Date() },
    });
    return { id: templateId, deleted: true };
  }

  private async resolveModel(modelId: string | undefined, guest: boolean, tool: AiToolCode) {
    const model = modelId
      ? await this.prisma.aiModel.findUnique({ where: { id: modelId }, include: { provider: true } })
      : await this.prisma.aiModel.findFirst({
          where: {
            enabled: true,
            userVisible: true,
            isDefault: true,
            toolTypes: { has: tool },
            ...(guest ? { guestAllowed: true } : {}),
          },
          include: { provider: true },
        });
    if (!model || !model.enabled || (guest && !model.guestAllowed) || !model.toolTypes.includes(tool)) {
      throw new DomainHttpException(HttpStatus.CONFLICT, 'AI_MODEL_NOT_AVAILABLE', '模型不可用或不在权益范围内');
    }
    if (model.inputPricePer1k === 0 && model.outputPricePer1k === 0 && model.fixedPlatformCost == null) {
      throw new DomainHttpException(HttpStatus.CONFLICT, 'AI_MODEL_NOT_AVAILABLE', '模型缺少定价规则');
    }
    return model;
  }

  private async requireSession(owner: { type: AiOwnerType; id: string }, sessionId: string) {
    const session = await this.prisma.aiConversation.findFirst({
      where: { id: sessionId, ownerType: owner.type, ownerId: owner.id, deletedAt: null },
    });
    if (!session) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'AI_GENERATION_NOT_FOUND', '会话不存在');
    }
    return session;
  }

  private async snapshotContent(contentId: string, userId?: string) {
    const content = await this.prisma.content.findFirst({
      where: { id: contentId, deletedAt: null },
      include: { body: true },
    });
    if (!content) {
      return null;
    }
    if (content.visibility === 'PRIVATE' && content.authorId !== userId) {
      return null;
    }
    const source = content.body?.markdownSource ?? content.summary ?? '';
    return { title: content.title ?? '未命名', excerpt: source.slice(0, 800) };
  }

  private async failRun(input: {
    assistantId: string;
    sessionId: string;
    reservationId?: string;
    userId?: string;
    requestId: string;
  }) {
    await this.prisma.aiMessage.update({
      where: { id: input.assistantId },
      data: { status: AiMessageStatus.FAILED, finishReason: AiFinishReason.ERROR, errorCode: 'AI_PROVIDER_FAILED' },
    });
    await this.prisma.aiConversation.update({
      where: { id: input.sessionId },
      data: { activeMessageId: null },
    });
    if (input.reservationId) {
      await this.quota.release(input.reservationId, input.requestId);
    }
  }
}

function beginSse(response: Response): void {
  response.status(HttpStatus.OK);
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  response.setHeader('X-Accel-Buffering', 'no');
  response.flushHeaders?.();
}

function writeSse(response: Response, payload: Record<string, unknown>): void {
  response.write(`event: message\ndata: ${JSON.stringify(payload)}\n\n`);
}

function mapTool(row: {
  code: AiToolCode;
  name: string;
  description: string;
  icon: string;
  status: AiToolStatus;
  requiresLogin: boolean;
  guestTrialEnabled: boolean;
  defaultModelId: string | null;
  groupName?: AiToolGroup;
}) {
  const code = row.code.toLowerCase();
  return {
    code,
    name: row.name,
    description: row.description,
    icon: row.icon,
    status: row.status === 'COMING_SOON' ? 'comingSoon' : row.status.toLowerCase(),
    requiresLogin: row.requiresLogin,
    guestTrialEnabled: row.guestTrialEnabled,
    defaultModelId: row.defaultModelId,
    group: (row.groupName ?? 'CREATE').toLowerCase(),
    path: `/ai/${code}`,
  };
}

function mapModel(row: {
  id: string;
  displayName: string;
  modelKey: string;
  enabled: boolean;
  isDefault: boolean;
  toolTypes: AiToolCode[];
  provider?: { label: string } | null;
}) {
  return {
    id: row.id,
    name: row.displayName,
    provider: row.provider?.label ?? 'fake',
    toolTypes: row.toolTypes.map((item) => item.toLowerCase()),
    enabled: row.enabled,
    isDefault: row.isDefault,
  };
}

function mapTemplate(row: {
  id: string;
  title: string;
  description: string | null;
  toolType: AiToolCode;
  prompt: string;
  textScenario: string | null;
  modelId: string | null;
}) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    toolType: row.toolType.toLowerCase(),
    prompt: row.prompt,
    textScenario: row.textScenario,
    modelId: row.modelId ?? '',
    coverUrl: '',
    tags: [],
    usageCount: 0,
  };
}

function mapSession(row: {
  id: string;
  title: string;
  modelId: string;
  systemPrompt: string | null;
  contextLimit: number;
  enableKnowledgeReference: boolean;
  messageCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  lastMessageAt: Date | null;
}) {
  return {
    id: row.id,
    title: row.title,
    modelId: row.modelId,
    systemPrompt: row.systemPrompt ?? undefined,
    contextLimit: row.contextLimit,
    enableKnowledgeReference: row.enableKnowledgeReference,
    messageCount: row.messageCount,
    totalTokens: row.totalInputTokens + row.totalOutputTokens,
    lastMessageAt: (row.lastMessageAt ?? new Date()).toISOString(),
  };
}

function mapMessage(row: {
  id: string;
  conversationId: string;
  role: AiMessageRole;
  content: string;
  status: AiMessageStatus;
  createdAt: Date;
  outputTokens: number;
  inputTokens: number;
  feedback: AiFeedback | null;
  feedbackAt: Date | null;
}) {
  const status =
    row.status === 'STREAMING'
      ? 'generating'
      : row.status === 'STOPPED'
        ? 'stopped'
        : row.status === 'FAILED'
          ? 'failed'
          : 'done';
  return {
    id: row.id,
    sessionId: row.conversationId,
    role: row.role.toLowerCase(),
    content: row.content,
    status,
    createdAt: row.createdAt.toISOString(),
    tokenCount: row.inputTokens + row.outputTokens,
    feedback: row.feedback === 'DISLIKE' ? 'dislike' : undefined,
    feedbackAt: row.feedbackAt?.toISOString(),
  };
}

function mapJob(row: {
  id: string;
  toolType: AiToolCode;
  prompt: string;
  modelId: string;
  status: string;
  createdAt: Date;
  resultFileIds: Prisma.JsonValue;
}) {
  const status =
    row.status === 'SUCCEEDED' ? 'done' : row.status === 'FAILED' ? 'failed' : row.status === 'CANCELED' ? 'stopped' : 'generating';
  return {
    id: row.id,
    toolType: row.toolType.toLowerCase(),
    title: row.prompt.slice(0, 40),
    prompt: row.prompt,
    modelId: row.modelId,
    status,
    assetIds: Array.isArray(row.resultFileIds) ? row.resultFileIds : [],
    createdAt: row.createdAt.toISOString(),
  };
}
