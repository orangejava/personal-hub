import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { AiService } from '../../modules/ai/ai.service';
import { BookletImportService } from '../../modules/booklet/booklet-import.service';
import { OutboxService } from './outbox.service';
import { AiQuotaService } from '../../modules/ai/ai-quota.service';
import {
  AI_IMAGE_GENERATION_EVENT,
  AI_IMAGE_GENERATION_JOB,
  AI_IMAGE_GENERATION_QUEUE,
  AI_VIDEO_GENERATION_EVENT,
  AI_VIDEO_GENERATION_JOB,
  AI_VIDEO_GENERATION_QUEUE,
  BOOKLET_IMPORT_EVENT,
  BOOKLET_IMPORT_JOB,
  BOOKLET_IMPORT_QUEUE,
} from './queue.constants';

@Injectable()
export class OutboxDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxDispatcher.name);
  private timer?: NodeJS.Timeout;
  private quotaTimer?: NodeJS.Timeout;

  constructor(
    private readonly outbox: OutboxService,
    @InjectQueue(BOOKLET_IMPORT_QUEUE) private readonly bookletQueue: Queue,
    @InjectQueue(AI_IMAGE_GENERATION_QUEUE) private readonly imageQueue: Queue,
    @InjectQueue(AI_VIDEO_GENERATION_QUEUE) private readonly videoQueue: Queue,
    private readonly ai: AiService,
    private readonly quota: AiQuotaService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.tick();
    }, 2000);
    this.quotaTimer = setInterval(() => {
      void this.expireStaleReservations();
    }, 30_000);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    if (this.quotaTimer) {
      clearInterval(this.quotaTimer);
    }
  }

  private async expireStaleReservations(): Promise<void> {
    try {
      const [quotaCount, jobCount] = await Promise.all([
        this.quota.expireStale(),
        this.ai.recoverStaleGenerationJobs(),
      ]);
      if (quotaCount > 0 || jobCount > 0) {
        this.logger.warn(`清理过期 AI 额度预占 ${quotaCount} 条，恢复生成任务 ${jobCount} 条`);
      }
    } catch (error) {
      this.logger.warn(`清理过期 AI 额度预占失败: ${error instanceof Error ? error.message : error}`);
    }
  }

  async tick(): Promise<void> {
    let pending;
    try {
      pending = await this.outbox.listPending();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`读取 outbox 失败: ${message}`);
      return;
    }
    for (const event of pending) {
      try {
        const payload = event.payload as { jobId?: string };
        if (event.eventType === BOOKLET_IMPORT_EVENT && payload.jobId) {
          await this.bookletQueue.add(
            BOOKLET_IMPORT_JOB,
            { jobId: payload.jobId },
            jobOptions(payload.jobId),
          );
        }
        if (event.eventType === AI_IMAGE_GENERATION_EVENT && payload.jobId) {
          await this.imageQueue.add(
            AI_IMAGE_GENERATION_JOB,
            { jobId: payload.jobId },
            jobOptions(payload.jobId),
          );
        }
        if (event.eventType === AI_VIDEO_GENERATION_EVENT && payload.jobId) {
          await this.videoQueue.add(
            AI_VIDEO_GENERATION_JOB,
            { jobId: payload.jobId },
            jobOptions(payload.jobId),
          );
        }
        await this.outbox.markDispatched(event.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Outbox 投递失败 ${event.id}: ${message}`);
        await this.outbox.markFailed(event.id, message);
      }
    }
  }
}

function jobOptions(jobId: string) {
  return {
    jobId,
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 2000 },
    removeOnComplete: 50,
    removeOnFail: 100,
  };
}

@Processor(BOOKLET_IMPORT_QUEUE)
export class BookletImportProcessor extends WorkerHost {
  private readonly logger = new Logger(BookletImportProcessor.name);

  constructor(private readonly imports: BookletImportService) {
    super();
  }

  async process(job: Job<{ jobId: string }>): Promise<void> {
    this.logger.log(`处理小册导入 ${job.data.jobId}`);
    await this.imports.processJob(job.data.jobId);
  }
}

@Processor(AI_IMAGE_GENERATION_QUEUE)
export class AiImageProcessor extends WorkerHost {
  constructor(private readonly ai: AiService) {
    super();
  }

  async process(job: Job<{ jobId: string }>): Promise<void> {
    await this.ai.processJob(job.data.jobId);
  }
}

@Processor(AI_VIDEO_GENERATION_QUEUE)
export class AiVideoProcessor extends WorkerHost {
  constructor(private readonly ai: AiService) {
    super();
  }

  async process(job: Job<{ jobId: string }>): Promise<void> {
    await this.ai.processJob(job.data.jobId);
  }
}
