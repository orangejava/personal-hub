import { describe, expect, it, vi } from 'vitest';
import { AiUserProviderService } from '../src/modules/ai/ai-user-provider.service';
import { AppAiController } from '../src/modules/ai/app-ai.controller';

function fixture() {
  const prisma = {
    systemConfig: { findUnique: vi.fn().mockResolvedValue({ value: { userProviderEnabled: false } }) },
    aiProviderPreference: {
      findUnique: vi.fn().mockResolvedValue({ enabled: true, preferredUserModelId: 'old-model' }),
      upsert: vi.fn().mockResolvedValue({ enabled: false, preferredUserModelId: 'old-model' }),
    },
    aiUserModel: { findFirst: vi.fn().mockResolvedValue(null) },
  };
  return { service: new AiUserProviderService(prisma as never, {} as never), prisma };
}

describe('用户自备模式偏好', () => {
  it('管理员暂停时仍保留用户开启状态，供调用入口拒绝系统 Key 回落', async () => {
    const { service } = fixture();
    expect(await service.activeMode('user')).toMatchObject({ enabled: true, allowed: false });
  });

  it('停用首选模型后可关闭自备模式', async () => {
    const { service, prisma } = fixture();
    await expect(
      service.preference('user', { enabled: false, preferredUserModelId: 'old-model' }),
    ).resolves.toMatchObject({ enabled: false });
    expect(prisma.aiUserModel.findFirst).not.toHaveBeenCalled();
  });

  it('重新开启时仍要求首选模型可用', async () => {
    const { service } = fixture();
    await expect(
      service.preference('user', { enabled: true, preferredUserModelId: 'old-model' }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('自备凭据连接测试', () => {
  it('管理员暂停后在解密和出站前拒绝测试', async () => {
    const credentials = { resolveUserSecret: vi.fn() };
    const userProviders = {
      branding: vi.fn().mockResolvedValue({ userProviderEnabled: false }),
      credential: vi.fn(),
    };
    const controller = new AppAiController({} as never, credentials as never, userProviders as never);
    await expect(
      controller.testCredential({ userId: 'user' } as never, { credentialId: 'credential' }),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'AI_USER_PROVIDER_DISABLED' },
    });
    expect(credentials.resolveUserSecret).not.toHaveBeenCalled();
    expect(userProviders.credential).not.toHaveBeenCalled();
  });
});
