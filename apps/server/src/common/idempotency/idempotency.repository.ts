import { Injectable } from '@nestjs/common';
import { IdempotencyRecordState, Prisma, type IdempotencyRecord } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export interface IdempotencyLookup {
  subjectType: string;
  subjectIdOrHash: string;
  httpMethod: string;
  pathHash: string;
  idempotencyKey: string;
}

export type IdempotencyClaim =
  | { kind: 'claimed' }
  | { kind: 'existing'; record: IdempotencyRecord };

/** 超过该时间没有心跳的 PROCESSING 视为进程已死，允许同键重新声明。 */
export const STALE_PROCESSING_MS = 30_000;

/**
 * 幂等记录按「主体 + 方法 + 路径哈希 + Key」唯一。
 * 先写入 PROCESSING 来声明唯一键，避免“先查询、后写入”让并发首请求一起穿透业务层。
 */
@Injectable()
export class IdempotencyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async find(input: IdempotencyLookup) {
    return this.prisma.idempotencyRecord.findUnique({
      where: {
        subjectType_subjectIdOrHash_httpMethod_pathHash_idempotencyKey: {
          subjectType: input.subjectType,
          subjectIdOrHash: input.subjectIdOrHash,
          httpMethod: input.httpMethod,
          pathHash: input.pathHash,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
  }

  /**
   * 原子抢占幂等键。过期记录被条件删除后允许同键开始一次新操作。
   * 返回 existing 时由拦截器根据指纹和状态决定回放、等待或冲突。
   */
  async claim(
    input: IdempotencyLookup & {
      requestFingerprint: string;
      expiresAt: Date;
    },
  ): Promise<IdempotencyClaim> {
    try {
      await this.prisma.idempotencyRecord.create({
        data: {
          ...input,
          state: IdempotencyRecordState.PROCESSING,
        },
      });
      return { kind: 'claimed' };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
    }

    const existing = await this.find(input);
    if (existing === null) {
      // 唯一键冲突记录被并发请求清理后，重新声明即可。
      return this.claim(input);
    }
    if (existing.expiresAt <= new Date()) {
      const deleted = await this.prisma.idempotencyRecord.deleteMany({
        where: {
          ...this.uniqueWhere(input),
          expiresAt: { lte: new Date() },
        },
      });
      if (deleted.count > 0) {
        return this.claim(input);
      }
      // 删除未命中说明另一并发请求已处理该过期行；重新读取它的声明结果。
      return this.claim(input);
    }
    if (existing.state === IdempotencyRecordState.PROCESSING) {
      const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS);
      if (existing.updatedAt <= staleBefore) {
        const deleted = await this.prisma.idempotencyRecord.deleteMany({
          where: {
            ...this.uniqueWhere(input),
            state: IdempotencyRecordState.PROCESSING,
            updatedAt: { lte: staleBefore },
          },
        });
        if (deleted.count > 0) {
          return this.claim(input);
        }
      }
    }
    return { kind: 'existing', record: existing };
  }

  /** 业务仍在执行时刷新心跳，避免长耗时 SHA/导入被当成僵死占位。 */
  async touch(lookup: IdempotencyLookup): Promise<void> {
    await this.prisma.idempotencyRecord.updateMany({
      where: {
        ...this.uniqueWhere(lookup),
        state: IdempotencyRecordState.PROCESSING,
      },
      data: { updatedAt: new Date() },
    });
  }

  async complete(
    lookup: IdempotencyLookup,
    input: {
      requestFingerprint: string;
      responseStatus: number;
      responseBody: Prisma.InputJsonValue;
    },
  ): Promise<void> {
    await this.prisma.idempotencyRecord.updateMany({
      where: {
        ...this.uniqueWhere(lookup),
        state: IdempotencyRecordState.PROCESSING,
        requestFingerprint: input.requestFingerprint,
      },
      data: {
        state: IdempotencyRecordState.COMPLETED,
        responseStatus: input.responseStatus,
        responseBody: input.responseBody,
        completedAt: new Date(),
      },
    });
  }

  /** 业务抛错时释放尚未产生响应的声明，让修正请求可以使用同一个键重试。 */
  async release(lookup: IdempotencyLookup, requestFingerprint: string): Promise<void> {
    await this.prisma.idempotencyRecord.deleteMany({
      where: {
        ...this.uniqueWhere(lookup),
        state: IdempotencyRecordState.PROCESSING,
        requestFingerprint,
      },
    });
  }

  private uniqueWhere(input: IdempotencyLookup) {
    return {
      subjectType: input.subjectType,
      subjectIdOrHash: input.subjectIdOrHash,
      httpMethod: input.httpMethod,
      pathHash: input.pathHash,
      idempotencyKey: input.idempotencyKey,
    };
  }
}
