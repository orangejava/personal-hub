import {
  AiModality,
  AiQuotaTransactionType,
  AiTemplateStatus,
  AiToolCode,
  AiToolGroup,
  AiToolStatus,
  PrismaClient,
} from '@prisma/client';

const TEXT_SCENARIOS = [
  { scenario: 'write', title: '写作辅助', prompt: '根据主题写出结构清晰的文章。' },
  { scenario: 'rewrite', title: '改写润色', prompt: '在保留原意的前提下润色文本。' },
  { scenario: 'summary', title: '摘要提炼', prompt: '把原文压缩成要点清单。' },
  { scenario: 'expand', title: '扩写', prompt: '把提纲扩展成完整段落。' },
  { scenario: 'translate', title: '翻译', prompt: '按目标语言翻译，保持语气。' },
  { scenario: 'custom', title: '自定义', prompt: '严格遵循用户指令。' },
] as const;

/**
 * 写入 Fake Provider 与默认可运营目录。可重复执行。
 */
export async function seedAiCatalog(client: PrismaClient): Promise<void> {
  const provider = await client.aiProvider.upsert({
    where: { code: 'fake' },
    create: {
      code: 'fake',
      label: 'Fake Provider',
      enabled: true,
      authEnvKey: null,
      timeoutMs: 15000,
    },
    update: { label: 'Fake Provider', enabled: true },
  });

  const chatModel = await upsertModel(client, provider.id, {
    modelKey: 'fake-chat',
    displayName: 'Fake Chat',
    toolTypes: [AiToolCode.CHAT, AiToolCode.TEXT],
    modality: AiModality.TEXT,
    guestAllowed: true,
    isDefault: true,
    inputPricePer1k: 1,
    outputPricePer1k: 2,
    maxReserveAmount: 800,
  });
  const imageModel = await upsertModel(client, provider.id, {
    modelKey: 'fake-image',
    displayName: 'Fake Image',
    toolTypes: [AiToolCode.IMAGE],
    modality: AiModality.IMAGE,
    guestAllowed: false,
    isDefault: true,
    inputPricePer1k: 0,
    outputPricePer1k: 0,
    fixedPlatformCost: 500,
    maxReserveAmount: 500,
    supportsStreaming: false,
  });
  const videoModel = await upsertModel(client, provider.id, {
    modelKey: 'fake-video',
    displayName: 'Fake Video',
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
  });

  await upsertTool(client, {
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
  });
  await upsertTool(client, {
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
  });
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
    description: 'Mock 视频任务',
    icon: 'videoCamera',
    sortOrder: 40,
    requiresLogin: true,
    guestTrialEnabled: false,
    groupName: AiToolGroup.CREATE,
    defaultModelId: videoModel.id,
    status: AiToolStatus.COMING_SOON,
  });

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
      update: {
        title: item.title,
        prompt: item.prompt,
        status: AiTemplateStatus.ENABLED,
      },
    });
  }

  const modelIds = [chatModel.id, imageModel.id, videoModel.id];
  const toolCodes = [AiToolCode.CHAT, AiToolCode.TEXT, AiToolCode.IMAGE, AiToolCode.VIDEO];
  await client.aiEntitlement.updateMany({
    data: {
      maxConcurrent: 2,
      rpm: 30,
      rpd: 300,
      guestRpm: 5,
      guestRpd: 20,
      allowedModelIds: modelIds,
      allowedToolCodes: toolCodes,
    },
  });

  await grantSeedQuotaAccounts(client);
}

/**
 * 本地 seed 用户不会走邮箱验证发放链路，这里按角色额度补账本。
 * 幂等键与验证发放相同，避免以后补验证时重复加额。
 */
async function grantSeedQuotaAccounts(client: PrismaClient): Promise<void> {
  const users = await client.user.findMany({ select: { id: true, roleId: true } });
  for (const user of users) {
    const entitlement = await client.aiEntitlement.findUnique({ where: { roleId: user.roleId } });
    const amount = entitlement?.verificationGrantAmount ?? 0n;
    const account = await client.aiQuotaAccount.upsert({
      where: { userId: user.id },
      create: { userId: user.id, availableAmount: 0n, reservedAmount: 0n },
      update: {},
    });
    const idempotencyKey = `email-verify-grant:${user.id}`;
    const existing = await client.aiQuotaTransaction.findUnique({ where: { idempotencyKey } });
    if (existing !== null || amount <= 0n) {
      continue;
    }
    const nextAvailable = account.availableAmount + amount;
    await client.aiQuotaAccount.update({
      where: { id: account.id },
      data: { availableAmount: nextAvailable, version: { increment: 1 } },
    });
    await client.aiQuotaTransaction.create({
      data: {
        accountId: account.id,
        type: AiQuotaTransactionType.GRANT,
        amount,
        availableBalanceAfter: nextAvailable,
        reservedBalanceAfter: account.reservedAmount,
        source: 'SEED_LOCAL_GRANT',
        idempotencyKey,
      },
    });
  }
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
) {
  const existing = await client.aiModel.findUnique({
    where: { providerId_modelKey: { providerId, modelKey: input.modelKey } },
  });
  if (existing) {
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
) {
  return client.aiTool.upsert({
    where: { code: input.code },
    create: input,
    update: {
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
