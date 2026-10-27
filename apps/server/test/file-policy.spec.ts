import { FilePurpose } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  isDeniedMime,
  MAX_COS_OBJECT_BYTES,
  COS_MAX_PART_BYTES,
  multipartPlan,
  resolveFilePolicy,
  shouldUseMultipart,
} from '../src/modules/file/file-policy';
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

  it('小册 ZIP 大小可由策略任意调高，并采用合法 COS 分片大小', () => {
    expect(
      resolveFilePolicy(FilePurpose.TEMPORARY_IMPORT, { maxBytes: 8_000_000_000 }).maxBytes,
    ).toBe(8_000_000_000);
    expect(multipartPlan(8_000_000_000).partCount).toBeLessThanOrEqual(10_000);
  });

  it('最大对象边界保证分片不超过 5 GB，超过边界拒绝', () => {
    const plan = multipartPlan(MAX_COS_OBJECT_BYTES);
    expect(plan.partCount).toBe(10_000);
    expect(plan.partSize).toBeLessThanOrEqual(COS_MAX_PART_BYTES);
    expect(() => multipartPlan(MAX_COS_OBJECT_BYTES + 1)).toThrow('文件大小超出对象存储支持范围');
    expect(() => multipartPlan(50_000_000_000_000)).toThrow('文件大小超出对象存储支持范围');
  });
});

describe('file-magic', () => {
  it('核对 PDF / ZIP 魔数，拒绝假扩展名', () => {
    expect(sniffMimeType(Buffer.from('%PDF-1.4\n'), 'application/pdf')).toBe('application/pdf');
    expect(sniffMimeType(Buffer.from('%PDF-1.4\n'), 'image/png')).toBeNull();
    expect(sniffMimeType(Buffer.from('GIF89a'), 'image/gif')).toBe('image/gif');
    expect(sniffMimeType(Buffer.from('GIF89a'), 'image/png')).toBeNull();
    expect(
      sniffMimeType(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]), 'application/zip'),
    ).toBe('application/zip');
  });
});
