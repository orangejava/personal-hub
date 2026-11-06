import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  AiAssetStatus,
  AiAssetType,
  AiCredentialOwnerType,
  AiFeedback,
  AiFinishReason,
  AiGenerationJobStatus,
  AiMessageRole,
  type AiMessage as DbAiMessage,
  AiMessageStatus,
  AiModality,
  AiNavStatus,
  AiOwnerType,
  AiStoppedBy,
  AiTitleSource,
  AiToolCode,
  AiToolGroup,
  AiToolStatus,
  ContentStatus,
  FileAssetStatus,
  FilePurpose,
  Prisma,
  RoleCode,
  StorageProviderKind,
} from '@prisma/client';
import type { Response } from 'express';
import { DomainHttpException } from '../../common/errors/domain-http.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { STORAGE_PROVIDER, type StorageProvider } from '../../infrastructure/storage/storage.types';
import { OutboxService } from '../../infrastructure/queue/outbox.service';
import {
  AI_IMAGE_GENERATION_EVENT,
  AI_VIDEO_GENERATION_EVENT,
} from '../../infrastructure/queue/queue.constants';
import { parseGroupValue, type AiBranding } from '../system/config-registry';
import { SystemService } from '../system/system.service';
import { AuthService } from '../auth/auth.service';
import { AiCredentialService } from './ai-credential.service';
import { AiUserProviderService } from './ai-user-provider.service';
import { shanghaiDate } from './ai-reward.service';
import { probeProviderConnection } from './ai-provider-probe';
import { lockModelConfig, updateModelDefaults, validateModelConfig } from './ai-model-config';
import { estimateTextTokens, platformCost, AiQuotaService } from './ai-quota.service';
import { AiRuntimeService } from './ai-runtime.service';
import type { CreateModelDto, SendMessageDto, TextGenerateDto } from './dto/ai.dto';
import {
  AI_CHAT_PROVIDER,
  AI_IMAGE_PROVIDER,
  AI_VIDEO_PROVIDER,
  type AiChatProvider,
  type AiImageProvider,
  type AiVideoProvider,
} from './providers/ai-provider.types';

const GUEST_MAX_CHARS = 2000;

interface RuntimeTextModel {
  id: string;
  userModelId?: string;
  userCredentialId?: string;
  modelKey: string;
  maxReserveAmount: number;
  maxOutputTokens: number;
  inputPricePer1k: number;
  outputPricePer1k: number;
  fixedPlatformCost: number | null;
  chargePlatform: boolean;
  provider: {
    id: string;
    code: string;
    baseUrl: string | null;
    authEnvKey: string | null;
    timeoutMs: number;
  };
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quota: AiQuotaService,
    private readonly credentials: AiCredentialService,
    private readonly userProviders: AiUserProviderService,
    private readonly runtime: AiRuntimeService,
    private readonly outbox: OutboxService,
    private readonly system: SystemService,
    private readonly auth: AuthService,
    @Inject(AI_CHAT_PROVIDER) private readonly chatProvider: AiChatProvider,
    @Inject(AI_IMAGE_PROVIDER) private readonly imageProvider: AiImageProvider,
    @Inject(AI_VIDEO_PROVIDER) private readonly videoProvider: AiVideoProvider,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async home(owner: { type: AiOwnerType; id: string; userId?: string }) {
    const [tools, models, templates, entitlement, recent, branding, jobs, guestTrial] =
      await Promise.all([
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
        this.readBranding(),
        owner.userId
          ? this.prisma.aiGenerationJob.findMany({
              where: { userId: owner.userId },
              orderBy: { createdAt: 'desc' },
              take: 8,
              include: {
                model: { select: { displayName: true } },
                assets: { where: { deletedAt: null }, include: { file: true } },
              },
            })
          : Promise.resolve([]),
        owner.type === AiOwnerType.ANONYMOUS ? this.guestTrial(owner.id) : Promise.resolve(null),
      ]);
    const recentTasks = jobs.map((job) => mapJob(job, job.assets));
    const chatActivities = recent.map((row) => ({
      id: row.id,
      title: row.title,
      toolType: 'chat' as const,
      status: 'done' as const,
      modelId: row.userModelId ?? row.modelId ?? '',
      path: `/ai/chat?sessionId=${row.id}`,
      createdAt: (row.lastMessageAt ?? row.createdAt).toISOString(),
    }));
    const jobActivities = recentTasks.map((task) => ({
      id: task.id,
      title: task.title,
      toolType: task.toolType,
      status: task.status,
      modelId: task.modelId,
      path: `/ai/${task.toolType}`,
      createdAt: task.createdAt,
    }));
    const recentActivities = [...chatActivities, ...jobActivities]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 8);
    return {
      brandName: branding.brandName,
      logoText: branding.logoText,
      tools: tools.map(mapTool),
      models,
      templates: templates.map(mapTemplate),
      entitlement,
      guestTrial,
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
      recentTasks,
      recentActivities,
    };
  }

  async listVisibleModels(owner: { type: AiOwnerType; id: string; userId?: string }) {
    const guest = owner.type === AiOwnerType.ANONYMOUS;
    const models = await this.prisma.aiModel.findMany({
      where: {
        enabled: true,
        userVisible: true,
        deprecatedAt: null,
        provider: { enabled: true },
        ...(guest ? { guestAllowed: true } : {}),
      },
      include: { provider: true, defaultForTools: { select: { code: true } } },
      orderBy: { displayName: 'asc' },
    });
    if (!owner.userId) {
      const guestModels = models.map((row) => ({
        ...mapModel(row),
        quotaRequiredToolTypes: row.toolTypes.map((tool) => tool.toLowerCase()),
        requiresPlatformQuota: true,
      }));
      if ((await this.readBranding()).userCanPickModel) return guestModels;
      return guestModels
        .map((row) => ({
          ...row,
          toolTypes: row.toolTypes.filter((tool) => row.defaultToolTypes?.includes(tool)),
          quotaRequiredToolTypes: row.quotaRequiredToolTypes.filter((tool) =>
            row.defaultToolTypes?.includes(tool),
          ),
        }))
        .filter((row) => row.toolTypes.length > 0);
    }
    const entitlement = await this.prisma.aiEntitlement.findFirst({
      where: { role: { users: { some: { id: owner.userId } } } },
    });
    const allowed = Array.isArray(entitlement?.allowedModelIds)
      ? (entitlement.allowedModelIds as string[])
      : [];
    const filtered =
      allowed.length === 0 ? models : models.filter((model) => allowed.includes(model.id));
    const systemModels = filtered.map((row) => ({
      ...mapModel(row),
      quotaRequiredToolTypes: row.toolTypes.map((tool) => tool.toLowerCase()),
      requiresPlatformQuota: true,
    }));
    const mode = await this.userProviders.activeMode(owner.userId);
    // 关闭改选时只公开每个工具自己的默认关系，避免跨工具默认模型出现在错误的下拉框。
    const selectableSystem = mode.userCanPickModel
      ? systemModels
      : systemModels
          .map((row) => ({
            ...row,
            toolTypes: row.toolTypes.filter((tool) => row.defaultToolTypes?.includes(tool)),
            quotaRequiredToolTypes: row.quotaRequiredToolTypes.filter((tool) =>
              row.defaultToolTypes?.includes(tool),
            ),
          }))
          .filter((row) => row.toolTypes.length > 0);
    if (mode.enabled && !mode.allowed) {
      // 保留图片/视频的系统模型；Chat/Text 的运行入口会拒绝，目录也必须标明不可发送。
      return selectableSystem.map((row) => ({
        ...row,
        blockedToolTypes: row.toolTypes.filter((tool) => tool === 'chat' || tool === 'text'),
      }));
    }
    if (!mode.enabled) return selectableSystem;
    const [userModels, userCredentials] = await Promise.all([
      this.prisma.aiUserModel.findMany({
        where: { userId: owner.userId, enabled: true, credential: { enabled: true } },
        include: { credential: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.aiProviderCredential.findMany({
        where: {
          ownerType: AiCredentialOwnerType.USER,
          userId: owner.userId,
          enabled: true,
          providerId: { in: filtered.map((row) => row.providerId) },
        },
        select: { providerId: true },
      }),
    ]);
    const credentialProviderIds = new Set(
      userCredentials.map((row) => row.providerId).filter((id): id is string => id !== null),
    );
    const defaultUserModelId =
      mode.preferredUserModelId && userModels.some((row) => row.id === mode.preferredUserModelId)
        ? mode.preferredUserModelId
        : userModels[0]?.id;
    const custom = userModels.map((row) => ({
      id: row.id,
      name: row.displayName,
      provider: row.credential?.label ?? '自备厂商',
      providerCode: row.credential?.code ?? 'user',
      providerName: row.credential?.label ?? '自备厂商',
      toolTypes: ['chat', 'text'],
      enabled: true,
      isDefault: row.id === defaultUserModelId,
      defaultToolTypes: row.id === defaultUserModelId ? ['chat', 'text'] : [],
      source: 'USER',
      quotaRequiredToolTypes: [],
      requiresPlatformQuota: false,
    }));
    const hasUserDefault = Boolean(defaultUserModelId);
    return [
      ...custom,
      ...selectableSystem.map((row) => {
        // 自备模式不能用系统 Key；没有同厂商用户 Key 的文本工具只展示为不可调用。
        const blockedToolTypes: string[] = row.providerId && credentialProviderIds.has(row.providerId)
          ? []
          : row.toolTypes.filter((tool) => tool === 'chat' || tool === 'text');
        // 图片/视频仍由系统 Provider 执行并预占额度；文本工具才受用户 Key 扣额开关控制。
        const quotaRequiredToolTypes = row.toolTypes.filter(
          (tool) =>
            !blockedToolTypes.includes(tool) &&
            (tool === 'image' || tool === 'video' || mode.userKeyConsumesQuota),
        );
        const defaultToolTypes = row.defaultToolTypes?.filter(
          (tool) =>
            !blockedToolTypes.includes(tool) &&
            (!hasUserDefault || tool === 'image' || tool === 'video'),
        );
        return {
          ...row,
          isDefault: Boolean(defaultToolTypes?.length),
          defaultToolTypes,
          blockedToolTypes,
          quotaRequiredToolTypes,
          requiresPlatformQuota: quotaRequiredToolTypes.length > 0,
        };
      }),
    ];
  }

  async entitlement(userId: string) {
    const [account, roleEntitlement, usage, user] = await Promise.all([
      this.prisma.aiQuotaAccount.findUnique({ where: { userId } }),
      this.prisma.aiEntitlement.findFirst({
        where: { role: { users: { some: { id: userId } } } },
        include: { role: true },
      }),
      this.prisma.aiUsageRecord.aggregate({
        where: { userId },
        _sum: { platformCost: true, inputTokens: true, outputTokens: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { nickname: true, email: true, role: { select: { code: true } } },
      }),
    ]);
    const remaining = Number(account?.availableAmount ?? 0n);
    const reserved = Number(account?.reservedAmount ?? 0n);
    const used = usage._sum.platformCost ?? 0;
    const plan = mapPlan(roleEntitlement?.role.code ?? user?.role.code);
    return {
      remainingTokens: remaining,
      reservedTokens: reserved,
      usedTokens: used,
      totalTokens: remaining + reserved + used,
      lowBalanceThreshold: 500,
      maxConcurrent: roleEntitlement?.maxConcurrent ?? 1,
      rpm: roleEntitlement?.rpm ?? 20,
      rpd: roleEntitlement?.rpd ?? 200,
      inputTokens: usage._sum.inputTokens ?? 0,
      outputTokens: usage._sum.outputTokens ?? 0,
      currentPlanId: plan.id,
      currentPlanName: plan.name,
      plan,
      allowedToolCodes: Array.isArray(roleEntitlement?.allowedToolCodes)
        ? roleEntitlement.allowedToolCodes
        : [],
      allowedModelIds: Array.isArray(roleEntitlement?.allowedModelIds)
        ? roleEntitlement.allowedModelIds
        : [],
      nickname: user?.nickname ?? user?.email ?? '用户',
    };
  }

  async usage(
    userId: string,
    query: {
      page?: number;
      pageSize?: number;
      from?: string;
      to?: string;
      toolType?: AiToolCode;
    } = {},
  ) {
    const entitlement = await this.entitlement(userId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    // 默认展示上海自然日的今天及之前 29 天，避免凌晨附近出现第 31 个日期。
    const defaultFrom = new Date(`${shanghaiDate()}T00:00:00+08:00`);
    defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29);
    const from = query.from ? new Date(query.from) : defaultFrom;
    const to = query.to ? new Date(query.to) : new Date();
    const where = {
      userId,
      createdAt: { gte: from, lte: to },
      ...(query.toolType ? { toolType: query.toolType } : {}),
    };
    // 明细仍分页；趋势和工具分布在数据库按全部匹配记录聚合，不能从当前页推算。
    const aggregates = this.prisma.$queryRaw<
      Array<{ date: string; toolType: AiToolCode; tokens: bigint; calls: bigint }>
    >(Prisma.sql`
      SELECT to_char(created_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD') AS date,
             tool_type AS "toolType",
             COALESCE(SUM(input_tokens + output_tokens), 0)::bigint AS tokens,
             COUNT(*)::bigint AS calls
      FROM ai_usage_records
      WHERE user_id = ${userId}::uuid
        AND created_at >= ${from}
        AND created_at <= ${to}
        ${query.toolType ? Prisma.sql`AND tool_type::text = ${query.toolType}` : Prisma.empty}
      GROUP BY 1, 2
      ORDER BY 1 ASC
    `);
    const [records, total, summary] = await Promise.all([
      this.prisma.aiUsageRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { model: true },
      }),
      this.prisma.aiUsageRecord.count({ where }),
      aggregates,
    ]);
    const byDay = new Map<string, number>();
    const byTool = new Map<string, { tokens: number; calls: number }>();
    for (const row of summary) {
      const tokens = Number(row.tokens);
      byDay.set(row.date, (byDay.get(row.date) ?? 0) + tokens);
      const current = byTool.get(row.toolType) ?? { tokens: 0, calls: 0 };
      current.tokens += tokens;
      current.calls += Number(row.calls);
      byTool.set(row.toolType, current);
    }
    return {
      ...entitlement,
      trend: [...byDay.entries()].map(([date, tokens]) => ({ date, tokens })),
      toolUsage: [...byTool.entries()].map(([toolType, value]) => ({
        toolType: toolType.toLowerCase(),
        toolName: toolType.toLowerCase(),
        ...value,
      })),
      list: records.map((row) => ({
        id: row.id,
        toolType: row.toolType.toLowerCase(),
        toolName: row.toolType.toLowerCase(),
        tokens: row.inputTokens + row.outputTokens,
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        platformCost: row.platformCost,
        modelId: row.modelId,
        modelName: row.model?.displayName,
        createdAt: row.createdAt.toISOString(),
        reason: `${row.toolType.toLowerCase()} 结算`,
      })),
      total,
      page,
      pageSize,
    };
  }

  async listSessions(
    owner: { type: AiOwnerType; id: string },
    page = 1,
    pageSize = 20,
    keyword?: string,
  ) {
    const normalizedKeyword = keyword?.trim();
    const where = {
      ownerType: owner.type,
      ownerId: owner.id,
      deletedAt: null,
      ...(normalizedKeyword
        ? { title: { contains: normalizedKeyword, mode: 'insensitive' as const } }
        : {}),
    };
    const [list, total] = await Promise.all([
      this.prisma.aiConversation.findMany({
        where,
        orderBy: [{ pinnedAt: 'desc' }, { lastMessageAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          model: { select: { displayName: true, provider: { select: { label: true } } } },
          userModel: { select: { displayName: true, credential: { select: { label: true } } } },
        },
      }),
      this.prisma.aiConversation.count({ where }),
    ]);
    return { list: list.map(mapSession), total, page, pageSize };
  }

  async createSession(
    owner: { type: AiOwnerType; id: string; userId?: string; permissionVersion?: number },
    input: { title?: string; modelId?: string; systemPrompt?: string; toolCode?: AiToolCode },
  ) {
    const toolCode = input.toolCode ?? AiToolCode.CHAT;
    await this.assertToolAvailable(toolCode, owner);
    const model = await this.resolveTextModel(input.modelId, owner, toolCode);
    return mapSession(
      await this.prisma.aiConversation.create({
        data: {
          ownerType: owner.type,
          ownerId: owner.id,
          title: input.title?.trim() || '新对话',
          modelId: model.userModelId ? null : model.id,
          userModelId: model.userModelId ?? null,
          systemPrompt: input.systemPrompt,
        },
      }),
    );
  }

  async patchSession(
    owner: { type: AiOwnerType; id: string; userId?: string },
    sessionId: string,
    input: { title?: string; modelId?: string; systemPrompt?: string },
  ) {
    await this.requireSession(owner, sessionId);
    await this.assertToolAvailable(AiToolCode.CHAT, owner);
    const data: Prisma.AiConversationUncheckedUpdateInput = {};
    if (input.title !== undefined) {
      data.title = input.title.trim();
      data.titleSource = AiTitleSource.USER;
    }
    if (input.modelId) {
      const model = await this.resolveTextModel(input.modelId, owner, AiToolCode.CHAT);
      // 数据库要求两个模型外键恰好一个非空；嵌套 connect/disconnect 会拆成多次 UPDATE。
      data.modelId = model.userModelId ? null : model.id;
      data.userModelId = model.userModelId ?? null;
    }
    if (input.systemPrompt !== undefined) {
      data.systemPrompt = input.systemPrompt;
    }
    return mapSession(await this.prisma.aiConversation.update({ where: { id: sessionId }, data }));
  }

  async deleteSession(owner: { type: AiOwnerType; id: string }, sessionId: string) {
    await this.requireSession(owner, sessionId);
    const token = await this.runtime.acquireConversation(sessionId);
    try {
      const session = await this.requireSession(owner, sessionId);
      if (session.activeMessageId) {
        throw new DomainHttpException(
          HttpStatus.CONFLICT,
          'AI_GENERATION_IN_PROGRESS',
          '该对话仍在生成，请停止或等待完成后再删除',
        );
      }
      await this.prisma.aiConversation.update({
        where: { id: sessionId },
        data: { deletedAt: new Date() },
      });
      return { id: sessionId, deleted: true };
    } finally {
      await this.runtime.releaseConversation(sessionId, token);
    }
  }

  async listMessages(owner: { type: AiOwnerType; id: string }, sessionId: string, cursor?: string) {
    await this.requireSession(owner, sessionId);
    const list = await this.prisma.aiMessage.findMany({
      where: {
        conversationId: sessionId,
        isCurrentVariant: true,
      },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 101,
    });
    const page = list.slice(0, 100);
    return {
      list: page.map(mapMessage),
      nextCursor: list.length > 100 ? page.at(-1)!.id : null,
      hasMore: list.length > 100,
    };
  }

  async streamChat(input: {
    owner: { type: AiOwnerType; id: string; userId?: string; permissionVersion?: number };
    sessionId: string;
    body: SendMessageDto;
    requestId: string;
    response: Response;
    ipHash?: string;
    toolCode?: AiToolCode;
    /** 内部重新生成入口：复用原问题，直到新消息事务提交才隐藏旧回答。 */
    regenerateFrom?: { assistantId: string; userMessageId: string };
  }) {
    const startedAtMs = Date.now();
    const toolCode = input.toolCode ?? AiToolCode.CHAT;
    await this.assertToolAvailable(toolCode, input.owner);
    let session = await this.requireSession(input.owner, input.sessionId);
    if (session.activeMessageId) {
      throw new DomainHttpException(
        HttpStatus.CONFLICT,
        'AI_GENERATION_IN_PROGRESS',
        '该会话已有生成进行中',
      );
    }
    if (input.owner.type === AiOwnerType.ANONYMOUS && input.body.content.length > GUEST_MAX_CHARS) {
      throw new DomainHttpException(
        HttpStatus.BAD_REQUEST,
        'AI_INPUT_TOO_LONG',
        '访客输入最多 2000 字',
      );
    }
    const conversationToken = await this.runtime.acquireConversation(session.id);
    let assistantId = '';
    let userSlotAcquired = false;
    let userSlotToken: string | undefined;
    let userSlotHeartbeat: NodeJS.Timeout | undefined;
    let streamStarted = false;
    let reservationFinalized = false;
    let messageFinalized = false;
    let providerStreamCompleted = false;
    let reservationId: string | undefined;
    let originalMessage: DbAiMessage | null = null;
    // 离页/断网会关闭响应；普通切换会话保持 SSE 连接，不会触发这里。
    const stopDisconnectedRun = () => {
      if (!input.response.writableEnded && assistantId) {
        void this.runtime.requestStop(assistantId).catch((error: unknown) => {
          this.logger.warn(`断连停止失败 ${assistantId}: ${String(error)}`);
        });
      }
    };
    input.response.on('close', stopDisconnectedRun);
    const conversationHeartbeat = setInterval(() => {
      void this.runtime.renewConversation(session.id, conversationToken).catch((error: unknown) => {
        this.logger.warn(`会话锁续租失败 ${session.id}: ${String(error)}`);
        if (assistantId) void this.runtime.requestStop(assistantId).catch(() => undefined);
      });
    }, 60_000);
    let resourcesReleased = false;
    // 先释放服务端名额再发终态，避免客户端立即重试遇到上一条尚未释放的锁。
    const releaseResources = async () => {
      if (resourcesReleased) return;
      resourcesReleased = true;
      input.response.off('close', stopDisconnectedRun);
      clearInterval(conversationHeartbeat);
      this.runtime.finish(assistantId);
      if (userSlotHeartbeat) {
        clearInterval(userSlotHeartbeat);
      }
      const cleanup = [this.runtime.releaseConversation(session.id, conversationToken)];
      if (input.owner.userId && userSlotAcquired && userSlotToken) {
        cleanup.push(this.runtime.releaseUserSlot(input.owner.userId, userSlotToken));
      }
      const results = await Promise.allSettled(cleanup);
      for (const result of results) {
        if (result.status === 'rejected') {
          this.logger.error(
            `Chat 运行时资源清理失败 ${assistantId || session.id}: ${
              result.reason instanceof Error ? result.reason.message : result.reason
            }`,
          );
        }
      }
    };
    let failureContext:
      | {
          userMessageId: string;
          assistantMessageId: string;
          reservationId?: string;
        }
      | undefined;
    try {
      // 删除与发送共用锁；必须拿锁后重新确认，不能使用等待前的未删除快照。
      session = await this.requireSession(input.owner, input.sessionId);
      if (session.activeMessageId) {
        throw new DomainHttpException(
          HttpStatus.CONFLICT,
          'AI_GENERATION_IN_PROGRESS',
          '该会话已有生成进行中',
        );
      }
      if (input.regenerateFrom) {
        originalMessage = await this.prisma.aiMessage.findFirst({
          where: {
            id: input.regenerateFrom.assistantId,
            conversationId: session.id,
            isCurrentVariant: true,
          },
        });
        if (!originalMessage)
          throw new DomainHttpException(
            HttpStatus.CONFLICT,
            'AI_VARIANT_CHANGED',
            '该回答已被替换，请刷新后重试',
          );
      }
      if (input.response.destroyed) return;
      if (input.owner.userId) {
        const ent = await this.entitlement(input.owner.userId);
        userSlotToken = await this.runtime.acquireUserSlot(input.owner.userId, ent.maxConcurrent);
        userSlotAcquired = true;
        userSlotHeartbeat = setInterval(() => {
          const renewals: Promise<void>[] = [];
          if (userSlotToken) {
            renewals.push(this.runtime.renewUserSlot(input.owner.userId!, userSlotToken));
          }
          if (reservationId) {
            renewals.push(this.quota.renew(reservationId));
          }
          void Promise.all(renewals).catch((error: unknown) => {
            this.logger.warn(
              `AI 运行时资源续租失败 ${input.owner.userId}: ${
                error instanceof Error ? error.message : error
              }`,
            );
          });
        }, 60_000);
        await this.runtime.hitRateLimit(`ai:rpm:${input.owner.userId}`, ent.rpm, 60);
        await this.runtime.hitRateLimit(`ai:rpd:${input.owner.userId}`, ent.rpd, 24 * 60 * 60);
      } else {
        const guestKey = input.ipHash ?? input.owner.id;
        await this.runtime.hitRateLimit(`ai:guest:rpm:${guestKey}`, 5, 60);
        await this.runtime.hitRateLimit(`ai:guest:rpd:${guestKey}`, 20, 24 * 60 * 60);
      }
      const model = await this.resolveTextModel(
        input.body.modelId ?? session.userModelId ?? session.modelId ?? undefined,
        input.owner,
        toolCode,
      );
      const estimatedInputTokens = estimateTextTokens(input.body.content);
      const reserveAmount = BigInt(model.maxReserveAmount);
      if (input.owner.userId && model.chargePlatform) {
        const reservation = await this.quota.reserve({
          userId: input.owner.userId,
          amount: reserveAmount,
          requestId: input.requestId,
        });
        reservationId = reservation.id;
      }
      const excerpt = input.body.contentId
        ? await this.snapshotContent(
            input.body.contentId,
            input.owner.userId,
            input.owner.permissionVersion,
          )
        : null;
      const { userMessage, assistant } = await this.prisma.$transaction(async (tx) => {
        const userMessage = input.regenerateFrom
          ? await tx.aiMessage.findUniqueOrThrow({
              where: { id: input.regenerateFrom.userMessageId },
            })
          : await tx.aiMessage.create({
              data: {
                conversationId: session.id,
                role: AiMessageRole.USER,
                status: AiMessageStatus.DONE,
                content: input.body.content,
                inputTokens: estimatedInputTokens,
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
        const assistant = await tx.aiMessage.create({
          data: {
            conversationId: session.id,
            role: AiMessageRole.ASSISTANT,
            parentMessageId: userMessage.id,
            status: AiMessageStatus.STREAMING,
            modelId: model.userModelId ? null : model.id,
            userModelId: model.userModelId ?? null,
            modelKeySnapshot: model.modelKey,
            reservationId,
            requestId: input.requestId,
            variantGroupId: originalMessage
              ? (originalMessage.variantGroupId ?? originalMessage.id)
              : undefined,
            // 变体沿用原回答的位置，刷新后仍紧随原问题，不移动到对话末尾。
            createdAt: new Date(
              Math.max(
                originalMessage?.createdAt.getTime() ?? 0,
                userMessage.createdAt.getTime() + 1,
              ),
            ),
          },
        });
        if (input.regenerateFrom) {
          await tx.aiMessage.update({
            where: { id: input.regenerateFrom.assistantId },
            data: { isCurrentVariant: false },
          });
        }
        await tx.aiConversation.update({
          where: { id: session.id },
          data: {
            activeMessageId: assistant.id,
            messageCount: { increment: input.regenerateFrom ? 0 : 2 },
            lastMessageAt: new Date(),
            lastMessagePreview: input.body.content.slice(0, 200),
            title:
              session.titleSource === AiTitleSource.AUTO && session.messageCount === 0
                ? input.body.content.slice(0, 20)
                : undefined,
          },
        });
        return { userMessage, assistant };
      });
      assistantId = assistant.id;
      failureContext = {
        userMessageId: userMessage.id,
        assistantMessageId: assistant.id,
        reservationId,
      };
      beginSse(input.response);
      streamStarted = true;
      writeSse(input.response, {
        type: 'STARTED',
        requestId: input.requestId,
        sessionId: session.id,
        userMessageId: userMessage.id,
        assistantMessageId: assistant.id,
      });
      const signal = this.runtime.begin(assistant.id);
      if (input.response.destroyed) await this.runtime.requestStop(assistant.id);
      const history = await this.prisma.aiMessage.findMany({
        where: {
          conversationId: session.id,
          isCurrentVariant: true,
          createdAt: { lte: userMessage.createdAt },
          NOT: { id: { in: [assistant.id, userMessage.id] } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: Math.max(0, session.contextLimit - 1),
      });
      const promptMessages = [...history.reverse(), userMessage].map((row) => ({
        role: row.role === AiMessageRole.ASSISTANT ? ('assistant' as const) : ('user' as const),
        content:
          row.id === userMessage.id && excerpt
            ? `${row.content}\n\n引用：${excerpt.title}\n${excerpt.excerpt}`
            : row.content,
      }));
      let output = '';
      let providerUsage: { inputTokens: number; outputTokens: number } | undefined;
      try {
        if (!(await this.runtime.isStopped(assistant.id))) {
          for await (const delta of this.chatProvider.stream({
            modelKey: model.modelKey,
            providerId: model.provider.id,
            userId: input.owner.userId,
            userCredentialId: model.userCredentialId,
            providerCode: model.provider.code,
            baseUrl: model.provider.baseUrl,
            authEnvKey: model.provider.authEnvKey,
            timeoutMs: model.provider.timeoutMs,
            maxOutputTokens: model.maxOutputTokens,
            systemPrompt: session.systemPrompt,
            messages: promptMessages,
            signal,
          })) {
            if (await this.runtime.isStopped(assistant.id)) {
              break;
            }
            if (delta.usage) {
              providerUsage = delta.usage;
            }
            output += delta.content;
            writeSse(input.response, { type: 'DELTA', content: delta.content });
          }
        }
      } catch (error) {
        // 真实 Provider 的 AbortError 也是正常停止，保留已收到文本并走统一结算。
        if (!(await this.runtime.isStopped(assistant.id))) throw error;
      }
      providerStreamCompleted = true;
      const stopped = await this.runtime.isStopped(assistant.id);
      const inputTokens = providerUsage?.inputTokens ?? estimatedInputTokens;
      const outputTokens = providerUsage?.outputTokens ?? estimateTextTokens(output);
      const estimatedCost = model.userModelId
        ? null
        : platformCost({
            inputTokens,
            outputTokens,
            inputPricePer1k: model.inputPricePer1k,
            outputPricePer1k: model.outputPricePer1k,
            fixedPlatformCost: model.fixedPlatformCost,
          });
      const cost = model.chargePlatform ? (estimatedCost ?? 0) : 0;
      let reportedPlatformCost = stopped && output.length === 0 ? 0 : cost;
      // 消息终态和会话活跃指针必须在同一事务中落库，避免回答已完成但会话仍卡在生成中。
      await this.prisma.$transaction(async (tx) => {
        if (reservationId) {
          // 先锁定预占行，再写消息终态；到期清理也锁这行，避免读到旧消息后释放新完成的回答。
          const saved = await tx.aiQuotaReservation.updateMany({
            where: { id: reservationId, status: 'PENDING' },
            data: { settledAmount: BigInt(reportedPlatformCost) },
          });
          if (saved.count !== 1) throw new Error('AI_QUOTA_RESERVATION_UNAVAILABLE');
        }
        await tx.aiMessage.update({
          where: { id: assistant.id },
          data: {
            content: output,
            outputTokens,
            status: stopped ? AiMessageStatus.STOPPED : AiMessageStatus.DONE,
            finishReason: stopped ? AiFinishReason.CANCELLED : AiFinishReason.STOP,
            stoppedBy: stopped ? AiStoppedBy.USER : null,
            errorCode: null,
          },
        });
        await tx.aiMessage.update({ where: { id: userMessage.id }, data: { inputTokens } });
        await tx.aiConversation.update({
          where: { id: session.id },
          data: {
            activeMessageId: null,
            totalInputTokens: { increment: inputTokens },
            totalOutputTokens: { increment: outputTokens },
          },
        });
      });
      messageFinalized = true;
      if (reservationId && input.owner.userId) {
        try {
          if (stopped && output.length === 0) {
            await this.quota.release(reservationId, input.requestId);
          } else {
            const settled = await this.quota.settle(reservationId, BigInt(cost), input.requestId);
            if (!settled) throw new Error('AI_QUOTA_RESERVATION_UNAVAILABLE');
          }
          reservationFinalized = true;
        } catch (quotaError) {
          // 回答已经持久化，额度结算交给后续补偿/过期清理，不能把成功回答改写成失败。
          reportedPlatformCost = 0;
          this.logger.error(
            `AI 额度结算待补偿 ${assistant.id}: ${
              quotaError instanceof Error ? quotaError.message : quotaError
            }`,
          );
        }
      }
      try {
        await this.prisma.aiUsageRecord.create({
          data: {
            userId: input.owner.userId,
            ownerType: input.owner.type,
            ownerId: input.owner.id,
            toolType: toolCode,
            modelId: model.userModelId ? null : model.id,
            userModelId: model.userModelId ?? null,
            inputTokens,
            outputTokens,
            platformCost: reportedPlatformCost,
            estimatedPlatformCost: estimatedCost,
            latencyMs: Math.max(0, Date.now() - startedAtMs),
            messageId: assistant.id,
          },
        });
      } catch (usageError) {
        // usage 是审计旁路数据，写入失败需要告警和补偿，不能影响用户已得到的回答。
        this.logger.error(
          `AI usage 记录待补偿 ${assistant.id}: ${
            usageError instanceof Error ? usageError.message : usageError
          }`,
        );
      }
      await releaseResources();
      writeSse(input.response, {
        type: 'DONE',
        requestId: input.requestId,
        sessionId: session.id,
        userMessageId: userMessage.id,
        assistantMessageId: assistant.id,
        status: stopped ? 'stopped' : 'done',
        usage: { inputTokens, outputTokens, platformCost: reportedPlatformCost },
      });
      input.response.end();
    } catch (error) {
      if (messageFinalized) {
        if (!input.response.writableEnded) {
          input.response.end();
        }
        return;
      }
      if (!failureContext) {
        if (reservationId && !reservationFinalized) {
          try {
            await this.releaseReservationWithRetry(reservationId, input.requestId);
          } catch (releaseError) {
            this.logger.error(
              `Chat 预占额度释放失败 ${reservationId}: ${
                releaseError instanceof Error ? releaseError.message : releaseError
              }`,
            );
          }
        }
        throw error;
      }
      this.logger.warn(
        `Chat 流失败 ${assistantId}: ${error instanceof Error ? error.message : error}`,
      );
      const failureCode = providerStreamCompleted
        ? 'AI_RUN_FINALIZATION_FAILED'
        : aiFailureCode(error);
      try {
        await this.failRun({
          assistantId: failureContext.assistantMessageId,
          sessionId: session.id,
          reservationId: reservationFinalized ? undefined : failureContext.reservationId,
          requestId: input.requestId,
          errorCode: failureCode,
        });
      } catch (cleanupError) {
        this.logger.error(
          `Chat 失败状态清理失败 ${assistantId}: ${
            cleanupError instanceof Error ? cleanupError.message : cleanupError
          }`,
        );
      }
      await releaseResources();
      if (streamStarted && !input.response.writableEnded) {
        writeSse(input.response, {
          type: 'ERROR',
          requestId: input.requestId,
          sessionId: session.id,
          userMessageId: failureContext.userMessageId,
          assistantMessageId: failureContext.assistantMessageId,
          code: failureCode,
          message: aiFailureMessage(failureCode),
        });
        input.response.end();
        return;
      }
      throw error;
    } finally {
      await releaseResources();
    }
  }

  async stopMessage(owner: { type: AiOwnerType; id: string }, messageId: string) {
    const message = await this.prisma.aiMessage.findFirst({
      where: {
        id: messageId,
        conversation: { ownerType: owner.type, ownerId: owner.id, deletedAt: null },
      },
    });
    if (!message) {
      throw new DomainHttpException(
        HttpStatus.NOT_FOUND,
        'AI_GENERATION_NOT_FOUND',
        '生成记录不存在',
      );
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
    owner: { type: AiOwnerType; id: string; userId?: string; permissionVersion?: number },
    messageId: string,
    requestId: string,
    response: Response,
    ipHash?: string,
  ) {
    const message = await this.prisma.aiMessage.findFirst({
      where: { id: messageId, role: AiMessageRole.ASSISTANT },
      include: { conversation: true },
    });
    if (
      !message ||
      message.conversation.ownerType !== owner.type ||
      message.conversation.ownerId !== owner.id ||
      message.conversation.deletedAt
    ) {
      throw new DomainHttpException(
        HttpStatus.NOT_FOUND,
        'AI_GENERATION_NOT_FOUND',
        '生成记录不存在',
      );
    }
    const parentUser = await this.prisma.aiMessage.findFirst({
      where: {
        conversationId: message.conversationId,
        role: AiMessageRole.USER,
        // 新消息按父 ID 关联；旧记录优先按同次请求关联，避免时间戳精度丢失选错问题。
        ...(message.parentMessageId
          ? { id: message.parentMessageId }
          : message.requestId
            ? { requestId: message.requestId }
            : { createdAt: { lt: new Date(message.createdAt.getTime() + 1) } }),
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!parentUser)
      throw new DomainHttpException(
        HttpStatus.NOT_FOUND,
        'AI_GENERATION_NOT_FOUND',
        '原问题不存在',
      );
    await this.streamChat({
      owner,
      sessionId: message.conversationId,
      body: { content: parentUser?.content ?? '请重新生成' },
      requestId,
      response,
      ipHash,
      regenerateFrom: { assistantId: messageId, userMessageId: parentUser.id },
    });
  }

  async feedback(
    owner: { type: AiOwnerType; id: string },
    messageId: string,
    feedback?: AiFeedback | null,
  ) {
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
    owner: { type: AiOwnerType; id: string; userId?: string; permissionVersion?: number };
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
      throw new DomainHttpException(
        HttpStatus.BAD_REQUEST,
        'AI_INPUT_TOO_LONG',
        `输入最多 ${maxChars} 字`,
      );
    }
    if (input.body.scenario === 'translate' && !input.body.targetLanguage) {
      throw new DomainHttpException(
        HttpStatus.BAD_REQUEST,
        'AI_INPUT_REQUIRED',
        '翻译必须选择目标语言',
      );
    }
    const session = await this.createSession(input.owner, {
      title: `文本生成 · ${input.body.scenario}`,
      modelId: input.body.modelId,
      toolCode: AiToolCode.TEXT,
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
      toolCode: AiToolCode.TEXT,
    });
  }

  async createImageJob(
    userId: string,
    body: {
      prompt: string;
      negativePrompt?: string;
      modelId?: string;
      count?: number;
      size?: string;
      style?: string;
      quality?: string;
      resolution?: string;
    },
    requestId: string,
    idempotencyKey: string,
  ) {
    const owner = { type: AiOwnerType.USER, id: userId, userId } as const;
    await this.assertToolAvailable(AiToolCode.IMAGE, owner);
    const model = await this.resolveModel(body.modelId, owner, AiToolCode.IMAGE);
    const cost = model.fixedPlatformCost ?? 500;
    const reservation = await this.quota.reserve({
      userId,
      amount: BigInt(cost),
      requestId,
    });
    try {
      const job = await this.prisma.$transaction(async (tx) => {
        const created = await tx.aiGenerationJob.create({
          data: {
            userId,
            toolType: AiToolCode.IMAGE,
            modelId: model.id,
            modelKeySnapshot: model.modelKey,
            prompt: body.prompt,
            negativePrompt: body.negativePrompt,
            params: {
              count: body.count ?? 1,
              size: body.size,
              style: body.style,
              quality: body.quality,
              resolution: body.resolution,
            },
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
    } catch (error) {
      await this.releaseReservationWithRetry(reservation.id, requestId).catch((releaseError) => {
        this.logger.error(
          `图片任务创建失败后的额度释放失败 ${reservation.id}: ${
            releaseError instanceof Error ? releaseError.message : releaseError
          }`,
        );
      });
      throw error;
    }
  }

  async createVideoJob(
    userId: string,
    body: {
      prompt: string;
      modelId?: string;
      size?: string;
      style?: string;
      durationSeconds?: number;
    },
    requestId: string,
    idempotencyKey: string,
  ) {
    const owner = { type: AiOwnerType.USER, id: userId, userId } as const;
    await this.assertToolAvailable(AiToolCode.VIDEO, owner);
    const model = await this.resolveModel(body.modelId, owner, AiToolCode.VIDEO);
    const cost = model.fixedPlatformCost ?? 800;
    const reservation = await this.quota.reserve({
      userId,
      amount: BigInt(cost),
      requestId,
    });
    try {
      const job = await this.prisma.$transaction(async (tx) => {
        const created = await tx.aiGenerationJob.create({
          data: {
            userId,
            toolType: AiToolCode.VIDEO,
            modelId: model.id,
            modelKeySnapshot: model.modelKey,
            prompt: body.prompt,
            params: {
              count: 1,
              size: body.size,
              style: body.style,
              durationSeconds: body.durationSeconds,
            },
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
    } catch (error) {
      await this.releaseReservationWithRetry(reservation.id, requestId).catch((releaseError) => {
        this.logger.error(
          `视频任务创建失败后的额度释放失败 ${reservation.id}: ${
            releaseError instanceof Error ? releaseError.message : releaseError
          }`,
        );
      });
      throw error;
    }
  }

  async getJob(userId: string, jobId: string) {
    const job = await this.prisma.aiGenerationJob.findFirst({
      where: { id: jobId, userId },
      include: {
        model: { select: { displayName: true } },
        assets: { where: { deletedAt: null }, include: { file: true } },
      },
    });
    if (!job) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'AI_GENERATION_NOT_FOUND', '任务不存在');
    }
    return mapJob(job, job.assets);
  }

  async listJobs(
    userId: string,
    query: { page?: number; pageSize?: number; toolType?: AiToolCode; status?: string } = {},
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const status = toJobStatus(query.status);
    const where = {
      userId,
      ...(query.toolType ? { toolType: query.toolType } : {}),
      ...(status ? { status } : {}),
    };
    const [list, total] = await Promise.all([
      this.prisma.aiGenerationJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          model: { select: { displayName: true } },
          assets: { where: { deletedAt: null }, include: { file: true } },
        },
      }),
      this.prisma.aiGenerationJob.count({ where }),
    ]);
    return {
      list: list.map((job) => mapJob(job, job.assets)),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 返回任务资产二进制。本地 memory:// 不能当 img src，统一走带鉴权的媒体接口。
   */
  async getAssetContent(userId: string, assetId: string) {
    const asset = await this.prisma.aiAsset.findFirst({
      where: { id: assetId, ownerId: userId, deletedAt: null },
      include: { file: true },
    });
    if (!asset?.file) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'AI_GENERATION_NOT_FOUND', '资产不存在');
    }
    const body = await this.storage.getObject(asset.file.objectKey);
    return { body, contentType: asset.file.mimeType || 'application/octet-stream' };
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
      data: {
        cancelRequestedAt: new Date(),
        status: job.status === 'QUEUED' ? 'CANCELED' : job.status,
      },
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
      include: { model: true, reservation: true },
    });
    if (
      !job ||
      job.status === AiGenerationJobStatus.CANCELED ||
      job.status === AiGenerationJobStatus.FAILED ||
      job.status === AiGenerationJobStatus.SUCCEEDED
    ) {
      return;
    }
    if (job.cancelRequestedAt) {
      await this.prisma.aiGenerationJob.updateMany({
        where: {
          id: jobId,
          status: { in: [AiGenerationJobStatus.QUEUED, AiGenerationJobStatus.PROCESSING] },
        },
        data: { status: 'CANCELED', finishedAt: new Date() },
      });
      if (job.reservationId) {
        await this.quota.release(job.reservationId, jobId);
      }
      return;
    }
    // 允许恢复 worker 崩溃留下的旧 PROCESSING，但同一任务在租约窗口内只能被一个 worker 认领。
    // startedAt 保留任务首次开始处理的时间，续租写 updatedAt，避免改变对外语义。
    const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
    const claimed = await this.prisma.aiGenerationJob.updateMany({
      where: {
        id: jobId,
        OR: [
          { status: AiGenerationJobStatus.QUEUED },
          {
            status: AiGenerationJobStatus.PROCESSING,
            OR: [{ startedAt: null }, { updatedAt: { lte: staleBefore } }],
          },
        ],
      },
      data: { status: 'PROCESSING', startedAt: new Date(), progress: 20 },
    });
    if (claimed.count !== 1) {
      return;
    }
    const fileIds: string[] = [];
    const objectKeys: string[] = [];
    let reservationFinalized = false;
    const jobHeartbeat = setInterval(() => {
      const renewals: Promise<unknown>[] = [
        this.prisma.aiGenerationJob.updateMany({
          where: { id: jobId, status: AiGenerationJobStatus.PROCESSING },
          data: { updatedAt: new Date() },
        }),
      ];
      if (job.reservationId) {
        renewals.push(this.quota.renew(job.reservationId));
      }
      void Promise.all(renewals).catch((error: unknown) => {
        this.logger.warn(
          `AI 任务租约或额度续期失败 ${jobId}: ${error instanceof Error ? error.message : error}`,
        );
      });
    }, 30_000);
    try {
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
        await this.prisma.aiGenerationJob.updateMany({
          where: { id: jobId, status: AiGenerationJobStatus.PROCESSING },
          data: { status: AiGenerationJobStatus.CANCELED, finishedAt: new Date() },
        });
        if (job.reservationId) {
          await this.quota.release(job.reservationId, jobId);
          reservationFinalized = true;
        }
        return;
      }
      for (const [index, body] of buffers.entries()) {
        const objectKey = `ai/${job.userId}/${job.id}/${index}.png`;
        const file = await this.prisma.fileAsset.create({
          data: {
            uploaderId: job.userId,
            originalName: `${job.toolType.toLowerCase()}-${index + 1}.png`,
            objectKey,
            storageProvider: StorageProviderKind.MINIO,
            mimeType: 'image/png',
            size: body.length,
            purpose: FilePurpose.AI_ASSET,
            status: FileAssetStatus.READY,
          },
        });
        // 先记录数据库行，再写对象；对象上传失败时 catch 才能把这条行标记为已删除。
        fileIds.push(file.id);
        objectKeys.push(objectKey);
        await this.storage.putObject(objectKey, body, 'image/png');
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
      // 任务创建时的预占金额是价格快照；后台之后改价不应改变本次实扣。
      const cost = job.reservation
        ? Number(job.reservation.reservedAmount)
        : (job.model.fixedPlatformCost ?? (job.toolType === AiToolCode.VIDEO ? 800 : 500));
      const usageData = {
        userId: job.userId,
        ownerType: AiOwnerType.USER,
        ownerId: job.userId,
        toolType: job.toolType,
        modelId: job.modelId,
        platformCost: cost,
        estimatedPlatformCost: cost,
        latencyMs: job.startedAt ? Math.max(0, Date.now() - job.startedAt.getTime()) : null,
        jobId,
      };
      // 额度结算、usage 和成功终态必须同事务提交，避免只完成其中一部分。
      await this.prisma.$transaction(async (tx) => {
        if (job.reservationId) {
          const settled = await this.quota.settleInTransaction(
            tx,
            job.reservationId!,
            BigInt(cost),
            jobId,
          );
          if (!settled) throw new Error('AI_QUOTA_RESERVATION_UNAVAILABLE');
        }
        await tx.aiUsageRecord.create({ data: usageData });
        const completed = await tx.aiGenerationJob.updateMany({
          where: {
            id: jobId,
            status: AiGenerationJobStatus.PROCESSING,
            cancelRequestedAt: null,
          },
          data: {
            status: AiGenerationJobStatus.SUCCEEDED,
            progress: 100,
            resultFileIds: fileIds,
            finishedAt: new Date(),
          },
        });
        if (completed.count !== 1) {
          throw new Error('AI_GENERATION_CANCELED');
        }
      });
      reservationFinalized = job.reservationId !== null;
    } catch (error) {
      const latest = await this.prisma.aiGenerationJob.findUnique({
        where: { id: jobId },
        select: { cancelRequestedAt: true },
      });
      const canceled =
        latest?.cancelRequestedAt !== null && latest?.cancelRequestedAt !== undefined;
      await this.prisma.aiGenerationJob.updateMany({
        where: { id: jobId, status: AiGenerationJobStatus.PROCESSING },
        data: {
          status: canceled ? AiGenerationJobStatus.CANCELED : AiGenerationJobStatus.FAILED,
          errorCode: canceled ? 'AI_GENERATION_CANCELED' : 'AI_PROVIDER_FAILED',
          errorSummary: error instanceof Error ? error.message.slice(0, 300) : '生成任务失败',
          finishedAt: new Date(),
        },
      });
      await this.prisma.aiAsset.deleteMany({ where: { sourceJobId: jobId } });
      if (fileIds.length > 0) {
        await this.prisma.fileAsset.updateMany({
          where: { id: { in: fileIds } },
          data: { deletedAt: new Date() },
        });
      }
      await Promise.allSettled(objectKeys.map((key) => this.storage.deleteObject(key)));
      if (job.reservationId && !reservationFinalized) {
        await this.quota.release(job.reservationId, jobId);
      }
      throw error;
    } finally {
      clearInterval(jobHeartbeat);
      this.runtime.finish(jobId);
    }
  }

  /** worker 重启后恢复超过租约时间仍未结束的生成任务。 */
  async recoverStaleGenerationJobs(): Promise<number> {
    const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
    const jobs = await this.prisma.aiGenerationJob.findMany({
      where: {
        status: AiGenerationJobStatus.PROCESSING,
        OR: [{ startedAt: null }, { updatedAt: { lte: staleBefore } }],
      },
      select: { id: true },
      take: 20,
    });
    for (const row of jobs) {
      try {
        await this.processJob(row.id);
      } catch (error) {
        this.logger.warn(
          `恢复 AI 任务失败 ${row.id}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
    return jobs.length;
  }

  async createAsset(
    userId: string,
    input: { title: string; type?: 'TEXT' | 'IMAGE' | 'VIDEO'; prompt?: string; folderId?: string },
  ) {
    if (input.folderId) {
      const folder = await this.prisma.aiAssetFolder.findFirst({
        where: { id: input.folderId, ownerId: userId, deletedAt: null },
        select: { id: true },
      });
      if (!folder) {
        throw new DomainHttpException(
          HttpStatus.NOT_FOUND,
          'AI_GENERATION_NOT_FOUND',
          '素材文件夹不存在',
        );
      }
    }
    const row = await this.prisma.aiAsset.create({
      data: {
        ownerId: userId,
        type:
          input.type === 'IMAGE'
            ? AiAssetType.IMAGE
            : input.type === 'VIDEO'
              ? AiAssetType.VIDEO
              : AiAssetType.TEXT,
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
    const mapped = list.map((row) => mapAsset(row));
    return { list: mapped, total, page, pageSize };
  }

  async patchAsset(
    userId: string,
    assetId: string,
    input: { folderId?: string | null; status?: string; favorite?: boolean },
  ) {
    const asset = await this.prisma.aiAsset.findFirst({
      where: { id: assetId, ownerId: userId, deletedAt: null },
    });
    if (!asset) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'AI_GENERATION_NOT_FOUND', '资产不存在');
    }
    const data: Prisma.AiAssetUpdateInput = {};
    if (input.folderId !== undefined) {
      if (input.folderId) {
        const folder = await this.prisma.aiAssetFolder.findFirst({
          where: { id: input.folderId, ownerId: userId, deletedAt: null },
          select: { id: true },
        });
        if (!folder) {
          throw new DomainHttpException(
            HttpStatus.NOT_FOUND,
            'AI_GENERATION_NOT_FOUND',
            '素材文件夹不存在',
          );
        }
      }
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
    const row = await this.prisma.aiAssetFolder.create({
      data: { ownerId: userId, name: name.trim() },
    });
    return {
      id: row.id,
      name: row.name,
      assetCount: 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async patchFolder(userId: string, folderId: string, name: string) {
    const row = await this.prisma.aiAssetFolder.updateMany({
      where: { id: folderId, ownerId: userId, deletedAt: null },
      data: { name: name.trim() },
    });
    if (row.count === 0) {
      throw new DomainHttpException(
        HttpStatus.NOT_FOUND,
        'AI_GENERATION_NOT_FOUND',
        '文件夹不存在',
      );
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
    const [providers, models, tools, templates, entitlements, branding, navigation] =
      await Promise.all([
        this.prisma.aiProvider.findMany({
          orderBy: { code: 'asc' },
          include: {
            credentials: {
              where: { ownerType: AiCredentialOwnerType.SYSTEM },
              select: { id: true },
            },
          },
        }),
        this.prisma.aiModel.findMany({
          include: { provider: true, defaultForTools: { select: { code: true } } },
          orderBy: { displayName: 'asc' },
        }),
        this.prisma.aiTool.findMany({ orderBy: { sortOrder: 'asc' } }),
        this.prisma.aiTemplate.findMany({
          where: { isSystem: true, deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        }),
        this.prisma.aiEntitlement.findMany({ include: { role: true } }),
        this.readBranding(),
        this.listNavigation({ includeHidden: true, remapByTool: false }),
      ]);
    return {
      branding,
      providers: providers.map((row) => toAdminProvider(row)),
      models: models.map(mapAdminModel),
      tools: tools.map((row) => ({
        ...mapTool(row),
        id: row.id,
        defaultModelId: row.defaultModelId ?? undefined,
        tokenCostLabel: row.tokenCostLabel,
        sort: row.sortOrder,
      })),
      navigation,
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

  async adminStats(range: '24h' | '7d' | '30d' = '7d') {
    const since = new Date(Date.now() - { '24h': 1, '7d': 7, '30d': 30 }[range] * 86400000);
    // 按稳定主键分页，避免 30 天记录一次性加载到 Node 内存。
    const usageWhere = { createdAt: { gte: since } };
    const usageInclude = {
      user: { select: { nickname: true, email: true } },
      model: { select: { displayName: true, provider: { select: { label: true } } } },
      userModel: { select: { displayName: true, credential: { select: { label: true } } } },
    } as const;
    const trends = new Map<
      string,
      {
        date: string;
        tokens: number;
        calls: number;
        estimatedCost: number;
        platformCharged: number;
        unknownEstimates: number;
      }
    >();
    const tools = new Map<
      string,
      { toolType: string; toolName: string; tokens: number; calls: number; ratio: number }
    >();
    const users = new Map<
      string,
      { userId: string; nickname: string; tokens: number; calls: number }
    >();
    const models = new Map<
      string,
      {
        modelId: string;
        modelName: string;
        providerName: string;
        tokens: number;
        calls: number;
        estimatedCost: number;
        platformCharged: number;
        unknownEstimates: number;
      }
    >();
    let totalTokens = 0;
    let estimatedCost = 0;
    let platformCharged = 0;
    let unknownEstimates = 0;
    let totalCalls = 0;
    let generationTasks = 0;
    let imageTasks = 0;
    let videoTasks = 0;
    let failedCalls = 0;
    let succeededJobs = 0;
    let durationSum = 0;
    let durationCount = 0;
    const durationByDate = new Map<string, { sum: number; count: number }>();
    const statusCounts = new Map<string, number>();
    const dateFormat = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    let usageCursor: string | undefined;
    while (true) {
      const usage = await this.prisma.aiUsageRecord.findMany({
        where: usageWhere,
        include: usageInclude,
        orderBy: { id: 'asc' },
        take: 500,
        ...(usageCursor ? { cursor: { id: usageCursor }, skip: 1 } : {}),
      });
      if (!usage.length) break;
      for (const row of usage) {
        totalCalls++;
        const tokens = row.inputTokens + row.outputTokens;
        const date = dateFormat.format(row.createdAt);
        const trend = trends.get(date) ?? {
          date,
          tokens: 0,
          calls: 0,
          estimatedCost: 0,
          platformCharged: 0,
          unknownEstimates: 0,
        };
        trend.tokens += tokens;
        trend.calls++;
        trend.platformCharged += row.platformCost;
        if (row.estimatedPlatformCost === null) trend.unknownEstimates++;
        else trend.estimatedCost += row.estimatedPlatformCost;
        trends.set(date, trend);
        const toolType = row.toolType.toLowerCase();
        const tool = tools.get(toolType) ?? {
          toolType,
          toolName: (
            { chat: '对话', text: '文本', image: '图片', video: '视频' } as Record<string, string>
          )[toolType],
          tokens: 0,
          calls: 0,
          ratio: 0,
        };
        tool.tokens += tokens;
        tool.calls++;
        tools.set(toolType, tool);
        if (row.userId) {
          const user = users.get(row.userId) ?? {
            userId: row.userId,
            nickname: row.user?.nickname ?? row.user?.email ?? '已删除用户',
            tokens: 0,
            calls: 0,
          };
          user.tokens += tokens;
          user.calls++;
          users.set(row.userId, user);
        }
        const modelId = row.userModelId ?? row.modelId ?? 'deleted';
        const model = models.get(modelId) ?? {
          modelId,
          modelName: row.userModel?.displayName ?? row.model?.displayName ?? '历史模型',
          providerName:
            row.userModel?.credential?.label ?? row.model?.provider.label ?? '已删除厂商',
          tokens: 0,
          calls: 0,
          estimatedCost: 0,
          platformCharged: 0,
          unknownEstimates: 0,
        };
        model.tokens += tokens;
        model.calls++;
        model.platformCharged += row.platformCost;
        if (row.estimatedPlatformCost === null) model.unknownEstimates++;
        else model.estimatedCost += row.estimatedPlatformCost;
        models.set(modelId, model);
        totalTokens += tokens;
        platformCharged += row.platformCost;
        if (row.estimatedPlatformCost === null) unknownEstimates++;
        else estimatedCost += row.estimatedPlatformCost;
        // 已关联生成任务的耗时由 job 统计，避免重复计算。
        if (row.latencyMs !== null && !row.jobId) {
          durationSum += row.latencyMs;
          durationCount++;
          const item = durationByDate.get(date) ?? { sum: 0, count: 0 };
          item.sum += row.latencyMs;
          item.count++;
          durationByDate.set(date, item);
        }
      }
      usageCursor = usage.at(-1)!.id;
      if (usage.length < 500) break;
    }
    let jobCursor: string | undefined;
    while (true) {
      const jobs = await this.prisma.aiGenerationJob.findMany({
        where: { createdAt: { gte: since } },
        select: {
          id: true,
          toolType: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          createdAt: true,
        },
        orderBy: { id: 'asc' },
        take: 500,
        ...(jobCursor ? { cursor: { id: jobCursor }, skip: 1 } : {}),
      });
      if (!jobs.length) break;
      for (const row of jobs) {
        generationTasks++;
        if (row.toolType === AiToolCode.IMAGE) imageTasks++;
        if (row.toolType === AiToolCode.VIDEO) videoTasks++;
        if (row.status === 'FAILED') failedCalls++;
        if (row.status === 'SUCCEEDED') succeededJobs++;
        if (row.startedAt && row.finishedAt) {
          const duration = row.finishedAt.getTime() - row.startedAt.getTime();
          durationSum += duration;
          durationCount++;
          const date = dateFormat.format(row.createdAt);
          const item = durationByDate.get(date) ?? { sum: 0, count: 0 };
          item.sum += duration;
          item.count++;
          durationByDate.set(date, item);
        }
        statusCounts.set(
          row.status.toLowerCase(),
          (statusCounts.get(row.status.toLowerCase()) ?? 0) + 1,
        );
      }
      jobCursor = jobs.at(-1)!.id;
      if (jobs.length < 500) break;
    }
    for (const date of durationByDate.keys()) {
      if (!trends.has(date)) {
        // 失败任务没有用量记录，仍需在每日趋势中展示它的耗时。
        trends.set(date, {
          date, tokens: 0, calls: 0, estimatedCost: 0, platformCharged: 0, unknownEstimates: 0,
        });
      }
    }
    return {
      summary: {
        totalTokens,
        totalCalls,
        estimatedCost,
        platformCharged,
        unknownEstimates,
        activeUsers: users.size,
        imageTasks,
        videoTasks,
        generationTasks,
        failedCalls,
        successRate: generationTasks
          ? Math.round((succeededJobs / generationTasks) * 10000) / 100
          : 100,
        averageDurationMs: durationCount ? Math.round(durationSum / durationCount) : 0,
      },
      trends: [...trends.values()]
        .map((trend) => {
          const values = durationByDate.get(trend.date);
          return {
            ...trend,
            averageDurationMs: values?.count ? Math.round(values.sum / values.count) : 0,
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date)),
      toolShares: [...tools.values()].map((row) => ({
        ...row,
        ratio: totalCalls ? Math.round((row.calls / totalCalls) * 100) : 0,
      })),
      userRanks: [...users.values()]
        .sort((a, b) => b.tokens - a.tokens)
        .slice(0, 5)
        .map((row, index) => ({ ...row, rank: index + 1 })),
      modelDistributions: [...models.values()].sort((a, b) => b.tokens - a.tokens),
      statusShares: [...statusCounts.entries()].map(([status, calls]) => ({
        status,
        calls,
        ratio: generationTasks ? Math.round((calls / generationTasks) * 100) : 0,
      })),
    };
  }

  adjustQuota(
    input: {
      userId: string;
      direction: 'CREDIT' | 'DEBIT';
      amount: number;
      reason: string;
      idempotencyKey: string;
    },
    actorId: string,
  ) {
    return this.quota.adjust({ ...input, actorId });
  }

  quotaAccount(userId: string, actorId: string) {
    return this.quota.account(userId, actorId);
  }

  async patchProvider(
    id: string,
    input: {
      label?: string;
      name?: string;
      enabled?: boolean;
      baseUrl?: string;
      apiKey?: string;
      remark?: string;
      sourceFiled?: boolean;
      filingNote?: string;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.aiProvider.findUnique({ where: { id } });
      if (!current) {
        throw new DomainHttpException(HttpStatus.NOT_FOUND, 'AI_MODEL_NOT_AVAILABLE', '厂商不存在');
      }
      const apiKey = input.apiKey?.trim();
      if (apiKey) {
        await this.credentials.upsertSystemKey(id, apiKey, tx);
      }
      const updated = await tx.aiProvider.update({
        where: { id },
        data: {
          label: input.label ?? input.name,
          enabled: input.enabled,
          baseUrl: input.baseUrl,
          remark: input.remark === undefined ? undefined : input.remark.trim() || null,
          sourceFiled: input.sourceFiled,
          filingNote: input.filingNote === undefined ? undefined : input.filingNote.trim() || null,
        },
        include: {
          credentials: {
            where: { ownerType: AiCredentialOwnerType.SYSTEM },
            select: { id: true },
          },
        },
      });
      return toAdminProvider(updated);
    });
  }

  /** 新建兼容协议厂商；凭据写入失败会回滚目录行。 */
  async createProvider(input: {
    code: string;
    label: string;
    providerType: 'openai-compatible';
    baseUrl?: string;
    enabled?: boolean;
    apiKey?: string;
    remark?: string;
    sourceFiled?: boolean;
    filingNote?: string;
  }) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.aiProvider.create({
          data: {
            code: input.code,
            label: input.label.trim(),
            baseUrl: input.baseUrl?.trim() || null,
            enabled: input.enabled ?? true,
            remark: input.remark?.trim() || null,
            sourceFiled: input.sourceFiled ?? false,
            filingNote: input.filingNote?.trim() || null,
            timeoutMs: 20_000,
          },
        });
        if (input.apiKey) {
          await this.credentials.upsertSystemKey(created.id, input.apiKey, tx);
        }
        const saved = await tx.aiProvider.findUniqueOrThrow({
          where: { id: created.id },
          include: {
            credentials: {
              where: { ownerType: AiCredentialOwnerType.SYSTEM },
              select: { id: true },
            },
          },
        });
        return toAdminProvider(saved);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainHttpException(
          HttpStatus.CONFLICT,
          'AI_PROVIDER_CODE_EXISTS',
          '厂商标识已存在',
        );
      }
      throw error;
    }
  }

  /**
   * 探测厂商连通性。Fake 不发外网、不写用量。密钥解析顺序与正式调用相同。
   *
   * @param providerId 厂商行 ID
   * @param modelId 可选，模型行 ID。传入时还要确认该 modelKey 存在于厂商
   */
  async testProvider(providerId: string, modelId?: string) {
    const provider = await this.prisma.aiProvider.findUnique({ where: { id: providerId } });
    if (!provider) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'AI_MODEL_NOT_AVAILABLE', '厂商不存在');
    }
    if (provider.code === 'fake') {
      return { ok: true as const, message: 'Fake Provider 连接成功' };
    }
    const secret = await this.credentials.resolveSystemSecret(provider, { require: true });
    if (!secret) {
      throw new DomainHttpException(
        HttpStatus.BAD_REQUEST,
        'AI_PROVIDER_KEY_MISSING',
        '未配置系统凭据，且没有可用的环境变量回退',
      );
    }
    let modelKey: string | undefined;
    if (modelId) {
      const model = await this.prisma.aiModel.findFirst({
        where: { id: modelId, providerId },
      });
      if (!model) {
        throw new DomainHttpException(HttpStatus.NOT_FOUND, 'AI_MODEL_NOT_AVAILABLE', '模型不存在');
      }
      modelKey = model.modelKey;
    }
    const message = await probeProviderConnection({
      baseUrl: secret.baseUrl,
      apiKey: secret.apiKey,
      timeoutMs: secret.timeoutMs,
      modelKey,
    });
    return { ok: true as const, message };
  }

  /** 新增模型目录；同一厂商的 modelKey 唯一，默认模型在同一事务中让位。 */
  async createModel(input: CreateModelDto) {
    const modelKey = input.modelId.trim();
    const providerCode = input.providerCode.trim();
    const displayName = input.displayName.trim();
    if (!modelKey || !providerCode || !displayName) {
      throw new DomainHttpException(
        HttpStatus.BAD_REQUEST,
        'AI_MODEL_INVALID',
        '模型标识、厂商和名称不能为空',
      );
    }
    validateModelConfig({
      ...input,
      modelKey,
      displayName,
      contextWindowTokens: input.contextTokens,
      maxOutputTokens: input.maxOutputTokens ?? 2048,
      fixedPlatformCost: input.fixedPlatformCost ?? null,
    });
    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockModelConfig(tx);
        const provider = await tx.aiProvider.findUnique({ where: { code: providerCode } });
        if (!provider) {
          throw new DomainHttpException(
            HttpStatus.NOT_FOUND,
            'AI_PROVIDER_NOT_FOUND',
            '厂商不存在',
          );
        }
        const row = await tx.aiModel.create({
          data: {
            providerId: provider.id,
            modelKey,
            displayName,
            toolTypes: [...new Set(input.toolTypes)],
            modality: input.modality ?? AiModality.TEXT,
            enabled: input.enabled,
            userVisible: input.visibleToUser,
            isDefault: input.isDefault,
            contextWindowTokens: input.contextTokens,
            maxOutputTokens: input.maxOutputTokens ?? 2048,
            fixedPlatformCost: input.fixedPlatformCost,
            inputPricePer1k: input.inputPricePer1k,
            outputPricePer1k: input.outputPricePer1k,
          },
          include: { provider: true },
        });
        // 模型目录权限不包含角色授权权限；仅独立的权益接口能改变显式白名单。
        await updateModelDefaults(
          tx,
          row,
          input.defaultToolTypes ?? (input.isDefault ? input.toolTypes : []),
        );
        return mapAdminModel(
          await tx.aiModel.findUniqueOrThrow({
            where: { id: row.id },
            include: { provider: true, defaultForTools: { select: { code: true } } },
          }),
        );
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainHttpException(
          HttpStatus.CONFLICT,
          'AI_MODEL_EXISTS',
          '同一厂商下已有这个模型标识',
        );
      }
      throw error;
    }
  }

  async patchModel(
    id: string,
    input: {
      displayName?: string;
      enabled?: boolean;
      userVisible?: boolean;
      visibleToUser?: boolean;
      isDefault?: boolean;
      contextTokens?: number;
      inputPricePer1k?: number;
      outputPricePer1k?: number;
      modelId?: string;
      modality?: AiModality;
      toolTypes?: AiToolCode[];
      maxOutputTokens?: number;
      fixedPlatformCost?: number | null;
      defaultToolTypes?: AiToolCode[];
    },
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockModelConfig(tx);
        const current = await tx.aiModel.findUnique({ where: { id } });
        if (!current) {
          throw new DomainHttpException(
            HttpStatus.NOT_FOUND,
            'AI_MODEL_NOT_AVAILABLE',
            '模型不存在',
          );
        }
        const nextFixedCost =
          input.fixedPlatformCost === undefined
            ? current.fixedPlatformCost
            : input.fixedPlatformCost;
        const modelKey = input.modelId?.trim();
        validateModelConfig({
          ...current,
          modelKey: modelKey ?? current.modelKey,
          displayName:
            input.displayName === undefined ? current.displayName : input.displayName.trim(),
          enabled: input.enabled ?? current.enabled,
          toolTypes: input.toolTypes ?? current.toolTypes,
          contextWindowTokens: input.contextTokens ?? current.contextWindowTokens,
          maxOutputTokens: input.maxOutputTokens ?? current.maxOutputTokens,
          inputPricePer1k: input.inputPricePer1k ?? current.inputPricePer1k,
          outputPricePer1k: input.outputPricePer1k ?? current.outputPricePer1k,
          fixedPlatformCost: nextFixedCost,
        });
        if (modelKey && modelKey !== current.modelKey) {
          const clash = await tx.aiModel.findFirst({
            where: { providerId: current.providerId, modelKey, NOT: { id } },
            select: { id: true },
          });
          if (clash) {
            throw new DomainHttpException(
              HttpStatus.CONFLICT,
              'AI_MODEL_EXISTS',
              '同一厂商下已有这个模型标识',
            );
          }
        }
        const row = await tx.aiModel.update({
          where: { id },
          data: {
            displayName: input.displayName?.trim(),
            enabled: input.enabled,
            userVisible: input.userVisible ?? input.visibleToUser,
            isDefault: input.isDefault,
            contextWindowTokens: input.contextTokens,
            inputPricePer1k: input.inputPricePer1k,
            outputPricePer1k: input.outputPricePer1k,
            modelKey,
            modality: input.modality,
            toolTypes: input.toolTypes,
            maxOutputTokens: input.maxOutputTokens,
            fixedPlatformCost: input.fixedPlatformCost,
          },
        });
        const defaults =
          input.defaultToolTypes ??
          (input.isDefault === undefined ? undefined : input.isDefault ? row.toolTypes : []);
        await updateModelDefaults(tx, row, defaults);
        return mapAdminModel(
          await tx.aiModel.findUniqueOrThrow({
            where: { id },
            include: { provider: true, defaultForTools: { select: { code: true } } },
          }),
        );
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainHttpException(
          HttpStatus.CONFLICT,
          'AI_MODEL_EXISTS',
          '同一厂商下已有这个模型标识',
        );
      }
      throw error;
    }
  }

  async patchTool(
    id: string,
    input: {
      name?: string;
      status?: AiToolStatus;
      sortOrder?: number;
      defaultModelId?: string | null;
      tokenCostLabel?: string;
      guestTrialEnabled?: boolean;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      await lockModelConfig(tx);
      const current = await tx.aiTool.findUnique({ where: { id } });
      if (!current)
        throw new DomainHttpException(HttpStatus.NOT_FOUND, 'AI_TOOL_UNAVAILABLE', '工具不存在');
      if (input.defaultModelId) {
        const model = await tx.aiModel.findUnique({
          where: { id: input.defaultModelId },
          include: { provider: true },
        });
        if (
          !model ||
          !model.enabled ||
          !model.userVisible ||
          model.deprecatedAt ||
          !model.provider.enabled ||
          !model.toolTypes.includes(current.code)
        ) {
          throw new DomainHttpException(
            HttpStatus.BAD_REQUEST,
            'AI_MODEL_INVALID',
            '默认模型必须可用，且支持对应工具',
          );
        }
      }
      const saved = await tx.aiTool.update({
        where: { id },
        data: {
          name: input.name,
          status: input.status,
          sortOrder: input.sortOrder,
          defaultModelId: input.defaultModelId,
          tokenCostLabel: input.tokenCostLabel,
          guestTrialEnabled: input.guestTrialEnabled,
        },
      });
      await tx.aiModel.updateMany({
        where: { defaultForTools: { none: {} } },
        data: { isDefault: false },
      });
      await tx.aiModel.updateMany({
        where: { defaultForTools: { some: {} } },
        data: { isDefault: true },
      });
      return saved;
    });
  }

  async putEntitlement(
    roleId: string,
    input: { maxConcurrent?: number; allowedModelIds?: string[] },
  ) {
    if (input.allowedModelIds) {
      const ids = [...new Set(input.allowedModelIds)];
      const count = await this.prisma.aiModel.count({ where: { id: { in: ids } } });
      if (count !== ids.length)
        throw new DomainHttpException(
          HttpStatus.BAD_REQUEST,
          'AI_MODEL_INVALID',
          '授权列表包含不存在的模型',
        );
      input = { ...input, allowedModelIds: ids };
    }
    if (!(await this.prisma.aiEntitlement.findUnique({ where: { roleId } }))) {
      throw new DomainHttpException(
        HttpStatus.NOT_FOUND,
        'AI_ENTITLEMENT_NOT_FOUND',
        '角色权益不存在',
      );
    }
    return this.prisma.aiEntitlement.update({
      where: { roleId },
      // 权益行含 BigInt 赠额，写响应只返回本接口字段，避免幂等缓存 JSON 序列化失败。
      select: { id: true, roleId: true, maxConcurrent: true, allowedModelIds: true },
      data: {
        maxConcurrent: input.maxConcurrent,
        allowedModelIds: input.allowedModelIds,
      },
    });
  }

  async createUserTemplate(
    userId: string,
    input: { toolType: AiToolCode; title: string; prompt: string; description?: string },
  ) {
    const row = await this.prisma.aiTemplate.create({
      data: { ownerId: userId, isSystem: false, ...input },
    });
    return mapTemplate(row);
  }

  async patchUserTemplate(
    userId: string,
    templateId: string,
    input: { title?: string; prompt?: string },
  ) {
    const row = await this.prisma.aiTemplate.findFirst({
      where: { id: templateId, ownerId: userId, isSystem: false, deletedAt: null },
    });
    if (!row) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'AI_GENERATION_NOT_FOUND', '模板不存在');
    }
    return mapTemplate(
      await this.prisma.aiTemplate.update({ where: { id: templateId }, data: input }),
    );
  }

  async deleteUserTemplate(userId: string, templateId: string) {
    await this.prisma.aiTemplate.updateMany({
      where: { id: templateId, ownerId: userId, isSystem: false },
      data: { deletedAt: new Date() },
    });
    return { id: templateId, deleted: true };
  }

  async listNavigation(input: { includeHidden?: boolean; remapByTool?: boolean } = {}) {
    const [items, tools] = await Promise.all([
      this.prisma.aiNavigationItem.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.aiTool.findMany(),
    ]);
    const toolByCode = new Map(tools.map((tool) => [tool.code, tool]));
    const remapByTool = input.remapByTool !== false;
    return items
      .filter((item) => input.includeHidden || item.visible)
      .map((item) => {
        const tool = item.toolCode ? toolByCode.get(item.toolCode) : undefined;
        let status = item.status;
        // 前台按「工具 ∩ 导航」取更严状态；后台配置页必须看到刚保存的导航值。
        if (remapByTool) {
          if (tool?.status === AiToolStatus.DISABLED) {
            status = AiNavStatus.DISABLED;
          } else if (tool?.status === AiToolStatus.COMING_SOON && status === AiNavStatus.ENABLED) {
            status = AiNavStatus.COMING_SOON;
          }
        }
        return {
          id: item.id,
          code: item.code,
          label: item.label,
          icon: item.icon,
          group: item.groupName.toLowerCase(),
          routeKey: item.routeKey,
          path: item.path,
          visible: item.visible,
          status: status === AiNavStatus.COMING_SOON ? 'comingSoon' : status.toLowerCase(),
          requiresLogin: item.requiresLogin,
          sortOrder: item.sortOrder,
          parentId: item.parentId,
          description: item.description,
          toolCode: item.toolCode?.toLowerCase(),
          version: item.version,
        };
      });
  }

  async patchNavigation(
    id: string,
    input: {
      label?: string;
      visible?: boolean;
      status?: AiNavStatus;
      sortOrder?: number;
      requiresLogin?: boolean;
      description?: string;
      version: number;
    },
  ) {
    const current = await this.prisma.aiNavigationItem.findUnique({ where: { id } });
    if (!current) {
      throw new DomainHttpException(
        HttpStatus.NOT_FOUND,
        'AI_GENERATION_NOT_FOUND',
        '导航项不存在',
      );
    }
    if (current.version !== input.version) {
      throw new DomainHttpException(
        HttpStatus.CONFLICT,
        'SYSTEM_CONFIG_VERSION_CONFLICT',
        '导航已被他人更新，请刷新后重试',
      );
    }
    const updated = await this.prisma.aiNavigationItem.update({
      where: { id },
      data: {
        label: input.label,
        visible: input.visible,
        status: input.status,
        sortOrder: input.sortOrder,
        requiresLogin: input.requiresLogin,
        description: input.description,
        version: { increment: 1 },
      },
    });
    // 导航和工具必须一起改，否则前台 remapByTool 会把刚启用的入口盖回「即将上线」。
    if (updated.toolCode && input.status === AiNavStatus.ENABLED) {
      await this.prisma.aiTool.updateMany({
        where: { code: updated.toolCode },
        data: { status: AiToolStatus.ENABLED },
      });
    } else if (updated.toolCode && input.status === AiNavStatus.COMING_SOON) {
      await this.prisma.aiTool.updateMany({
        where: { code: updated.toolCode, status: { not: AiToolStatus.DISABLED } },
        data: { status: AiToolStatus.COMING_SOON },
      });
    }
    return (await this.listNavigation({ includeHidden: true, remapByTool: false })).find(
      (item) => item.id === updated.id,
    );
  }

  async sortNavigation(items: Array<{ id: string; sortOrder: number }>) {
    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.aiNavigationItem.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder, version: { increment: 1 } },
        }),
      ),
    );
    return this.listNavigation({ includeHidden: true, remapByTool: false });
  }

  async patchBranding(
    input: {
      brandName?: string;
      logoText?: string;
      aiEnabled?: boolean;
      userProviderEnabled?: boolean;
      userCanPickModel?: boolean;
      userKeyConsumesQuota?: boolean;
    },
    actorId: string,
    requestId: string,
  ) {
    const current = await this.readBranding();
    const next = await this.system.updateConfigGroup({
      group: 'ai.branding',
      value: {
        aiEnabled: input.aiEnabled ?? current.aiEnabled,
        brandName: input.brandName?.trim() || current.brandName,
        logoText: input.logoText?.trim() || current.logoText,
        userProviderEnabled: input.userProviderEnabled ?? current.userProviderEnabled,
        userCanPickModel: input.userCanPickModel ?? current.userCanPickModel,
        userKeyConsumesQuota: input.userKeyConsumesQuota ?? current.userKeyConsumesQuota,
      },
      expectedVersion: current.version,
      actorId,
      requestId,
    });
    const value = next.value as AiBranding;
    return {
      brandName: value.brandName,
      logoText: value.logoText,
      aiEnabled: value.aiEnabled,
      userProviderEnabled: value.userProviderEnabled,
      userCanPickModel: value.userCanPickModel,
      userKeyConsumesQuota: value.userKeyConsumesQuota,
      version: next.version,
      updatedAt: next.updatedAt,
    };
  }

  async membership(userId: string) {
    await this.assertNavAvailable('membership');
    const usage = await this.usage(userId);
    const remaining = usage.remainingTokens;
    const low = remaining <= usage.lowBalanceThreshold;
    return {
      currentPlanId: usage.currentPlanId,
      currentPlanName: usage.currentPlanName,
      quota: {
        remainingTokens: usage.remainingTokens,
        usedTokens: usage.usedTokens,
        totalTokens: usage.totalTokens,
        lowBalanceThreshold: usage.lowBalanceThreshold,
      },
      plans: [usage.plan],
      inviteRecords: [],
      usageOverview: {
        balanceStatus: remaining <= 0 ? 'insufficient' : low ? 'low' : 'normal',
        balanceStatusText: remaining <= 0 ? '额度不足' : low ? '余额偏低' : '正常',
        trendDays: 30,
        trend: usage.trend,
        toolUsage: usage.toolUsage,
        guestTrial: { dailyLimit: 20, used: 0, remaining: 20, exceeded: false },
      },
    };
  }

  async profileSummary(userId: string) {
    const [entitlement, jobs, assets, sessions] = await Promise.all([
      this.entitlement(userId),
      this.prisma.aiGenerationJob.count({ where: { userId } }),
      this.prisma.aiAsset.count({ where: { ownerId: userId, deletedAt: null } }),
      this.prisma.aiConversation.count({
        where: { ownerType: AiOwnerType.USER, ownerId: userId, deletedAt: null },
      }),
    ]);
    return {
      nickname: entitlement.nickname,
      currentPlanName: entitlement.currentPlanName,
      quota: {
        remainingTokens: entitlement.remainingTokens,
        usedTokens: entitlement.usedTokens,
        totalTokens: entitlement.totalTokens,
        lowBalanceThreshold: entitlement.lowBalanceThreshold,
      },
      jobCount: jobs,
      assetCount: assets,
      sessionCount: sessions,
    };
  }

  async creationCenter(userId: string) {
    await this.assertNavAvailable('creation-center');
    const [jobs, assets, drafts, recentJobs] = await Promise.all([
      this.prisma.aiGenerationJob.count({ where: { userId } }),
      this.prisma.aiAsset.count({ where: { ownerId: userId, deletedAt: null } }),
      this.prisma.content.count({
        where: { authorId: userId, status: ContentStatus.DRAFT, deletedAt: null },
      }),
      this.prisma.aiGenerationJob.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: {
          model: { select: { displayName: true } },
          assets: { where: { deletedAt: null }, include: { file: true } },
        },
      }),
    ]);
    return {
      jobCount: jobs,
      assetCount: assets,
      draftCount: drafts,
      recentJobs: recentJobs.map((job) => mapJob(job, job.assets)),
    };
  }

  async publishDrafts(userId: string) {
    const list = await this.prisma.content.findMany({
      where: { authorId: userId, status: ContentStatus.DRAFT, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: { id: true, title: true, type: true, updatedAt: true, status: true },
    });
    return {
      list: list.map((row) => ({
        id: row.id,
        title: row.title ?? '未命名草稿',
        type: row.type,
        status: row.status.toLowerCase(),
        updatedAt: row.updatedAt.toISOString(),
        path: `/workspace/content/${row.id}`,
      })),
      total: list.length,
    };
  }

  tutorials() {
    return {
      list: [
        {
          id: 'ai-chat',
          title: '如何开始一次 AI 对话',
          summary: '选择模型、发送消息，停止必须点停止按钮。',
          path: '/ai/chat',
        },
        {
          id: 'ai-image',
          title: '图片生成结果从哪看',
          summary: '任务成功后当前卡片只展示本次资产；历史走生成任务列表。',
          path: '/ai/image',
        },
        {
          id: 'ai-quota',
          title: '额度预占与结算',
          summary: '扣费在服务端完成，前端只展示账本余额。',
          path: '/ai/membership',
        },
      ],
    };
  }

  private async readBranding() {
    const row = await this.prisma.systemConfig.findUnique({ where: { key: 'ai.branding' } });
    const value = parseGroupValue('ai.branding', row?.value) as AiBranding;
    return {
      brandName: value.brandName,
      logoText: value.logoText,
      aiEnabled: value.aiEnabled,
      userProviderEnabled: value.userProviderEnabled,
      userCanPickModel: value.userCanPickModel,
      userKeyConsumesQuota: value.userKeyConsumesQuota,
      version: row?.version ?? 1,
      updatedAt: (row?.updatedAt ?? new Date()).toISOString(),
    };
  }

  private async guestTrial(ownerId: string) {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const used = await this.prisma.aiUsageRecord.count({
      where: { ownerType: AiOwnerType.ANONYMOUS, ownerId, createdAt: { gte: start } },
    });
    const dailyLimit = 20;
    return {
      dailyLimit,
      used,
      remaining: Math.max(0, dailyLimit - used),
      exceeded: used >= dailyLimit,
    };
  }

  /** 工具状态和角色权益必须在服务端同时校验，前端导航只负责展示。 */
  private async assertToolAvailable(
    code: AiToolCode,
    owner: { type: AiOwnerType; id: string; userId?: string; permissionVersion?: number },
  ) {
    const [tool, nav, entitlement] = await Promise.all([
      this.prisma.aiTool.findUnique({ where: { code } }),
      this.prisma.aiNavigationItem.findFirst({ where: { toolCode: code } }),
      owner.userId
        ? this.prisma.aiEntitlement.findFirst({
            where: { role: { users: { some: { id: owner.userId } } } },
          })
        : Promise.resolve(null),
    ]);
    if (!tool || tool.status === AiToolStatus.DISABLED) {
      throw new DomainHttpException(HttpStatus.CONFLICT, 'AI_TOOL_UNAVAILABLE', '该工具暂不可用');
    }
    if (tool.status === AiToolStatus.COMING_SOON) {
      throw new DomainHttpException(HttpStatus.CONFLICT, 'AI_TOOL_UNAVAILABLE', '该工具即将上线');
    }
    if (nav && !nav.visible) {
      throw new DomainHttpException(HttpStatus.CONFLICT, 'AI_TOOL_UNAVAILABLE', '该工具暂不可用');
    }
    if (nav?.status === AiNavStatus.DISABLED) {
      throw new DomainHttpException(HttpStatus.CONFLICT, 'AI_TOOL_UNAVAILABLE', '该工具暂不可用');
    }
    if (nav?.status === AiNavStatus.COMING_SOON) {
      throw new DomainHttpException(HttpStatus.CONFLICT, 'AI_TOOL_UNAVAILABLE', '该工具即将上线');
    }
    if (owner.userId) {
      const allowed = jsonStringList(entitlement?.allowedToolCodes).map((item) =>
        item.toUpperCase(),
      );
      if (allowed.length > 0 && !allowed.includes(code)) {
        throw new DomainHttpException(
          HttpStatus.FORBIDDEN,
          'AUTH_FORBIDDEN',
          '当前套餐未开放该工具',
        );
      }
    } else if (tool.requiresLogin || !tool.guestTrialEnabled) {
      throw new DomainHttpException(HttpStatus.FORBIDDEN, 'AUTH_REQUIRED', '该工具需要登录后使用');
    }
  }

  /** 会员/创作中心等无工具绑定的占位页，同样以后台导航状态为准。 */
  private async assertNavAvailable(code: string) {
    const nav = await this.prisma.aiNavigationItem.findUnique({ where: { code } });
    if (!nav || !nav.visible || nav.status === AiNavStatus.DISABLED) {
      throw new DomainHttpException(HttpStatus.CONFLICT, 'AI_TOOL_UNAVAILABLE', '该功能暂不可用');
    }
    if (nav.status === AiNavStatus.COMING_SOON) {
      throw new DomainHttpException(HttpStatus.CONFLICT, 'AI_TOOL_UNAVAILABLE', '该功能即将上线');
    }
  }

  /** 自备模式的模型与凭据必须一同解析，避免在预占后才发现 Key 不可用。 */
  private async resolveTextModel(
    modelId: string | undefined,
    owner: { type: AiOwnerType; id: string; userId?: string },
    tool: AiToolCode,
  ): Promise<RuntimeTextModel> {
    const mode = owner.userId ? await this.userProviders.activeMode(owner.userId) : null;
    if (mode?.enabled && !mode.allowed) {
      throw new DomainHttpException(
        HttpStatus.CONFLICT,
        'AI_USER_PROVIDER_DISABLED',
        '管理员已暂停自备能力；请稍后重试或关闭自备模式',
      );
    }
    if (mode?.enabled && owner.userId) {
      let userModelId = modelId;
      if (!userModelId) {
        const preferred = mode.preferredUserModelId
          ? await this.prisma.aiUserModel.findFirst({
              where: {
                id: mode.preferredUserModelId,
                userId: owner.userId,
                enabled: true,
                credential: { enabled: true },
              },
              select: { id: true },
            })
          : null;
        const first =
          preferred ??
          (await this.prisma.aiUserModel.findFirst({
            where: { userId: owner.userId, enabled: true, credential: { enabled: true } },
            orderBy: { createdAt: 'asc' },
            select: { id: true },
          }));
        userModelId = first?.id;
      }
      if (userModelId) {
        const userModel = await this.prisma.aiUserModel.findFirst({
          where: { id: userModelId, userId: owner.userId, enabled: true },
          include: { credential: true },
        });
        if (userModel) {
          if (!userModel.credential?.enabled || !userModel.credential.baseUrl) {
            throw new DomainHttpException(
              HttpStatus.CONFLICT,
              'AI_USER_CREDENTIAL_REQUIRED',
              '自建模型的 Key 不可用；请到个人设置补充，或关闭自备模式',
            );
          }
          return {
            id: userModel.id,
            userModelId: userModel.id,
            userCredentialId: userModel.credential.id,
            modelKey: userModel.modelKey,
            maxReserveAmount: 0,
            maxOutputTokens: 2048,
            inputPricePer1k: 0,
            outputPricePer1k: 0,
            fixedPlatformCost: null,
            chargePlatform: false,
            provider: {
              id: userModel.credential.id,
              code: 'openai-compatible',
              baseUrl: userModel.credential.baseUrl,
              authEnvKey: null,
              timeoutMs: 20_000,
            },
          };
        }
        const historical = await this.prisma.aiUserModel.findFirst({
          where: { id: userModelId, userId: owner.userId },
          select: { id: true },
        });
        if (historical) {
          throw new DomainHttpException(
            HttpStatus.CONFLICT,
            'AI_USER_MODEL_UNAVAILABLE',
            '原自建模型不可用；请重新选择模型，或关闭自备模式',
          );
        }
      }
    }
    if (modelId && owner.userId) {
      const historical = await this.prisma.aiUserModel.findFirst({
        where: { id: modelId, userId: owner.userId },
        select: { id: true },
      });
      if (historical) {
        throw new DomainHttpException(
          HttpStatus.CONFLICT,
          'AI_USER_MODEL_UNAVAILABLE',
          '自建模型仅在自备模式可用；请重新选择模型或开启自备模式',
        );
      }
    }
    const systemModel = await this.resolveModel(modelId, owner, tool);
    if (!mode?.enabled || !owner.userId) return { ...systemModel, chargePlatform: true };
    const credential = await this.prisma.aiProviderCredential.findFirst({
      where: {
        ownerType: AiCredentialOwnerType.USER,
        userId: owner.userId,
        providerId: systemModel.provider.id,
        enabled: true,
      },
      select: { id: true },
    });
    if (!credential) {
      throw new DomainHttpException(
        HttpStatus.CONFLICT,
        'AI_USER_CREDENTIAL_REQUIRED',
        '此模型没有匹配的自备 Key；请到个人设置补充，或关闭自备模式',
      );
    }
    return {
      ...systemModel,
      userCredentialId: credential.id,
      chargePlatform: mode.userKeyConsumesQuota,
    };
  }

  private async resolveModel(
    modelId: string | undefined,
    owner: { type: AiOwnerType; id: string; userId?: string },
    tool: AiToolCode,
  ) {
    const guest = owner.type === AiOwnerType.ANONYMOUS;
    const defaultTool = modelId
      ? null
      : await this.prisma.aiTool.findUnique({ where: { code: tool } });
    const selectedId = modelId ?? defaultTool?.defaultModelId;
    const model = selectedId
      ? await this.prisma.aiModel.findUnique({
          where: { id: selectedId },
          include: { provider: true },
        })
      : null;
    if (
      !model ||
      !model.enabled ||
      !model.userVisible ||
      model.deprecatedAt !== null ||
      !model.provider.enabled ||
      (guest && !model.guestAllowed) ||
      !model.toolTypes.includes(tool)
    ) {
      throw new DomainHttpException(
        HttpStatus.CONFLICT,
        'AI_MODEL_NOT_AVAILABLE',
        '模型不可用或不在权益范围内',
      );
    }
    if (owner.userId) {
      const entitlement = await this.prisma.aiEntitlement.findFirst({
        where: { role: { users: { some: { id: owner.userId } } } },
      });
      const allowed = jsonStringList(entitlement?.allowedModelIds);
      if (allowed.length > 0 && !allowed.includes(model.id)) {
        throw new DomainHttpException(
          HttpStatus.FORBIDDEN,
          'AUTH_FORBIDDEN',
          '当前套餐未开放该模型',
        );
      }
    }
    const userCanPickModel = owner.userId
      ? (await this.userProviders.activeMode(owner.userId)).userCanPickModel
      : (await this.readBranding()).userCanPickModel;
    if (!userCanPickModel && modelId) {
      const defaultTool = await this.prisma.aiTool.findUnique({
        where: { code: tool },
        select: { defaultModelId: true },
      });
      if (model.id !== defaultTool?.defaultModelId) {
        throw new DomainHttpException(
          HttpStatus.CONFLICT,
          'AI_SYSTEM_MODEL_SELECTION_DISABLED',
          '当前不可改选系统模型；请选择该工具的默认模型',
        );
      }
    }
    if (
      model.inputPricePer1k === 0 &&
      model.outputPricePer1k === 0 &&
      model.fixedPlatformCost == null
    ) {
      throw new DomainHttpException(
        HttpStatus.CONFLICT,
        'AI_MODEL_NOT_AVAILABLE',
        '模型缺少定价规则',
      );
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

  private async snapshotContent(contentId: string, userId?: string, permissionVersion?: number) {
    const content = await this.prisma.content.findFirst({
      where: { id: contentId, deletedAt: null },
      include: { body: true, accessGrants: { select: { userId: true } } },
    });
    if (!content) {
      return null;
    }
    if (content.authorId !== userId) {
      const hasPrivateGrant =
        userId !== undefined && content.accessGrants.some((grant) => grant.userId === userId);
      const canReadAll =
        userId !== undefined && permissionVersion !== undefined
          ? (await this.auth.getPermissionSnapshot(userId, permissionVersion)).permissions.some(
              (item) => item.code === 'content:read' && item.dataScope === 'ALL',
            )
          : false;
      if (
        canReadAll === false &&
        (content.status !== ContentStatus.PUBLISHED ||
          content.importRestriction !== 'NONE' ||
          (content.visibility === 'PRIVATE' && !hasPrivateGrant) ||
          (content.visibility === 'LOGIN' && userId === undefined))
      ) {
        return null;
      }
    }
    const source = content.body?.markdownSource ?? content.summary ?? '';
    return { title: content.title ?? '未命名', excerpt: source.slice(0, 800) };
  }

  private async failRun(input: {
    assistantId: string;
    sessionId: string;
    reservationId?: string;
    requestId: string;
    errorCode: string;
  }) {
    let transactionError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await this.prisma.$transaction([
          this.prisma.aiMessage.update({
            where: { id: input.assistantId },
            data: {
              status: AiMessageStatus.FAILED,
              finishReason: AiFinishReason.ERROR,
              errorCode: input.errorCode,
            },
          }),
          this.prisma.aiConversation.update({
            where: { id: input.sessionId },
            data: { activeMessageId: null },
          }),
        ]);
        transactionError = undefined;
        break;
      } catch (error) {
        transactionError = error;
      }
    }

    let releaseError: unknown;
    if (input.reservationId) {
      try {
        await this.releaseReservationWithRetry(input.reservationId, input.requestId);
      } catch (error) {
        releaseError = error;
      }
    }
    if (transactionError || releaseError) {
      throw transactionError ?? releaseError;
    }
  }

  /** 失败路径释放预占允许一次重试，避免瞬时数据库连接抖动留下额度锁定。 */
  private async releaseReservationWithRetry(reservationId: string, requestId: string) {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await this.quota.release(reservationId, requestId);
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
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

function jsonStringList(value: Prisma.JsonValue | null | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
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
  tokenCostLabel?: string;
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
    tokenCostLabel: row.tokenCostLabel ?? '',
    group: (row.groupName ?? 'CREATE').toLowerCase(),
    path: `/ai/${code}`,
  };
}

function toAdminProvider(row: {
  id: string;
  code: string;
  label: string;
  enabled: boolean;
  baseUrl: string | null;
  remark: string | null;
  sourceFiled: boolean;
  filingNote: string | null;
  updatedAt: Date;
  credentials: Array<{ id: string }>;
}) {
  return {
    id: row.id,
    code: row.code,
    name: row.label,
    label: row.label,
    enabled: row.enabled,
    baseUrl: row.baseUrl ?? '',
    hasKey: row.credentials.length > 0,
    remark: row.remark ?? '',
    sourceFiled: row.sourceFiled,
    filingNote: row.filingNote ?? '',
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapModel(row: {
  id: string;
  displayName: string;
  modelKey: string;
  enabled: boolean;
  isDefault: boolean;
  toolTypes: AiToolCode[];
  provider?: { id: string; code: string; label: string } | null;
  defaultForTools?: Array<{ code: AiToolCode }>;
}) {
  return {
    id: row.id,
    name: row.displayName,
    provider: row.provider?.label ?? 'fake',
    providerId: row.provider?.id,
    providerCode: row.provider?.code,
    toolTypes: row.toolTypes.map((item) => item.toLowerCase()),
    enabled: row.enabled,
    isDefault: row.defaultForTools ? row.defaultForTools.length > 0 : row.isDefault,
    defaultToolTypes: row.defaultForTools?.map((tool) => tool.code.toLowerCase()),
  };
}

/** 管理端新增、编辑和列表共用同一业务对象，避免写接口返回 Prisma 原始字段。 */
function mapAdminModel(
  row: Prisma.AiModelGetPayload<{
    include: { provider: true; defaultForTools: { select: { code: true } } };
  }>,
) {
  return {
    ...mapModel(row),
    modelId: row.modelKey,
    displayName: row.displayName,
    providerCode: row.provider.code,
    providerName: row.provider.label,
    visibleToUser: row.userVisible,
    contextTokens: row.contextWindowTokens,
    maxOutputTokens: row.maxOutputTokens,
    modality: row.modality.toLowerCase(),
    fixedPlatformCost: row.fixedPlatformCost,
    inputPricePer1k: row.inputPricePer1k,
    outputPricePer1k: row.outputPricePer1k,
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
  modelId: string | null;
  userModelId?: string | null;
  systemPrompt: string | null;
  contextLimit: number;
  enableKnowledgeReference: boolean;
  messageCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  lastMessageAt: Date | null;
  model?: { displayName: string; provider?: { label: string } | null } | null;
  userModel?: { displayName: string; credential?: { label: string | null } | null } | null;
}) {
  return {
    id: row.id,
    title: row.title,
    modelId: row.userModelId ?? row.modelId ?? '',
    modelName:
      row.userModel?.displayName ??
      row.model?.displayName ??
      row.userModelId ??
      row.modelId ??
      '历史模型',
    providerName: row.userModel?.credential?.label ?? row.model?.provider?.label ?? '未知厂商',
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
  errorCode?: string | null;
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
    errorCode: row.errorCode ?? undefined,
    feedback: row.feedback === 'DISLIKE' ? 'dislike' : undefined,
    feedbackAt: row.feedbackAt?.toISOString(),
  };
}

/** 将内部异常映射为可返回给前端的稳定错误码，避免泄露厂商响应或数据库细节。 */
function aiFailureCode(error: unknown): string {
  if (error instanceof DomainHttpException) {
    const response = error.getResponse() as { code?: string };
    if (
      response.code &&
      [
        'AI_PROVIDER_KEY_MISSING',
        'AI_CREDENTIAL_KEY_MISSING',
        'AI_CREDENTIAL_INVALID',
        'AI_USER_CREDENTIAL_REQUIRED',
        'AI_USER_MODEL_UNAVAILABLE',
        'AI_SYSTEM_MODEL_SELECTION_DISABLED',
      ].includes(response.code)
    )
      return response.code;
  }
  const message = error instanceof Error ? error.message : '';
  if (/^OPENAI_COMPATIBLE_\d{3}$/.test(message)) {
    return message;
  }
  if (message === 'AI_UPSTREAM_INVALID_SSE' || message === 'AI_UPSTREAM_ERROR') {
    return message;
  }
  if (message === 'TimeoutError' || message === 'The operation was aborted due to timeout') {
    return 'AI_PROVIDER_TIMEOUT';
  }
  return 'AI_PROVIDER_FAILED';
}

function aiFailureMessage(code: string): string {
  if (code === 'AI_USER_CREDENTIAL_REQUIRED' || code === 'AI_CREDENTIAL_INVALID') {
    return '自备模式缺少可用 Key，请到个人设置补充配置或关闭自备模式';
  }
  if (code === 'AI_USER_MODEL_UNAVAILABLE') {
    return '当前会话的自建模型已不可用，请重新选择模型或关闭自备模式';
  }
  if (code === 'AI_SYSTEM_MODEL_SELECTION_DISABLED') {
    return '当前不可改选系统模型，请选择系统默认模型或自建模型';
  }
  if (code === 'AI_PROVIDER_KEY_MISSING' || code === 'AI_CREDENTIAL_KEY_MISSING') {
    return '模型厂商缺少可用凭据，请联系管理员配置';
  }
  return 'AI 服务调用失败，请稍后重试';
}

function mapJob(
  row: {
    id: string;
    toolType: AiToolCode;
    prompt: string;
    modelId: string;
    modelKeySnapshot?: string;
    model?: { displayName: string } | null;
    status: string;
    progress?: number;
    errorCode?: string | null;
    finishedAt?: Date | null;
    params?: Prisma.JsonValue;
    createdAt: Date;
    resultFileIds: Prisma.JsonValue;
  },
  assets: Array<{
    id: string;
    title: string;
    type: AiAssetType;
    source: string;
    status: AiAssetStatus;
    prompt: string | null;
    modelId: string | null;
    folderId: string | null;
    width: number | null;
    height: number | null;
    createdAt: Date;
    updatedAt: Date;
    file?: { mimeType: string } | null;
    folder?: { name: string } | null;
  }> = [],
) {
  const status =
    row.status === 'SUCCEEDED'
      ? 'done'
      : row.status === 'FAILED'
        ? 'failed'
        : row.status === 'CANCELED'
          ? 'stopped'
          : 'generating';
  const mappedAssets = assets.map(mapAsset);
  return {
    id: row.id,
    toolType: row.toolType.toLowerCase(),
    title: row.prompt.slice(0, 40),
    prompt: row.prompt,
    modelId: row.modelId,
    modelName: row.model?.displayName || row.modelKeySnapshot,
    status,
    progress: row.progress ?? 0,
    errorCode: row.errorCode ?? undefined,
    finishedAt: row.finishedAt?.toISOString(),
    params: row.params && typeof row.params === 'object' ? row.params : undefined,
    assetIds: mappedAssets.map((item) => item.id),
    assets: mappedAssets,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapAsset(row: {
  id: string;
  title: string;
  type: AiAssetType;
  source: string;
  status: AiAssetStatus;
  prompt: string | null;
  modelId?: string | null;
  folderId: string | null;
  width?: number | null;
  height?: number | null;
  createdAt: Date;
  updatedAt: Date;
  file?: { mimeType: string } | null;
  folder?: { name: string } | null;
}) {
  const fileUrl = `/api/v1/app/ai/assets/${row.id}/content`;
  return {
    id: row.id,
    assetId: row.id,
    title: row.title,
    type: row.type.toLowerCase(),
    source:
      row.source === 'GENERATED'
        ? 'generated'
        : row.source === 'UPLOADED'
          ? 'uploaded'
          : 'content-reference',
    status: row.status === 'TRASHED' ? 'trashed' : 'saved',
    prompt: row.prompt,
    modelId: row.modelId,
    folderId: row.folderId,
    folderName: row.folder?.name,
    mimeType: row.file?.mimeType,
    width: row.width,
    height: row.height,
    fileUrl,
    thumbnailUrl: fileUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toJobStatus(value?: string): AiGenerationJobStatus | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.toUpperCase();
  if (normalized === 'DONE' || normalized === 'SUCCEEDED') {
    return AiGenerationJobStatus.SUCCEEDED;
  }
  if (normalized === 'FAILED') {
    return AiGenerationJobStatus.FAILED;
  }
  if (normalized === 'STOPPED' || normalized === 'CANCELED') {
    return AiGenerationJobStatus.CANCELED;
  }
  if (normalized === 'GENERATING' || normalized === 'PROCESSING') {
    return AiGenerationJobStatus.PROCESSING;
  }
  if (normalized === 'QUEUED') {
    return AiGenerationJobStatus.QUEUED;
  }
  return undefined;
}

function mapPlan(code?: RoleCode) {
  if (code === RoleCode.SUPER_ADMIN || code === RoleCode.ADMIN) {
    return {
      id: 'admin',
      name: '管理成员',
      description: '后台运营账号对应的额度展示，不含购买能力。',
      monthlyTokens: 100000,
      priceLabel: '账号内含',
      highlighted: true,
      benefits: ['全部已开放工具', '后台配置', '较高并发'],
    };
  }
  if (code === RoleCode.EDITOR) {
    return {
      id: 'editor',
      name: '编辑',
      description: '内容编辑角色的额度展示。',
      monthlyTokens: 30000,
      priceLabel: '账号内含',
      benefits: ['对话 / 文本 / 图片', '内容发布草稿'],
    };
  }
  return {
    id: 'member',
    name: '普通成员',
    description: '登录成员的基础额度，购买套餐后置。',
    monthlyTokens: 10000,
    priceLabel: '账号内含',
    benefits: ['对话 / 文本', '登录后图片生成'],
  };
}
