import { FilePurpose } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { isDeniedMime, resolveFilePolicy, shouldUseMultipart } from '../src/modules/file/file-policy';
import { sniffMimeType } from '../src/modules/file/file-magic';

describe('file-policy', () => {
  it('配置不能越过天花板，也不能放行 denylist MIME', () => {
    const policy = resolveFilePolicy(FilePurpose.COVER, {
      mimeTypes: ['image/png', 'text/html'],
      maxBytes: 80 * 1024 * 1024,
    });
    expect(policy.mimeTypes).toEqual(['image/png']);
    expect(policy.maxBytes).toBe(5 * 1024 * 1024);
    expect(isDeniedMime('text/html')).toBe(true);
  });

  it('超过 20MiB 使用 multipart', () => {
    expect(shouldUseMultipart(20 * 1024 * 1024 + 1)).toBe(true);
    expect(shouldUseMultipart(1024)).toBe(false);
  });
});

describe('file-magic', () => {
  it('核对 PDF / ZIP 魔数，拒绝假扩展名', () => {
    expect(sniffMimeType(Buffer.from('%PDF-1.4\n'), 'application/pdf')).toBe('application/pdf');
    expect(sniffMimeType(Buffer.from('%PDF-1.4\n'), 'image/png')).toBeNull();
    expect(sniffMimeType(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]), 'application/zip')).toBe(
      'application/zip',
    );
  });
});
