import { HttpStatus } from '@nestjs/common';
import { FilePurpose } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { DomainHttpException } from '../src/common/errors/domain-http.exception';
import { SystemService } from '../src/modules/system/system.service';

const FOREIGN_FILE_ID = '3f7d05d7-ea41-4565-94d1-05152c7ae64a';

function createService(requireReadyOwnedFile: ReturnType<typeof vi.fn>) {
  const asTransaction = vi.fn();
  const repository = {
    findConfigByGroup: vi.fn().mockResolvedValue({
      group: 'site.general',
      version: 4,
      value: { logoFileId: null, faviconFileId: null },
    }),
    asTransaction,
  };
  const service = new SystemService(repository as never, {} as never, {
    requireReadyOwnedFile,
  } as never);
  return { service, asTransaction };
}

describe('站点 Logo / favicon 文件引用', () => {
  it('引用他人文件时返回 403，并且不写入配置', async () => {
    const requireReadyOwnedFile = vi.fn().mockRejectedValue(
      new DomainHttpException(HttpStatus.FORBIDDEN, 'AUTH_FORBIDDEN', '不能引用他人文件'),
    );
    const { service, asTransaction } = createService(requireReadyOwnedFile);

    await expect(
      service.updateConfigGroup({
        group: 'site.general',
        value: { logoFileId: FOREIGN_FILE_ID },
        expectedVersion: 4,
        actorId: 'owner-1',
        requestId: null,
      }),
    ).rejects.toBeInstanceOf(DomainHttpException);

    expect(requireReadyOwnedFile).toHaveBeenCalledWith(
      'owner-1',
      FOREIGN_FILE_ID,
      FilePurpose.COVER,
    );
    expect(asTransaction).not.toHaveBeenCalled();
  });
});
