import type { AiCredentialPublicKey, AiEncryptedCredential } from '@personal-hub/shared-types';

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

/** 每次保存都使用临时 P-256 密钥与独立 salt/iv，服务端只持有主密钥派生出的静态私钥。 */
export async function encryptCredentialForRequest(
  plaintext: string,
  serverKey: AiCredentialPublicKey,
): Promise<AiEncryptedCredential> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('需要 HTTPS 或 localhost 安全上下文才能保存 API Key');
  }
  const serverPublicKey = await crypto.subtle.importKey(
    'raw',
    fromBase64(serverKey.publicKey).buffer as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const ephemeral = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ]);
  const secret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: serverPublicKey },
    ephemeral.privateKey,
    256,
  );
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const material = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info: new TextEncoder().encode('personal-hub/ai-credential-request/v1'),
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return {
    keyId: serverKey.keyId,
    ephemeralPublicKey: toBase64(
      new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey)),
    ),
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}
