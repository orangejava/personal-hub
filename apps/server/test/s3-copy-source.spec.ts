import { describe, expect, it } from 'vitest';
import { encodeS3CopySource } from '../src/infrastructure/storage/s3-storage.provider';

describe('encodeS3CopySource', () => {
  it('对中文文件名按路径段编码，避免 CopySource 头非法字符', () => {
    expect(
      encodeS3CopySource(
        'personal-hub-dev',
        'temporary/36e4a891-b776-45e8-b0ad-c35484439727/深入浅出_SVG.zip',
      ),
    ).toBe(
      'personal-hub-dev/temporary/36e4a891-b776-45e8-b0ad-c35484439727/%E6%B7%B1%E5%85%A5%E6%B5%85%E5%87%BA_SVG.zip',
    );
  });
});
