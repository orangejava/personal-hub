import { describe, expect, it, vi } from 'vitest';
import type { Job, Queue } from 'bullmq';
import {
  BookletImportProcessor,
  OutboxDispatcher,
} from '../src/infrastructure/queue/outbox.dispatcher';
import {
  BOOKLET_IMPORT_EVENT,
  BOOKLET_IMPORT_JOB,
  BOOKLET_IMPORT_QUEUE,
} from '../src/infrastructure/queue/queue.constants';
import type { OutboxService } from '../src/infrastructure/queue/outbox.service';
import type { BookletImportService } from '../src/modules/booklet/booklet-import.service';
import type { AiQuotaService } from '../src/modules/ai/ai-quota.service';
import type { AiService } from '../src/modules/ai/ai.service';

describe('OutboxDispatcher', () => {
  it('把 booklet-import outbox 投进 BullMQ 后标记已投递', async () => {
    const { dispatcher, outbox, queue } = dispatcherFor({
      pending: [
        {
          id: 'evt-1',
          eventType: BOOKLET_IMPORT_EVENT,
          payload: { jobId: 'job-1' },
        },
      ],
    });

    await dispatcher.tick();

    expect(queue.add).toHaveBeenCalledWith(
      BOOKLET_IMPORT_JOB,
      { jobId: 'job-1' },
      expect.objectContaining({ jobId: 'job-1', attempts: 3 }),
    );
    expect(outbox.markDispatched).toHaveBeenCalledWith('evt-1');
    expect(outbox.markFailed).not.toHaveBeenCalled();
    expect(BOOKLET_IMPORT_QUEUE).toBe('booklet-import');
  });

  it('队列投递失败时记录 lastError，不把事件标成已投递', async () => {
    const { dispatcher, outbox } = dispatcherFor({
      pending: [
        {
          id: 'evt-fail',
          eventType: BOOKLET_IMPORT_EVENT,
          payload: { jobId: 'job-fail' },
        },
      ],
      addError: new Error('Redis 不可用'),
    });

    await dispatcher.tick();

    expect(outbox.markFailed).toHaveBeenCalledWith('evt-fail', 'Redis 不可用');
    expect(outbox.markDispatched).not.toHaveBeenCalled();
  });

  it('读取 pending 失败时吞掉异常，便于下一轮继续扫', async () => {
    const { dispatcher, outbox, queue } = dispatcherFor({
      listError: new Error('数据库暂时不可用'),
    });

    await expect(dispatcher.tick()).resolves.toBeUndefined();
    expect(queue.add).not.toHaveBeenCalled();
    expect(outbox.markDispatched).not.toHaveBeenCalled();
  });
});

describe('BookletImportProcessor', () => {
  it('按 jobId 调用导入服务，使 worker 消费可重入', async () => {
    const processJob = vi.fn().mockResolvedValue(undefined);
    const processor = new BookletImportProcessor({
      processJob,
    } as unknown as BookletImportService);

    await processor.process({ data: { jobId: 'job-9' } } as Job<{ jobId: string }>);

    expect(processJob).toHaveBeenCalledWith('job-9');
  });
});

function dispatcherFor(input: {
  pending?: Array<{ id: string; eventType: string; payload: { jobId?: string } }>;
  addError?: Error;
  listError?: Error;
}) {
  const outbox = {
    listPending: input.listError
      ? vi.fn().mockRejectedValue(input.listError)
      : vi.fn().mockResolvedValue(input.pending ?? []),
    markDispatched: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
  } as unknown as OutboxService;
  const queue = {
    add: input.addError
      ? vi.fn().mockRejectedValue(input.addError)
      : vi.fn().mockResolvedValue({ id: 'bull-1' }),
  } as unknown as Queue;
  const ai = { recoverStaleGenerationJobs: vi.fn().mockResolvedValue(0) } as unknown as AiService;
  const quota = { expireStale: vi.fn().mockResolvedValue(0) } as unknown as AiQuotaService;
  const dispatcher = new OutboxDispatcher(outbox, queue, queue, queue, ai, quota);
  return { dispatcher, outbox, queue };
}
