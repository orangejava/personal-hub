import { describe, expect, it } from 'vitest';
import { encryptCredentialForRequest } from '../../admin-web/src/services/admin/aiCredentialTransport';
import {
  credentialPublicKey,
  decryptCredentialRequest,
} from '../src/modules/ai/ai-credential.transport';

describe('API Key 请求加密协议', () => {
  const masterKey = Buffer.alloc(32, 7);

  it('浏览器密文可由服务端解开，信封不含明文', async () => {
    const plaintext = 'sk-transport-test-only';
    const payload = await encryptCredentialForRequest(plaintext, credentialPublicKey(masterKey));
    expect(JSON.stringify(payload)).not.toContain(plaintext);
    expect(decryptCredentialRequest(payload, masterKey)).toBe(plaintext);
  });

  it('拒绝篡改密文和错误密钥版本', async () => {
    const payload = await encryptCredentialForRequest('sk-valid', credentialPublicKey(masterKey));
    expect(() => decryptCredentialRequest({ ...payload, keyId: 'unknown' }, masterKey)).toThrow();
    expect(() => decryptCredentialRequest({ ...payload, ciphertext: 'AAAA' }, masterKey)).toThrow();
    expect(() => decryptCredentialRequest(payload, Buffer.alloc(32, 8))).toThrow();
  });
});
