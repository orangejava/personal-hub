import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiCredentialOwnerType, Prisma } from '@prisma/client';
import type { Env } from '../../config/env.schema';
import { DomainHttpException } from '../../common/errors/domain-http.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { AiEncryptedCredential } from '@personal-hub/shared-types';
import { credentialPublicKey, decryptCredentialRequest } from './ai-credential.transport';
import {
  decryptApiKey,
  encryptApiKey,
  parseCredentialEncryptionKey,
  pickSystemSecret,
  type ResolvedProviderSecret,
} from './ai-credential.crypto';

export interface SystemProviderKeySource {
  id: string;
  code: string;
  baseUrl: string | null;
  authEnvKey: string | null;
  timeoutMs: number;
}

/**
 * 系统凭据的加解密与读取。明文只存在于返回值，不写日志。
 */
@Injectable()
export class AiCredentialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  publicKey() {
    return credentialPublicKey(this.requireMasterKey());
  }

  decryptRequest(payload: AiEncryptedCredential): string {
    return decryptCredentialRequest(payload, this.requireMasterKey());
  }

  private requireMasterKey(): Buffer {
    const key = this.masterKey();
    if (!key) {
      throw new DomainHttpException(
        HttpStatus.BAD_REQUEST,
        'AI_CREDENTIAL_KEY_MISSING',
        '未配置 AI_CREDENTIAL_ENCRYPTION_KEY，无法保存密钥',
      );
    }
    return key;
  }

  /**
   * 保存或轮换某个厂商的系统密钥。没配主密钥时拒绝，避免明文落入别的列。
   *
   * @param providerId 厂商 ID
   * @param apiKey 非空明文。调用方负责把留空当成「不修改」
   */
  async upsertSystemKey(
    providerId: string,
    apiKey: string,
    db: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const key = this.masterKey();
    if (!key) {
      throw new DomainHttpException(
        HttpStatus.BAD_REQUEST,
        'AI_CREDENTIAL_KEY_MISSING',
        '未配置 AI_CREDENTIAL_ENCRYPTION_KEY，无法保存密钥',
      );
    }
    const packed = encryptApiKey(apiKey, key);
    // 对齐迁移中的部分唯一索引。冲突在同一条 SQL 内处理，避免 P2002 使外层事务失效。
    await db.$executeRaw`
      INSERT INTO ai_provider_credentials (owner_type, provider_id, ciphertext, nonce, key_version, enabled, updated_at)
      VALUES ('SYSTEM', ${providerId}::uuid, ${packed.ciphertext}, ${packed.nonce}, ${packed.keyVersion}, true, now())
      ON CONFLICT (provider_id) WHERE owner_type = 'SYSTEM' AND provider_id IS NOT NULL
      DO UPDATE SET ciphertext = EXCLUDED.ciphertext, nonce = EXCLUDED.nonce,
        key_version = EXCLUDED.key_version, enabled = true, base_url = NULL, updated_at = now()
    `;
  }

  /**
   * 解析本次系统调用要用的密钥。Fake 厂商不读凭据表。
   *
   * @param provider 厂商目录行
   * @param options.require 为 true 时，缺失项抛给调用方；正式调用和连接测试均要求凭据
   * @returns 密钥与地址；不要求强制且两边都没有时返回 null
   */
  async resolveSystemSecret(
    provider: SystemProviderKeySource,
    options: { require: boolean },
  ): Promise<ResolvedProviderSecret | null> {
    if (provider.code === 'fake') {
      return null;
    }
    const credential = await this.prisma.aiProviderCredential.findFirst({
      where: {
        providerId: provider.id,
        ownerType: AiCredentialOwnerType.SYSTEM,
        enabled: true,
      },
      select: { ciphertext: true, nonce: true, baseUrl: true },
    });
    if (credential) {
      const key = this.masterKey();
      if (!key) {
        throw new DomainHttpException(
          HttpStatus.BAD_REQUEST,
          'AI_CREDENTIAL_KEY_MISSING',
          '未配置 AI_CREDENTIAL_ENCRYPTION_KEY，无法解密已保存的密钥',
        );
      }
      const plaintext = decryptApiKey(credential, key);
      const resolved = pickSystemSecret({
        credentialPlaintext: plaintext,
        credentialBaseUrl: credential.baseUrl,
        envValue: undefined,
        providerBaseUrl: provider.baseUrl,
        timeoutMs: provider.timeoutMs,
      });
      if (!resolved) {
        throw new DomainHttpException(
          HttpStatus.BAD_REQUEST,
          'AI_PROVIDER_KEY_MISSING',
          '已保存密钥，但厂商没有 Base URL',
        );
      }
      return resolved;
    }
    const envValue = readAuthEnv(provider.authEnvKey);
    const envBaseUrl =
      provider.code === 'openai-compatible'
        ? this.config.get('AI_OPENAI_BASE_URL', { infer: true })
        : undefined;
    const resolved = pickSystemSecret({
      credentialPlaintext: null,
      credentialBaseUrl: null,
      envValue,
      // 保留旧部署约定：没有数据库凭据时，环境变量地址优先于目录默认地址。
      providerBaseUrl: envBaseUrl ?? provider.baseUrl,
      timeoutMs: provider.timeoutMs,
    });
    if (resolved || !options.require) {
      return resolved;
    }
    throw new DomainHttpException(
      HttpStatus.BAD_REQUEST,
      'AI_PROVIDER_KEY_MISSING',
      missingKeyMessage(provider.authEnvKey, this.masterKey() !== null),
    );
  }

  private masterKey(): Buffer | null {
    return parseCredentialEncryptionKey(
      this.config.get('AI_CREDENTIAL_ENCRYPTION_KEY', { infer: true }),
    );
  }
}

/**
 * 连接测试在没有任何可用密钥时，要指出缺的是主密钥还是环境变量。
 *
 * @param authEnvKey 厂商配置的环境变量名
 * @param hasMasterKey 进程是否配置了加密主密钥
 */
export function missingKeyMessage(authEnvKey: string | null, hasMasterKey: boolean): string {
  const envLabel = authEnvKey?.trim() ? `环境变量 ${authEnvKey}` : '环境变量回退';
  if (!hasMasterKey) {
    return `未配置 AI_CREDENTIAL_ENCRYPTION_KEY，且${envLabel} 未设置`;
  }
  return `未配置系统凭据，且${envLabel} 未设置`;
}

function readAuthEnv(authEnvKey: string | null): string | undefined {
  const name = authEnvKey?.trim();
  if (!name) {
    return undefined;
  }
  const value = process.env[name]?.trim();
  return value || undefined;
}
