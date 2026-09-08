import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from 'nestjs-pino';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfigModule } from './config/config.module';
import type { Env } from './config/env.schema';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { BookletImportProcessor, OutboxDispatcher } from './infrastructure/queue/outbox.dispatcher';
import { BOOKLET_IMPORT_QUEUE } from './infrastructure/queue/queue.constants';
import { RedisModule } from './infrastructure/redis/redis.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { BookletModule } from './modules/booklet/booklet.module';
import { FileModule } from './modules/file/file.module';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      },
    }),
    PrismaModule,
    RedisModule,
    StorageModule,
    AuthModule,
    FileModule,
    BookletModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        connection: {
          url: config.getOrThrow('REDIS_URL'),
          maxRetriesPerRequest: null,
        },
        prefix: `${config.getOrThrow('REDIS_KEY_PREFIX')}:bull`,
      }),
    }),
    BullModule.registerQueue({ name: BOOKLET_IMPORT_QUEUE }),
  ],
  providers: [OutboxDispatcher, BookletImportProcessor],
})
export class WorkerModule {}
