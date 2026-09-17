import {
  AiModality,
  AiNavGroup,
  AiNavStatus,
  AiTemplateStatus,
  AiToolCode,
  AiToolGroup,
  AiToolStatus,
  PrismaClient,
} from '@prisma/client';
import { grantVerificationQuotaIfMissing } from './ai-quota';

const TEXT_SCENARIOS = [
  { scenario: 'write', title: '写作辅助', prompt: '根据主题写出结构清晰的文章。' },
  { scenario: 'rewrite', title: '改写润色', prompt: '在保留原意的前提下润色文本。' },
  { scenario: 'summary', title: '摘要提炼', prompt: '把原文压缩成要点清单。' },
  { scenario: 'expand', title: '扩写', prompt: '把提纲扩展成完整段落。' },
  { scenario: 'translate', title: '翻译', prompt: '按目标语言翻译，保持语气。' },
  { scenario: 'custom', title: '自定义', prompt: '严格遵循用户指令。' },
] as const;

export interface SeedAiCatalogOptions {
  /** 初始基线可以重置默认权益；生产配置同步只替换已淘汰的文本模型 ID。 */
  resetEntitlements?: boolean;
  /** 只有初始/本地 seed 才为现有用户补齐首发额度；生产目录同步不触碰账本。 */
  grantMissingQuota?: boolean;
  /**
   * 生产同步必须保留后台运营配置，只切换受控文本模型及其关联。
   * 初始/本地 seed 不传该项，仍写入完整基线目录。
   */
  preserveOperationalConfig?: boolean;
}

/**
 * 写入与当前文本 Provider 对齐的 AI 目录。可重复执行。
 *
 * API Key 始终只存在环境变量；目录表只保存其变量名，供后台展示配置状态。
 */
export async function seedAiCatalog(
  client: PrismaClient,
  options: SeedAiCatalogOptions = {},
): Promise<void> {
  const realTextCatalog = readRealTextCatalog();
  const preserveOperationalConfig = options.preserveOperationalConfig ?? false;
  const fakeProvider = await upsertFakeProvider(
    client,
    realTextCatalog !== null,
    preserveOperationalConfig,
  );

  const fakeChatModel = await upsertModel(client, fakeProvider.id, {
    modelKey: 'fake-chat',
    displayName: '内置对话演示',
    toolTypes: [AiToolCode.CHAT, AiToolCode.TEXT],
    modality: AiModality.TEXT,
    guestAllowed: true,
    isDefault: !realTextCatalog,
    inputPricePer1k: 1,
    outputPricePer1k: 2,
    maxReserveAmount: 800,
    enabled: !realTextCatalog,
    userVisible: !realTextCatalog,
  });
  const imageModel = await upsertModel(
    client,
    fakeProvider.id,
    {
      modelKey: 'fake-image',
      displayName: '图片生成（占位）',
      toolTypes: [AiToolCode.IMAGE],
      modality: AiModality.IMAGE,
      guestAllowed: false,
      isDefault: true,
      inputPricePer1k: 0,
      outputPricePer1k: 0,
      fixedPlatformCost: 500,
      maxReserveAmount: 500,
      supportsStreaming: false,
    },
    preserveOperationalConfig,
  );
  const videoModel = await upsertModel(
    client,
    fakeProvider.id,
    {
      modelKey: 'fake-video',
      displayName: '视频生成（占位）',
      toolTypes: [AiToolCode.VIDEO],
      modality: AiModality.VIDEO,
      guestAllowed: false,
      isDefault: true,
      enabled: true,
      userVisible: true,
      inputPricePer1k: 0,
      outputPricePer1k: 0,
      fixedPlatformCost: 800,
      maxReserveAmount: 800,
      supportsStreaming: false,
    },
    preserveOperationalConfig,
  );

  const chatModel = realTextCatalog
    ? await upsertRealTextModel(client, realTextCatalog, preserveOperationalConfig)
    : fakeChatModel;

  await upsertTool(
    client,
    {
      code: AiToolCode.CHAT,
      name: 'AI 对话',
      description: '多会话流式对话',
      icon: 'robot',
      sortOrder: 10,
      requiresLogin: false,
      guestTrialEnabled: true,
      groupName: AiToolGroup.CREATE,
      defaultModelId: chatModel.id,
      status: AiToolStatus.ENABLED,
    },
    preserveOperationalConfig,
  );
  await upsertTool(
    client,
    {
      code: AiToolCode.TEXT,
      name: '文本生成',
      description: '按场景生成或改写文本',
      icon: 'edit',
      sortOrder: 20,
      requiresLogin: false,
      guestTrialEnabled: true,
      groupName: AiToolGroup.CREATE,
      defaultModelId: chatModel.id,
      status: AiToolStatus.ENABLED,
    },
    preserveOperationalConfig,
  );
  if (!preserveOperationalConfig) {
    await upsertTool(client, {
      code: AiToolCode.IMAGE,
      name: '图片生成',
      description: '文生图异步任务',
      icon: 'picture',
      sortOrder: 30,
      requiresLogin: true,
      guestTrialEnabled: false,
      groupName: AiToolGroup.CREATE,
      defaultModelId: imageModel.id,
      status: AiToolStatus.ENABLED,
    });
    await upsertTool(client, {
      code: AiToolCode.VIDEO,
      name: '视频生成',
      description: '文生视频异步任务',
      icon: 'videoCamera',
      sortOrder: 40,
      requiresLogin: true,
      guestTrialEnabled: false,
      groupName: AiToolGroup.CREATE,
      defaultModelId: videoModel.id,
      status: AiToolStatus.COMING_SOON,
    });
  }

  for (const [index, item] of TEXT_SCENARIOS.entries()) {
    await client.aiTemplate.upsert({
      where: { id: `00000000-0000-4000-8000-00000000000${index}` },
      create: {
        id: `00000000-0000-4000-8000-00000000000${index}`,
        isSystem: true,
        toolType: AiToolCode.TEXT,
        title: item.title,
        description: item.prompt,
        prompt: item.prompt,
        textScenario: item.scenario,
        status: AiTemplateStatus.ENABLED,
        sortOrder: (index + 1) * 10,
        modelId: chatModel.id,
      },
      update: preserveOperationalConfig
        ? { modelId: chatModel.id }
        : {
            title: item.title,
            prompt: item.prompt,
            status: AiTemplateStatus.ENABLED,
            modelId: chatModel.id,
          },
    });
  }

  if (realTextCatalog) {
    // 已有会话仍引用旧文本演示模型时，继续发送会被禁用模型拦住；只替换该受控默认模型。
    await client.aiConversation.updateMany({
      where: { modelId: fakeChatModel.id },
      data: { modelId: chatModel.id },
    });
  }

  const modelIds = [chatModel.id, imageModel.id, videoModel.id];
  const toolCodes = [AiToolCode.CHAT, AiToolCode.TEXT, AiToolCode.IMAGE, AiToolCode.VIDEO];
  await syncEntitlements(client, {
    reset: options.resetEntitlements ?? true,
    modelIds,
    oldTextModelId: fakeChatModel.id,
    newTextModelId: chatModel.id,
    toolCodes,
  });

  if (options.grantMissingQuota ?? true) {
    await grantSeedQuotaAccounts(client);
  }
  if (!preserveOperationalConfig) {
    await seedAiNavigation(client);
  }
}

/**
 * 默认 AI 侧栏入口。已有记录只回写目录字段，不覆盖运营改过的显隐/状态/排序。
 */
async function seedAiNavigation(client: PrismaClient): Promise<void> {
  const create = await upsertNav(client, {
    code: 'create',
    label: '创作',
    icon: 'deployment',
    groupName: AiNavGroup.CREATE,
    routeKey: 'ai.create',
    path: '/ai/create',
    sortOrder: 20,
    requiresLogin: false,
    status: AiNavStatus.ENABLED,
    description: '创作类工具分组',
  });

  const catalog: Array<{
    code: string;
    label: string;
    icon: string;
    groupName: AiNavGroup;
    routeKey: string;
    path: string;
    sortOrder: number;
    requiresLogin: boolean;
    status: AiNavStatus;
    description: string;
    parentId?: string;
    toolCode?: AiToolCode;
  }> = [
    {
      code: 'home',
      label: '首页',
      icon: 'home',
      groupName: AiNavGroup.HOME,
      routeKey: 'ai.home',
      path: '/ai',
      sortOrder: 10,
      requiresLogin: false,
      status: AiNavStatus.ENABLED,
      description: 'AI 工作台首页',
    },
    {
      code: 'chat',
      label: 'AI 对话',
      icon: 'robot',
      groupName: AiNavGroup.CREATE,
      routeKey: 'ai.chat',
      path: '/ai/chat',
      sortOrder: 21,
      requiresLogin: false,
      status: AiNavStatus.ENABLED,
      description: '多会话流式对话',
      parentId: create.id,
      toolCode: AiToolCode.CHAT,
    },
    {
      code: 'text',
      label: '文本生成',
      icon: 'edit',
      groupName: AiNavGroup.CREATE,
      routeKey: 'ai.text',
      path: '/ai/text',
      sortOrder: 22,
      requiresLogin: false,
      status: AiNavStatus.ENABLED,
      description: '按场景生成或改写文本',
      parentId: create.id,
      toolCode: AiToolCode.TEXT,
    },
    {
      code: 'image',
      label: '图片生成',
      icon: 'picture',
      groupName: AiNavGroup.CREATE,
      routeKey: 'ai.image',
      path: '/ai/image',
      sortOrder: 23,
      requiresLogin: true,
      status: AiNavStatus.ENABLED,
      description: '文生图异步任务',
      parentId: create.id,
      toolCode: AiToolCode.IMAGE,
    },
    {
      code: 'video',
      label: '视频生成',
      icon: 'videoCamera',
      groupName: AiNavGroup.CREATE,
      routeKey: 'ai.video',
      path: '/ai/video',
      sortOrder: 24,
      requiresLogin: true,
      status: AiNavStatus.COMING_SOON,
      description: '视频生成占位',
      parentId: create.id,
      toolCode: AiToolCode.VIDEO,
    },
    {
      code: 'webui',
      label: 'WebUI',
      icon: 'appstore',
      groupName: AiNavGroup.CREATE,
      routeKey: 'ai.webui',
      path: '/ai/webui',
      sortOrder: 25,
      requiresLogin: true,
      status: AiNavStatus.COMING_SOON,
      description: '专业绘图工作台',
      parentId: create.id,
    },
    {
      code: 'comfyui',
      label: 'ComfyUI',
      icon: 'deployment',
      groupName: AiNavGroup.CREATE,
      routeKey: 'ai.comfyui',
      path: '/ai/comfyui',
      sortOrder: 26,
      requiresLogin: true,
      status: AiNavStatus.COMING_SOON,
      description: '节点式工作流',
      parentId: create.id,
    },
    {
      code: 'lora',
      label: '训练 LoRA',
      icon: 'experiment',
      groupName: AiNavGroup.CREATE,
      routeKey: 'ai.lora',
      path: '/ai/lora',
      sortOrder: 27,
      requiresLogin: true,
      status: AiNavStatus.COMING_SOON,
      description: '风格模型训练',
      parentId: create.id,
    },
    {
      code: 'apps',
      label: 'AI 应用',
      icon: 'appstore',
      groupName: AiNavGroup.CREATE,
      routeKey: 'ai.apps',
      path: '/ai/apps',
      sortOrder: 28,
      requiresLogin: false,
      status: AiNavStatus.COMING_SOON,
      description: '模板应用广场',
      parentId: create.id,
    },
    {
      code: 'assets',
      label: '资产',
      icon: 'folder',
      groupName: AiNavGroup.ASSETS,
      routeKey: 'ai.assets',
      path: '/ai/assets',
      sortOrder: 30,
      requiresLogin: true,
      status: AiNavStatus.ENABLED,
      description: '生成结果与素材库',
    },
    {
      code: 'profile',
      label: '个人中心',
      icon: 'user',
      groupName: AiNavGroup.PROFILE,
      routeKey: 'ai.profile',
      path: '/ai/profile',
      sortOrder: 40,
      requiresLogin: true,
      status: AiNavStatus.ENABLED,
      description: '账号与额度摘要',
    },
    {
      code: 'team',
      label: '创建团队',
      icon: 'team',
      groupName: AiNavGroup.PROFILE,
      routeKey: 'ai.team',
      path: '/ai/team',
      sortOrder: 41,
      requiresLogin: true,
      status: AiNavStatus.DISABLED,
      description: '团队协作尚未开放',
    },
    {
      code: 'creation-center',
      label: '创作中心',
      icon: 'appstore',
      groupName: AiNavGroup.PROFILE,
      routeKey: 'ai.creationCenter',
      path: '/ai/creation-center',
      sortOrder: 42,
      requiresLogin: true,
      status: AiNavStatus.ENABLED,
      description: '任务与草稿汇总',
    },
    {
      code: 'membership',
      label: '会员中心',
      icon: 'crown',
      groupName: AiNavGroup.COMMERCE,
      routeKey: 'ai.membership',
      path: '/ai/membership',
      sortOrder: 43,
      requiresLogin: true,
      status: AiNavStatus.ENABLED,
      description: '额度与套餐展示',
    },
    {
      code: 'publish',
      label: '发布',
      icon: 'send',
      groupName: AiNavGroup.HELP,
      routeKey: 'ai.publish',
      path: '/ai/publish',
      sortOrder: 50,
      requiresLogin: true,
      status: AiNavStatus.ENABLED,
      description: '内容草稿列表',
    },
    {
      code: 'tutorials',
      label: '教程',
      icon: 'fileText',
      groupName: AiNavGroup.HELP,
      routeKey: 'ai.tutorials',
      path: '/ai/tutorials',
      sortOrder: 51,
      requiresLogin: false,
      status: AiNavStatus.ENABLED,
      description: '使用说明',
    },
    {
      code: 'api',
      label: 'API',
      icon: 'api',
      groupName: AiNavGroup.OPEN,
      routeKey: 'ai.api',
      path: '/ai/api',
      sortOrder: 52,
      requiresLogin: true,
      status: AiNavStatus.DISABLED,
      description: '开放 API 控制台尚未开放',
    },
  ];

  for (const item of catalog) {
    await upsertNav(client, item);
  }
}

async function upsertNav(
  client: PrismaClient,
  input: {
    code: string;
    label: string;
    icon: string;
    groupName: AiNavGroup;
    routeKey: string;
    path: string;
    sortOrder: number;
    requiresLogin: boolean;
    status: AiNavStatus;
    description: string;
    parentId?: string | null;
    toolCode?: AiToolCode;
  },
) {
  const existing = await client.aiNavigationItem.findUnique({ where: { code: input.code } });
  if (existing) {
    return client.aiNavigationItem.update({
      where: { id: existing.id },
      data: {
        label: input.label,
        icon: input.icon,
        groupName: input.groupName,
        routeKey: input.routeKey,
        path: input.path,
        description: input.description,
        parentId: input.parentId ?? null,
        toolCode: input.toolCode ?? null,
      },
    });
  }
  return client.aiNavigationItem.create({
    data: {
      ...input,
      parentId: input.parentId ?? null,
    },
  });
}

/**
 * 本地 seed 用户不会走邮箱验证发放链路，这里按角色额度补账本。
 * 幂等键与验证发放相同，避免以后补验证时重复加额。
 */
async function grantSeedQuotaAccounts(client: PrismaClient): Promise<void> {
  const users = await client.user.findMany({ select: { id: true, roleId: true } });
  for (const user of users) {
    await grantVerificationQuotaIfMissing(client, user, 'SEED_LOCAL_GRANT');
  }
}

/**
 * 初始 seed 写入基线权益；已运行生产环境只替换受控模型 ID，避免覆盖运营已调过的额度和限流。
 */
async function syncEntitlements(
  client: PrismaClient,
  input: {
    reset: boolean;
    modelIds: string[];
    oldTextModelId: string;
    newTextModelId: string;
    toolCodes: AiToolCode[];
  },
): Promise<void> {
  if (input.reset) {
    await client.aiEntitlement.updateMany({
      data: {
        maxConcurrent: 2,
        rpm: 30,
        rpd: 300,
        guestRpm: 5,
        guestRpd: 20,
        allowedModelIds: input.modelIds,
        allowedToolCodes: input.toolCodes,
      },
    });
    return;
  }

  const entitlements = await client.aiEntitlement.findMany({
    select: { id: true, allowedModelIds: true },
  });
  for (const entitlement of entitlements) {
    const currentModelIds = Array.isArray(entitlement.allowedModelIds)
      ? entitlement.allowedModelIds.filter((id): id is string => typeof id === 'string')
      : null;
    if (currentModelIds === null) {
      continue;
    }
    const next = [
      ...new Set(
        currentModelIds.map((id) =>
          id === input.oldTextModelId ? input.newTextModelId : String(id),
        ),
      ),
    ];
    if (
      next.length !== currentModelIds.length ||
      next.some((id, index) => id !== currentModelIds[index])
    ) {
      await client.aiEntitlement.update({
        where: { id: entitlement.id },
        data: { allowedModelIds: next },
      });
    }
  }
}

interface RealTextCatalog {
  baseUrl: string;
  modelKey: string;
}

/**
 * 初始 seed 负责补齐完整 Provider 基线；生产同步不改后台可能已调整的 Provider 开关和文案。
 */
async function upsertFakeProvider(
  client: PrismaClient,
  realTextCatalogEnabled: boolean,
  preserveOperationalConfig: boolean,
) {
  const existing = await client.aiProvider.findUnique({ where: { code: 'fake' } });
  if (existing && preserveOperationalConfig) {
    return existing;
  }
  const label = realTextCatalogEnabled ? '内置媒体占位服务' : '内置演示服务';
  if (existing) {
    return client.aiProvider.update({
      where: { id: existing.id },
      data: { label, enabled: true, authEnvKey: null },
    });
  }
  return client.aiProvider.create({
    data: {
      code: 'fake',
      label,
      enabled: true,
      authEnvKey: null,
      timeoutMs: 15000,
    },
  });
}

/**
 * 仅当三项真实上游配置均存在时切换文本目录，避免半填环境把可用 Fake 目录误关掉。
 */
function readRealTextCatalog(): RealTextCatalog | null {
  if (process.env.AI_TEXT_PROVIDER !== 'openai_compatible') {
    return null;
  }
  const baseUrl = process.env.AI_OPENAI_BASE_URL?.trim();
  const modelKey = process.env.AI_OPENAI_MODEL?.trim();
  const apiKey = process.env.AI_OPENAI_API_KEY?.trim();
  if (!baseUrl || !modelKey || !apiKey) {
    throw new Error(
      'AI_TEXT_PROVIDER=openai_compatible 时必须同时设置 AI_OPENAI_BASE_URL、AI_OPENAI_API_KEY、AI_OPENAI_MODEL。',
    );
  }
  return { baseUrl, modelKey };
}

/** 把文本模型目录绑定到已验证的 OpenAI-compatible 运行时配置。 */
async function upsertRealTextModel(
  client: PrismaClient,
  catalog: RealTextCatalog,
  preserveOperationalConfig: boolean,
) {
  const existingProvider = await client.aiProvider.findUnique({
    where: { code: 'openai-compatible' },
  });
  const provider = existingProvider
    ? await client.aiProvider.update({
        where: { id: existingProvider.id },
        // Base URL 是部署环境的事实来源；其它字段由后台运营配置负责。
        data: preserveOperationalConfig
          ? { baseUrl: catalog.baseUrl }
          : {
              label: 'OpenAI 兼容文本服务',
              baseUrl: catalog.baseUrl,
              enabled: true,
              authEnvKey: 'AI_OPENAI_API_KEY',
            },
      })
    : await client.aiProvider.create({
        data: {
          code: 'openai-compatible',
          label: 'OpenAI 兼容文本服务',
          baseUrl: catalog.baseUrl,
          enabled: true,
          authEnvKey: 'AI_OPENAI_API_KEY',
        },
      });
  const model = await upsertModel(
    client,
    provider.id,
    {
      modelKey: catalog.modelKey,
      displayName: catalog.modelKey,
      toolTypes: [AiToolCode.CHAT, AiToolCode.TEXT],
      modality: AiModality.TEXT,
      guestAllowed: true,
      isDefault: true,
      inputPricePer1k: 1,
      outputPricePer1k: 2,
      maxReserveAmount: 800,
    },
    preserveOperationalConfig,
  );
  if (preserveOperationalConfig) {
    // 运行时只读取当前环境变量中的模型；切换模型时必须清掉同 Provider 的旧默认标记。
    await client.aiModel.updateMany({
      where: {
        providerId: provider.id,
        id: { not: model.id },
        isDefault: true,
        toolTypes: { hasSome: [AiToolCode.CHAT, AiToolCode.TEXT] },
      },
      data: { isDefault: false },
    });
    if (!model.isDefault) {
      return client.aiModel.update({ where: { id: model.id }, data: { isDefault: true } });
    }
  }
  return model;
}

async function upsertModel(
  client: PrismaClient,
  providerId: string,
  input: {
    modelKey: string;
    displayName: string;
    toolTypes: AiToolCode[];
    modality: AiModality;
    guestAllowed: boolean;
    isDefault: boolean;
    inputPricePer1k: number;
    outputPricePer1k: number;
    maxReserveAmount: number;
    fixedPlatformCost?: number;
    supportsStreaming?: boolean;
    enabled?: boolean;
    userVisible?: boolean;
  },
  preserveOperationalConfig = false,
) {
  const existing = await client.aiModel.findUnique({
    where: { providerId_modelKey: { providerId, modelKey: input.modelKey } },
  });
  if (existing) {
    if (preserveOperationalConfig) {
      return existing;
    }
    return client.aiModel.update({
      where: { id: existing.id },
      data: {
        displayName: input.displayName,
        toolTypes: input.toolTypes,
        enabled: input.enabled ?? true,
        userVisible: input.userVisible ?? true,
        guestAllowed: input.guestAllowed,
        isDefault: input.isDefault,
        inputPricePer1k: input.inputPricePer1k,
        outputPricePer1k: input.outputPricePer1k,
        fixedPlatformCost: input.fixedPlatformCost ?? null,
        maxReserveAmount: input.maxReserveAmount,
        supportsStreaming: input.supportsStreaming ?? true,
      },
    });
  }
  return client.aiModel.create({
    data: {
      providerId,
      ...input,
    },
  });
}

async function upsertTool(
  client: PrismaClient,
  input: {
    code: AiToolCode;
    name: string;
    description: string;
    icon: string;
    sortOrder: number;
    requiresLogin: boolean;
    guestTrialEnabled: boolean;
    groupName: AiToolGroup;
    defaultModelId: string;
    status: AiToolStatus;
  },
  preserveOperationalConfig = false,
) {
  return client.aiTool.upsert({
    where: { code: input.code },
    create: input,
    update: preserveOperationalConfig
      ? { defaultModelId: input.defaultModelId }
      : {
          name: input.name,
          description: input.description,
          status: input.status,
          defaultModelId: input.defaultModelId,
          requiresLogin: input.requiresLogin,
          guestTrialEnabled: input.guestTrialEnabled,
          sortOrder: input.sortOrder,
        },
  });
}
