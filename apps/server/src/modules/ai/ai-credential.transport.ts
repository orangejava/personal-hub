import { createDecipheriv, createECDH, hkdfSync } from 'node:crypto';
import { HttpStatus } from '@nestjs/common';
import type { AiCredentialPublicKey, AiEncryptedCredential } from '@personal-hub/shared-types';
import { DomainHttpException } from '../../common/errors/domain-http.exception';

const KEY_ID = 'ai-credential-request-v1';
const REQUEST_INFO = Buffer.from('personal-hub/ai-credential-request/v1');
const PRIVATE_INFO = Buffer.from('personal-hub/ai-credential-request/private-v1');

function transportKey(masterKey: Buffer) {
  const ecdh = createECDH('prime256v1');
  ecdh.setPrivateKey(Buffer.from(hkdfSync('sha256', masterKey, Buffer.alloc(0), PRIVATE_INFO, 32)));
  return ecdh;
}

/** 从落库主密钥派生独立的传输私钥，不把主密钥本身用于 ECDH。 */
export function credentialPublicKey(masterKey: Buffer): AiCredentialPublicKey {
  return { keyId: KEY_ID, publicKey: transportKey(masterKey).getPublicKey().toString('base64') };
}

function decodeBase64(value: string, maxLength: number): Buffer {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length > maxLength) {
    throw new Error('invalid base64');
  }
  return Buffer.from(value, 'base64');
}

/** 解密请求信封。所有格式、版本和认证失败统一映射为无密钥细节的 400。 */
export function decryptCredentialRequest(
  payload: AiEncryptedCredential,
  masterKey: Buffer,
): string {
  try {
    if (payload.keyId !== KEY_ID) throw new Error('unknown key');
    const publicKey = decodeBase64(payload.ephemeralPublicKey, 120);
    const salt = decodeBase64(payload.salt, 64);
    const iv = decodeBase64(payload.iv, 24);
    const packed = decodeBase64(payload.ciphertext, 4096);
    if (publicKey.length !== 65 || salt.length !== 32 || iv.length !== 12 || packed.length <= 16) {
      throw new Error('invalid length');
    }
    const secret = transportKey(masterKey).computeSecret(publicKey);
    const key = Buffer.from(hkdfSync('sha256', secret, salt, REQUEST_INFO, 32));
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(packed.subarray(packed.length - 16));
    const plaintext = Buffer.concat([
      decipher.update(packed.subarray(0, packed.length - 16)),
      decipher.final(),
    ])
      .toString('utf8')
      .trim();
    if (!plaintext || plaintext.length > 500) throw new Error('invalid plaintext');
    return plaintext;
  } catch {
    throw new DomainHttpException(
      HttpStatus.BAD_REQUEST,
      'AI_CREDENTIAL_INVALID',
      'API Key 加密数据无效，请重新输入',
    );
  }
}
