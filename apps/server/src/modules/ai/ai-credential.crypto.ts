import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** 当前凭据格式版本；尚未实现多主密钥选择，轮换主密钥前必须迁移已有凭据。 */
export const AI_CREDENTIAL_KEY_VERSION = 1;

const GCM_TAG_BYTES = 16;

/**
 * 解析环境变量中的凭据主密钥。
 *
 * @param raw base64 字符串；空值表示未配置
 * @returns 32 字节密钥；未配置时返回 null
 */
export function parseCredentialEncryptionKey(raw: string | undefined): Buffer | null {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }
  const key = Buffer.from(trimmed, 'base64');
  if (key.length !== 32) {
    throw new Error('AI_CREDENTIAL_ENCRYPTION_KEY 必须是 32 字节密钥的 base64');
  }
  return key;
}

/**
 * 用 AES-256-GCM 加密 API Key。tag 附在密文末尾，避免再加一列。
 *
 * @param plaintext 厂商 API Key 明文
 * @param key 32 字节主密钥
 * @returns 可落库的密文、nonce 和密钥版本。返回值不含明文
 */
export function encryptApiKey(
  plaintext: string,
  key: Buffer,
): { ciphertext: string; nonce: string; keyVersion: number } {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const packed = Buffer.concat([encrypted, cipher.getAuthTag()]);
  return {
    ciphertext: packed.toString('base64'),
    nonce: nonce.toString('base64'),
    keyVersion: AI_CREDENTIAL_KEY_VERSION,
  };
}

/**
 * 解密凭据行。校验失败会抛错，调用方不得把明文写入日志。
 *
 * @param payload 库里的密文与 nonce
 * @param key 与 keyVersion 对应的主密钥
 * @returns API Key 明文，只允许留在本次调用的内存里
 */
export function decryptApiKey(payload: { ciphertext: string; nonce: string }, key: Buffer): string {
  const packed = Buffer.from(payload.ciphertext, 'base64');
  if (packed.length <= GCM_TAG_BYTES) {
    throw new Error('凭据密文无效');
  }
  const tag = packed.subarray(packed.length - GCM_TAG_BYTES);
  const data = packed.subarray(0, packed.length - GCM_TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(payload.nonce, 'base64'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export interface ResolvedProviderSecret {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
}

/**
 * 系统调用的密钥优先级：已启用凭据优先，否则用环境变量。两边都没有则返回 null。
 *
 * @param input 解密后的凭据明文（没有凭据时为 null）和环境变量值
 * @returns 本次调用要用的密钥与地址；无法调用时返回 null
 */
export function pickSystemSecret(input: {
  credentialPlaintext: string | null;
  credentialBaseUrl: string | null;
  envValue: string | undefined;
  providerBaseUrl: string | null;
  timeoutMs: number;
}): ResolvedProviderSecret | null {
  const apiKey = input.credentialPlaintext?.trim() || input.envValue?.trim() || '';
  if (!apiKey) {
    return null;
  }
  const baseUrl =
    (input.credentialPlaintext ? input.credentialBaseUrl : null) || input.providerBaseUrl;
  if (!baseUrl?.trim()) {
    return null;
  }
  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/$/, ''),
    timeoutMs: Math.min(Math.max(input.timeoutMs, 1), 20_000),
  };
}
