import { describe, expect, it, vi } from 'vitest';
import { MAX_COS_OBJECT_BYTES } from '../src/modules/file/file-policy';
import { S3StorageProvider } from '../src/infrastructure/storage/s3-storage.provider';

describe('S3StorageProvider', () => {
  it('分片计划非法时，在创建存储端 multipart 会话前拒绝', async () => {
    const provider = Object.create(S3StorageProvider.prototype) as S3StorageProvider;
    const send = vi.fn();
    Object.assign(provider, { client: { send }, bucket: 'test-bucket' });

    await expect(
      provider.createSignedUpload(
        'too-large.zip',
        MAX_COS_OBJECT_BYTES + 1,
        'application/zip',
        900,
      ),
    ).rejects.toThrow('文件大小超出对象存储支持范围');
    expect(send).not.toHaveBeenCalled();
  });
});
