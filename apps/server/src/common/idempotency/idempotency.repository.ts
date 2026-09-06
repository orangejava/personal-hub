import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

/**
 * 幂等记录按「主体 + 方法 + 路径哈希 + Key」唯一。
 * TTL 由拦截器写入 expiresAt；此处只负责查找与插入。
 */
@Injectable()
export class IdempotencyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async find(input: {
    subjectType: string;
    subjectIdOrHash: string;
    httpMethod: string;
    pathHash: string;
    idempotencyKey: string;
  }) {
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

  async create(input: {
    subjectType: string;
    subjectIdOrHash: string;
    httpMethod: string;
    pathHash: string;
    idempotencyKey: string;
    requestFingerprint: string;
    responseStatus: number;
    responseBody: Prisma.InputJsonValue;
    expiresAt: Date;
  }) {
    return this.prisma.idempotencyRecord.create({ data: input });
  }
}
