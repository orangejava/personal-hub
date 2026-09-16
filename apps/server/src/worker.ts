import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { WorkerModule } from './worker.module';

/**
 * 独立 worker：Outbox 投递 + BullMQ 消费小册导入。
 * 不要让 HTTP `server` 进程吞掉这些任务。
 *
 * 相关文件：
 * - `worker.module.ts` 组装 Redis / BullMQ / Storage / Booklet
 * - `infrastructure/queue/outbox.dispatcher.ts` 扫 outbox、消费 `booklet-import` 队列
 * - `modules/booklet/booklet-import.service.ts` 真正解压 ZIP、写章节
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const logger = app.get(Logger);
  logger.log('server-worker 已启动，正在消费 booklet-import 队列');
}

void bootstrap();
