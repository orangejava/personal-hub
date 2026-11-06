import { HttpStatus, Injectable } from '@nestjs/common';
import { AiCredentialOwnerType, Prisma } from '@prisma/client';
import { DomainHttpException } from '../../common/errors/domain-http.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { parseGroupValue, type AiBranding } from '../system/config-registry';
import { AiCredentialService } from './ai-credential.service';
import { parseUserProviderUrl } from './user-provider-fetch';

@Injectable()
export class AiUserProviderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: AiCredentialService,
  ) {}

  async branding(): Promise<AiBranding> {
    const row = await this.prisma.systemConfig.findUnique({ where: { key: 'ai.branding' } });
    return parseGroupValue('ai.branding', row?.value) as AiBranding;
  }

  /** 返回用户可绑定 Key 的系统厂商目录，不受模型可见性和套餐筛选影响。 */
  async systemProviders() {
    return this.prisma.aiProvider.findMany({
      where: { enabled: true, code: { not: 'fake' } },
      orderBy: { label: 'asc' },
      select: { id: true, code: true, label: true, baseUrl: true },
    });
  }

  async state(userId: string) {
    const [branding, preference, credentials, models] = await Promise.all([
      this.branding(),
      this.prisma.aiProviderPreference.findUnique({ where: { userId } }),
      this.prisma.aiProviderCredential.findMany({
        where: { userId, ownerType: AiCredentialOwnerType.USER },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, providerId: true, providerType: true, code: true, label: true,
          baseUrl: true, enabled: true, userModels: {
            select: { id: true, modelKey: true, displayName: true, enabled: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      this.prisma.aiUserModel.findMany({
        where: { userId }, orderBy: { createdAt: 'asc' },
        select: { id: true, credentialId: true, modelKey: true, displayName: true, enabled: true },
      }),
    ]);
    return {
      allowed: branding.userProviderEnabled,
      userCanPickModel: branding.userCanPickModel,
      userKeyConsumesQuota: branding.userKeyConsumesQuota,
      enabled: preference?.enabled ?? false,
      preferredUserModelId: preference?.preferredUserModelId ?? null,
      credentials: credentials.map((row) => ({ ...row, hasKey: true })),
      models,
    };
  }

  async preference(userId: string, input: { enabled: boolean; preferredUserModelId?: string | null }) {
    // 关闭自备模式不能被已停用的旧首选模型阻断；再次开启时仍须校验。
    if (input.enabled && input.preferredUserModelId) {
      const model = await this.prisma.aiUserModel.findFirst({
        where: { id: input.preferredUserModelId, userId, enabled: true },
      });
      if (!model) throw new DomainHttpException(HttpStatus.NOT_FOUND, 'AI_USER_MODEL_NOT_FOUND', '自建模型不存在');
    }
    return this.prisma.aiProviderPreference.upsert({
      where: { userId },
      create: { userId, enabled: input.enabled, preferredUserModelId: input.preferredUserModelId },
      update: { enabled: input.enabled, preferredUserModelId: input.preferredUserModelId },
      select: { enabled: true, preferredUserModelId: true },
    });
  }

  async saveCredential(userId: string, input: {
    id?: string; providerId?: string; code?: string; label?: string;
    baseUrl?: string; apiKey?: string; enabled?: boolean;
  }) {
    const branding = await this.branding();
    if (!branding.userProviderEnabled) {
      throw new DomainHttpException(HttpStatus.FORBIDDEN, 'AI_USER_PROVIDER_DISABLED', '管理员已关闭自备厂商');
    }
    if (!input.id && !input.providerId && (!input.code || !input.label || !input.baseUrl)) {
      throw new DomainHttpException(HttpStatus.BAD_REQUEST, 'AI_USER_PROVIDER_INVALID', '请填写厂商代号、名称和地址');
    }
    if (input.baseUrl) parseUserProviderUrl(input.baseUrl);
    if (input.providerId) {
      const provider = await this.prisma.aiProvider.findFirst({
        where: { id: input.providerId, enabled: true },
      });
      if (!provider || provider.code === 'fake') {
        throw new DomainHttpException(HttpStatus.BAD_REQUEST, 'AI_USER_PROVIDER_INVALID', '请选择可用的真实系统厂商');
      }
      input = { ...input, code: provider.code, label: provider.label };
    }
    try {
      return await this.credentials.saveUserKey(userId, input);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainHttpException(HttpStatus.CONFLICT, 'AI_USER_PROVIDER_DUPLICATE', '厂商代号已存在');
      }
      throw error;
    }
  }

  async deleteCredential(userId: string, id: string) {
    const row = await this.prisma.aiProviderCredential.findFirst({
      where: { id, userId, ownerType: AiCredentialOwnerType.USER }, select: { id: true },
    });
    if (!row) throw new DomainHttpException(HttpStatus.NOT_FOUND, 'AI_CREDENTIAL_NOT_FOUND', '自备厂商不存在');
    await this.prisma.aiProviderCredential.delete({ where: { id } });
    return { deleted: true };
  }

  async saveModel(userId: string, input: {
    id?: string; credentialId: string; modelKey: string; displayName: string; enabled?: boolean;
  }) {
    const credential = await this.prisma.aiProviderCredential.findFirst({
      where: { id: input.credentialId, userId, ownerType: AiCredentialOwnerType.USER, providerId: null },
    });
    if (!credential) throw new DomainHttpException(HttpStatus.NOT_FOUND, 'AI_CREDENTIAL_NOT_FOUND', '自建厂商不存在');
    try {
    if (input.id) {
      const model = await this.prisma.aiUserModel.findFirst({ where: { id: input.id, userId } });
      if (!model) throw new DomainHttpException(HttpStatus.NOT_FOUND, 'AI_USER_MODEL_NOT_FOUND', '自建模型不存在');
      if (model.credentialId !== input.credentialId) {
        throw new DomainHttpException(HttpStatus.BAD_REQUEST, 'AI_USER_MODEL_PROVIDER_IMMUTABLE', '模型所属厂商不可修改');
      }
      return await this.prisma.aiUserModel.update({
        where: { id: model.id },
        data: { modelKey: input.modelKey, displayName: input.displayName, enabled: input.enabled ?? model.enabled },
        select: { id: true, modelKey: true, displayName: true, enabled: true },
      });
    }
    return await this.prisma.aiUserModel.create({
      data: { userId, credentialId: input.credentialId, modelKey: input.modelKey, displayName: input.displayName, enabled: input.enabled ?? true },
      select: { id: true, modelKey: true, displayName: true, enabled: true },
    });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainHttpException(HttpStatus.CONFLICT, 'AI_USER_MODEL_DUPLICATE', '该厂商下模型标识已存在');
      }
      throw error;
    }
  }

  async findUserModel(userId: string, id: string, credentialId?: string) {
    const model = await this.prisma.aiUserModel.findFirst({
      where: { id, userId, enabled: true, ...(credentialId ? { credentialId } : {}) },
      include: { credential: true },
    });
    if (!model || !model.credential?.enabled) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'AI_USER_MODEL_NOT_FOUND', '自建模型不可用');
    }
    return model;
  }

  async credential(userId: string, id: string) {
    const row = await this.prisma.aiProviderCredential.findFirst({
      where: { id, userId, ownerType: AiCredentialOwnerType.USER },
      include: { provider: true },
    });
    if (!row) throw new DomainHttpException(HttpStatus.NOT_FOUND, 'AI_CREDENTIAL_NOT_FOUND', '自备厂商不存在');
    return row;
  }

  async disableModel(userId: string, id: string) {
    const model = await this.prisma.aiUserModel.findFirst({ where: { id, userId } });
    if (!model) throw new DomainHttpException(HttpStatus.NOT_FOUND, 'AI_USER_MODEL_NOT_FOUND', '自建模型不存在');
    await this.prisma.aiUserModel.update({ where: { id }, data: { enabled: false } });
    return { disabled: true };
  }

  async activeMode(userId: string) {
    const [branding, preference] = await Promise.all([
      this.branding(), this.prisma.aiProviderPreference.findUnique({ where: { userId } }),
    ]);
    return {
      enabled: preference?.enabled ?? false,
      allowed: branding.userProviderEnabled,
      preferredUserModelId: preference?.preferredUserModelId ?? null,
      userKeyConsumesQuota: branding.userKeyConsumesQuota,
      userCanPickModel: branding.userCanPickModel,
    };
  }
}
