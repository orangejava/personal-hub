import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { MemoryStorageProvider } from './memory-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';
import { STORAGE_PROVIDER } from './storage.types';

/**
 * 测试默认内存实现，避免 Testcontainers HTTP 用例再拉起 MinIO。
 * 本地/生产使用 MinIO 或 COS 的 S3 协议客户端。
 */
@Global()
@Module({
  providers: [
    MemoryStorageProvider,
    S3StorageProvider,
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService, MemoryStorageProvider, S3StorageProvider],
      useFactory: (
        config: ConfigService<Env, true>,
        memory: MemoryStorageProvider,
        s3: S3StorageProvider,
      ) => {
        if (config.getOrThrow('NODE_ENV') === 'test' && process.env.FILE_STORAGE !== 's3') {
          return memory;
        }
        return s3;
      },
    },
  ],
  exports: [STORAGE_PROVIDER, MemoryStorageProvider],
})
export class StorageModule {}
