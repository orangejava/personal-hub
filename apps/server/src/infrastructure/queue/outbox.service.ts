import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  enqueue(
    tx: Prisma.TransactionClient,
    input: { aggregateType: string; aggregateId: string; eventType: string; payload: Prisma.InputJsonValue },
  ) {
    return tx.outboxEvent.create({
      data: {
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        payload: input.payload,
      },
    });
  }

  listPending(limit = 20) {
    return this.prisma.outboxEvent.findMany({
      where: { dispatchedAt: null },
      orderBy: { occurredAt: 'asc' },
      take: limit,
    });
  }

  markDispatched(id: string) {
    return this.prisma.outboxEvent.update({
      where: { id },
      data: { dispatchedAt: new Date() },
    });
  }

  markFailed(id: string, message: string) {
    return this.prisma.outboxEvent.update({
      where: { id },
      data: {
        failCount: { increment: 1 },
        lastError: message.slice(0, 500),
      },
    });
  }
}
