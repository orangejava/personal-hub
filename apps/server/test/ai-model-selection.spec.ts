import { AiOwnerType, AiToolCode } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AiService } from '../src/modules/ai/ai.service';

function fixture() {
  const provider = { id: 'provider', code: 'openai-compatible', label: '厂商', enabled: true };
  const model = (id: string, toolTypes: AiToolCode[], defaultForTools: AiToolCode[]) => ({
    id,
    displayName: id,
    modelKey: id,
    providerId: provider.id,
    enabled: true,
    userVisible: true,
    deprecatedAt: null,
    guestAllowed: true,
    toolTypes,
    defaultForTools: defaultForTools.map((code) => ({ code })),
    provider,
    inputPricePer1k: 1,
    outputPricePer1k: 1,
    fixedPlatformCost: null,
  });
  const models = [
    model('chat-default', [AiToolCode.CHAT], [AiToolCode.CHAT]),
    model('chat-other', [AiToolCode.CHAT], []),
    model('image-default', [AiToolCode.IMAGE], [AiToolCode.IMAGE]),
    model('mixed-image-default', [AiToolCode.CHAT, AiToolCode.IMAGE], [AiToolCode.IMAGE]),
  ];
  const defaults = {
    [AiToolCode.CHAT]: 'chat-default',
    [AiToolCode.IMAGE]: 'image-default',
  } as Partial<Record<AiToolCode, string>>;
  const prisma = {
    aiModel: {
      findMany: vi.fn().mockResolvedValue(models),
      findUnique: vi.fn(
        async ({ where }: { where: { id: string } }) =>
          models.find((row) => row.id === where.id) ?? null,
      ),
    },
    aiTool: {
      findUnique: vi.fn(async ({ where }: { where: { code: AiToolCode } }) => ({
        defaultModelId: defaults[where.code] ?? null,
      })),
    },
    aiEntitlement: { findFirst: vi.fn().mockResolvedValue(null) },
    aiUserModel: { findMany: vi.fn().mockResolvedValue([]) },
    aiProviderCredential: {
      findMany: vi.fn().mockResolvedValue([{ providerId: provider.id }]),
    },
  };
  const userProviders = {
    activeMode: vi.fn().mockResolvedValue({
      enabled: false,
      allowed: true,
      userCanPickModel: false,
      userKeyConsumesQuota: false,
    }),
  };
  const service = Object.assign(Object.create(AiService.prototype), {
    prisma,
    userProviders,
    readBranding: vi.fn().mockResolvedValue({ userCanPickModel: false }),
  }) as AiService;
  const owner = { type: AiOwnerType.USER, id: 'user', userId: 'user' };
  const resolveModel = (id: string, tool: AiToolCode) =>
    (
      service as unknown as {
        resolveModel: (
          modelId: string,
          selectedOwner: typeof owner,
          tool: AiToolCode,
        ) => Promise<unknown>;
      }
    ).resolveModel(id, owner, tool);
  return { service, owner, userProviders, prisma, resolveModel };
}

describe('系统模型改选开关', () => {
  it('访客在关闭改选时只看到各工具默认模型，显式调用其他模型会被拒绝', async () => {
    const { service } = fixture();
    const guest = { type: AiOwnerType.ANONYMOUS, id: 'guest' };
    const visible = await service.listVisibleModels(guest);
    expect(visible.map((row) => row.id)).toEqual([
      'chat-default', 'image-default', 'mixed-image-default',
    ]);
    expect(visible.find((row) => row.id === 'mixed-image-default')?.toolTypes).toEqual(['image']);
    const resolve = (id: string) => (service as unknown as {
      resolveModel: (modelId: string, owner: typeof guest, tool: AiToolCode) => Promise<unknown>;
    }).resolveModel(id, guest, AiToolCode.CHAT);
    await expect(resolve('chat-default')).resolves.toMatchObject({ id: 'chat-default' });
    await expect(resolve('chat-other')).rejects.toThrow('当前不可改选系统模型');
    Object.assign(service, { readBranding: vi.fn().mockResolvedValue({ userCanPickModel: true }) });
    expect((await service.listVisibleModels(guest)).map((row) => row.id)).toContain('chat-other');
    await expect(resolve('chat-other')).resolves.toMatchObject({ id: 'chat-other' });
  });

  it('管理员暂停已开启的自备模式时，Chat 不可选而图片仍可用', async () => {
    const { service, owner, userProviders } = fixture();
    userProviders.activeMode.mockResolvedValue({
      enabled: true, allowed: false, userCanPickModel: false, userKeyConsumesQuota: false,
    });
    const models = await service.listVisibleModels(owner);
    const blocked = (id: string) => {
      const row = models.find((item) => item.id === id);
      return row && 'blockedToolTypes' in row ? row.blockedToolTypes : undefined;
    };
    expect(blocked('chat-default')).toEqual(['chat']);
    expect(blocked('image-default')).toEqual([]);
    expect(blocked('mixed-image-default')).toEqual([]);
    expect(userProviders.activeMode).toHaveBeenCalledWith(owner.userId);
  });

  it('个人关闭自备模式后系统 Chat 恢复可选，管理员重新开放后不再标记暂停', async () => {
    const { service, owner, userProviders } = fixture();
    userProviders.activeMode.mockResolvedValue({
      enabled: false, allowed: false, userCanPickModel: false, userKeyConsumesQuota: false,
    });
    expect((await service.listVisibleModels(owner)).find((row) => row.id === 'chat-default')).not.toHaveProperty('blockedToolTypes');
    userProviders.activeMode.mockResolvedValue({
      enabled: true, allowed: true, userCanPickModel: false, userKeyConsumesQuota: false,
    });
    expect((await service.listVisibleModels(owner)).find((row) => row.id === 'chat-default')).toMatchObject({ blockedToolTypes: [] });
  });

  it('自备模式关闭时只公开各工具自己的默认模型', async () => {
    const { service, owner } = fixture();
    const models = await service.listVisibleModels(owner);
    expect(models.map((row) => row.id)).toEqual([
      'chat-default',
      'image-default',
      'mixed-image-default',
    ]);
    expect(models.find((row) => row.id === 'mixed-image-default')?.toolTypes).toEqual(['image']);
  });

  it('自备模式开关两种状态均拒绝非默认系统模型，图片也受约束', async () => {
    const { userProviders, resolveModel } = fixture();
    for (const enabled of [false, true]) {
      userProviders.activeMode.mockResolvedValue({
        enabled,
        allowed: true,
        userCanPickModel: false,
        userKeyConsumesQuota: false,
      });
      await expect(resolveModel('chat-default', AiToolCode.CHAT)).resolves.toMatchObject({
        id: 'chat-default',
      });
      await expect(resolveModel('image-default', AiToolCode.IMAGE)).resolves.toMatchObject({
        id: 'image-default',
      });
      await expect(resolveModel('chat-other', AiToolCode.CHAT)).rejects.toThrow(
        '当前不可改选系统模型',
      );
      await expect(resolveModel('mixed-image-default', AiToolCode.CHAT)).rejects.toThrow(
        '当前不可改选系统模型',
      );
    }
  });

  it('管理员允许改选时可选非默认系统模型', async () => {
    const { userProviders, resolveModel } = fixture();
    userProviders.activeMode.mockResolvedValue({
      enabled: false,
      allowed: true,
      userCanPickModel: true,
      userKeyConsumesQuota: false,
    });
    await expect(resolveModel('chat-other', AiToolCode.CHAT)).resolves.toMatchObject({
      id: 'chat-other',
    });
  });

  it('自备模式按工具返回真实的平台额度要求，混合模型不会误拦文本调用', async () => {
    const { service, owner, userProviders } = fixture();
    userProviders.activeMode.mockResolvedValue({
      enabled: true,
      allowed: true,
      userCanPickModel: true,
      userKeyConsumesQuota: false,
    });
    const models = await service.listVisibleModels(owner);
    expect(models.find((row) => row.id === 'chat-default')).toMatchObject({
      quotaRequiredToolTypes: [],
      requiresPlatformQuota: false,
    });
    expect(models.find((row) => row.id === 'image-default')).toMatchObject({
      quotaRequiredToolTypes: ['image'],
      requiresPlatformQuota: true,
    });
    expect(models.find((row) => row.id === 'mixed-image-default')).toMatchObject({
      quotaRequiredToolTypes: ['image'],
      requiresPlatformQuota: true,
    });
    userProviders.activeMode.mockResolvedValue({
      enabled: true,
      allowed: true,
      userCanPickModel: true,
      userKeyConsumesQuota: true,
    });
    const chargedModels = await service.listVisibleModels(owner);
    expect(
      chargedModels.find((row) => row.id === 'mixed-image-default')?.quotaRequiredToolTypes,
    ).toEqual(['chat', 'image']);
  });

  it('没有同厂商自备 Key 时禁用系统文本能力，保留图片能力', async () => {
    const { service, owner, userProviders, prisma } = fixture();
    userProviders.activeMode.mockResolvedValue({
      enabled: true,
      allowed: true,
      userCanPickModel: true,
      userKeyConsumesQuota: true,
    });
    prisma.aiProviderCredential.findMany.mockResolvedValue([]);
    const models = await service.listVisibleModels(owner);
    expect(models.find((row) => row.id === 'chat-default')).toMatchObject({
      blockedToolTypes: ['chat'],
      defaultToolTypes: [],
      quotaRequiredToolTypes: [],
    });
    expect(models.find((row) => row.id === 'mixed-image-default')).toMatchObject({
      blockedToolTypes: ['chat'],
      defaultToolTypes: ['image'],
      quotaRequiredToolTypes: ['image'],
    });
    expect(models.find((row) => row.id === 'image-default')).toMatchObject({ blockedToolTypes: [] });
  });

  it('会话在系统模型与自建模型之间双向切换时始终只绑定一个模型', async () => {
    const { service, owner, prisma } = fixture();
    const session = {
      id: 'session', title: '对话', modelId: 'chat-default', userModelId: null as string | null,
      systemPrompt: null, contextLimit: 20, enableKnowledgeReference: false,
      messageCount: 0, totalInputTokens: 0, totalOutputTokens: 0, lastMessageAt: null,
    };
    const update = vi.fn(async ({ data }: { data: { modelId?: string | null; userModelId?: string | null } }) => {
      const next = { ...session, ...data };
      if (Boolean(next.modelId) === Boolean(next.userModelId)) throw new Error('ai_conversations_one_model');
      Object.assign(session, next);
      return session;
    });
    Object.assign(prisma, { aiConversation: { findFirst: vi.fn().mockResolvedValue(session), update } });
    Object.assign(service, {
      assertToolAvailable: vi.fn().mockResolvedValue(undefined),
      resolveTextModel: vi.fn(async (id: string) =>
        id === 'custom' ? { id, userModelId: id } : { id },
      ),
    });
    await service.patchSession(owner, session.id, { modelId: 'custom' });
    expect(session).toMatchObject({ modelId: null, userModelId: 'custom' });
    await service.patchSession(owner, session.id, { modelId: 'chat-default' });
    expect(session).toMatchObject({ modelId: 'chat-default', userModelId: null });
    expect(update).toHaveBeenCalledTimes(2);
  });
});
