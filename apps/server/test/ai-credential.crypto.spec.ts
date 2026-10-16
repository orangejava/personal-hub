import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../src/config/env.schema';
import type { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import {
  decryptApiKey,
  encryptApiKey,
  parseCredentialEncryptionKey,
  pickSystemSecret,
} from '../src/modules/ai/ai-credential.crypto';
import { AiCredentialService, missingKeyMessage } from '../src/modules/ai/ai-credential.service';
import { FakeChatProvider } from '../src/modules/ai/providers/fake-chat.provider';
import { OpenAiCompatibleTextProvider } from '../src/modules/ai/providers/openai-compatible-text.provider';
import type { ChatProviderInput } from '../src/modules/ai/providers/ai-provider.types';

describe('AI 凭据加密', () => {
  const key = Buffer.alloc(32, 7);

  it('数据库凭据直接用于所选厂商，旧 fake 模式不能把真实模型改成演示回答', async () => {
    const packed = encryptApiKey('database-only-secret', key);
    const credentials = new AiCredentialService(
      {
        aiProviderCredential: { findFirst: async () => ({ ...packed, baseUrl: null }) },
      } as unknown as PrismaService,
      {
        get: (name: string) =>
          name === 'AI_CREDENTIAL_ENCRYPTION_KEY'
            ? key.toString('base64')
            : name === 'AI_TEXT_PROVIDER'
              ? 'fake'
              : undefined,
      } as unknown as ConfigService<Env, true>,
    );
    const fake = new FakeChatProvider();
    const fakeSpy = vi.spyOn(fake, 'stream');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          'data: {"choices":[{"delta":{"content":"real response"}}]}\n\ndata: [DONE]\n\n',
        ),
      );
    try {
      const provider = new OpenAiCompatibleTextProvider(
        { get: () => undefined } as unknown as ConfigService<Env, true>,
        credentials,
        fake,
      );
      const output = [];
      for await (const part of provider.stream({
        providerId: 'custom-provider',
        providerCode: 'custom',
        baseUrl: 'https://custom.example/v1',
        authEnvKey: null,
        timeoutMs: 5000,
        modelKey: 'chosen-model',
        maxOutputTokens: 128,
        messages: [],
        signal: new AbortController().signal,
      }))
        output.push(part.content);
      expect(output.join('')).toBe('real response');
      expect(fakeSpy).not.toHaveBeenCalled();
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://custom.example/v1/chat/completions',
        expect.objectContaining({
          headers: expect.objectContaining({ authorization: 'Bearer database-only-secret' }),
          body: expect.stringContaining('"model":"chosen-model"'),
        }),
      );
      expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body)).max_tokens).toBe(128);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('真实厂商缺少凭据时拒绝，Fake 厂商仍可演示且不读凭据', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const config = { get: () => undefined } as unknown as ConfigService<Env, true>;
    const credentials = new AiCredentialService(
      { aiProviderCredential: { findFirst } } as unknown as PrismaService,
      config,
    );
    const fake = new FakeChatProvider();
    const fakeSpy = vi.spyOn(fake, 'stream');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const provider = new OpenAiCompatibleTextProvider(config, credentials, fake);
    const input: ChatProviderInput = {
      providerId: 'custom-id',
      providerCode: 'custom',
      authEnvKey: null,
      baseUrl: 'https://example.com',
      modelKey: 'model',
      messages: [],
      signal: new AbortController().signal,
    };
    const collect = async (value: ChatProviderInput) => {
      const output = [];
      for await (const delta of provider.stream(value)) output.push(delta.content);
      return output.join('');
    };
    try {
      await expect(collect(input)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'AI_PROVIDER_KEY_MISSING' }),
      });
      expect(fakeSpy).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
      findFirst.mockClear();
      expect(await collect({ ...input, providerCode: 'fake' })).toContain('我收到了');
      expect(findFirst).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('密文不含明文，且能解密回来', () => {
    const secret = 'sk-phase-a-secret-should-not-leak';
    const packed = encryptApiKey(secret, key);
    expect(packed.ciphertext.includes(secret)).toBe(false);
    expect(packed.nonce.includes(secret)).toBe(false);
    expect(decryptApiKey(packed, key)).toBe(secret);
  });

  it('未配置主密钥时解析结果为空，长度不对则拒绝', () => {
    expect(parseCredentialEncryptionKey(undefined)).toBeNull();
    expect(parseCredentialEncryptionKey('')).toBeNull();
    expect(() => parseCredentialEncryptionKey(Buffer.alloc(16, 1).toString('base64'))).toThrow(
      /32 字节/,
    );
  });

  it('系统调用优先用凭据，没有凭据才读环境变量', () => {
    const fromCredential = pickSystemSecret({
      credentialPlaintext: 'db-key',
      credentialBaseUrl: null,
      envValue: 'env-key',
      providerBaseUrl: 'https://example.com/v1/',
      timeoutMs: 60000,
    });
    expect(fromCredential).toEqual({
      apiKey: 'db-key',
      baseUrl: 'https://example.com/v1',
      timeoutMs: 20000,
    });
    const fromEnv = pickSystemSecret({
      credentialPlaintext: null,
      credentialBaseUrl: null,
      envValue: 'env-key',
      providerBaseUrl: 'https://example.com/v1',
      timeoutMs: 5000,
    });
    expect(fromEnv?.apiKey).toBe('env-key');
    expect(
      pickSystemSecret({
        credentialPlaintext: null,
        credentialBaseUrl: null,
        envValue: undefined,
        providerBaseUrl: 'https://example.com/v1',
        timeoutMs: 5000,
      }),
    ).toBeNull();
  });

  it('缺失提示同时写明主密钥和环境变量', () => {
    expect(missingKeyMessage('AI_OPENAI_API_KEY', false)).toContain('AI_CREDENTIAL_ENCRYPTION_KEY');
    expect(missingKeyMessage('AI_OPENAI_API_KEY', false)).toContain('AI_OPENAI_API_KEY');
    expect(missingKeyMessage('AI_OPENAI_API_KEY', true)).toContain('未配置系统凭据');
  });

  it('无数据库凭据时，环境变量地址优先于目录默认地址', async () => {
    const previous = process.env.AI_OPENAI_API_KEY;
    process.env.AI_OPENAI_API_KEY = 'sk-env-only';
    try {
      const prisma = {
        aiProviderCredential: { findFirst: async () => null },
      } as unknown as PrismaService;
      const config = {
        get: (name: string) =>
          name === 'AI_OPENAI_BASE_URL' ? 'http://127.0.0.1:4010/v1' : undefined,
      } as unknown as ConfigService<Env, true>;
      const service = new AiCredentialService(prisma, config);
      const secret = await service.resolveSystemSecret(
        {
          id: 'provider-id',
          code: 'openai-compatible',
          baseUrl: 'https://old.example.com/v1',
          authEnvKey: 'AI_OPENAI_API_KEY',
          timeoutMs: 5000,
        },
        { require: true },
      );
      expect(secret).toEqual({
        apiKey: 'sk-env-only',
        baseUrl: 'http://127.0.0.1:4010/v1',
        timeoutMs: 5000,
      });
    } finally {
      if (previous === undefined) delete process.env.AI_OPENAI_API_KEY;
      else process.env.AI_OPENAI_API_KEY = previous;
    }
  });

  it('无数据库凭据时，文本请求发往环境变量地址', async () => {
    const previous = process.env.AI_OPENAI_API_KEY;
    process.env.AI_OPENAI_API_KEY = 'sk-env-only';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('data: {"choices":[{"delta":{"content":"stub ok"}}]}\n\ndata: [DONE]\n\n', {
        status: 200,
      }),
    );
    try {
      const prisma = {
        aiProviderCredential: { findFirst: async () => null },
      } as unknown as PrismaService;
      const config = {
        get: (name: string) => {
          if (name === 'AI_OPENAI_BASE_URL') return 'http://127.0.0.1:4010/v1';
          if (name === 'AI_OPENAI_TIMEOUT_MS') return 5000;
          return undefined;
        },
      } as unknown as ConfigService<Env, true>;
      const credentials = new AiCredentialService(prisma, config);
      const provider = new OpenAiCompatibleTextProvider(
        config,
        credentials,
        new FakeChatProvider(),
      );
      const deltas = [];
      for await (const delta of provider.stream({
        providerId: 'provider-id',
        providerCode: 'openai-compatible',
        baseUrl: 'https://old.example.com/v1',
        authEnvKey: 'AI_OPENAI_API_KEY',
        timeoutMs: 5000,
        modelKey: 'test-model',
        messages: [{ role: 'user', content: 'ping' }],
        signal: new AbortController().signal,
      })) {
        deltas.push(delta);
      }
      expect(deltas).toEqual([{ content: 'stub ok', usage: undefined }]);
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://127.0.0.1:4010/v1/chat/completions',
        expect.objectContaining({
          headers: expect.objectContaining({ authorization: 'Bearer sk-env-only' }),
        }),
      );
    } finally {
      fetchSpy.mockRestore();
      if (previous === undefined) delete process.env.AI_OPENAI_API_KEY;
      else process.env.AI_OPENAI_API_KEY = previous;
    }
  });
});
