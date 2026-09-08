import { Injectable } from '@nestjs/common';
import { ContentStatus, Prisma, type ContentType, type ContentVisibility } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export const contentDetailInclude = {
  author: { select: { id: true, nickname: true, email: true } },
  category: true,
  tags: { include: { tag: true } },
  body: true,
  _count: { select: { favorites: true } },
} satisfies Prisma.ContentInclude;

export type ContentDetailRow = Prisma.ContentGetPayload<{
  include: typeof contentDetailInclude;
}>;

type DbClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class ContentRepository {
  constructor(private readonly prisma: PrismaService) {}

  asTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  findById(id: string, db: DbClient = this.prisma) {
    return db.content.findUnique({ where: { id }, include: contentDetailInclude });
  }

  list(
    where: Prisma.ContentWhereInput,
    skip: number,
    take: number,
    orderBy: Prisma.ContentOrderByWithRelationInput,
  ) {
    return this.prisma.content.findMany({
      where,
      skip,
      take,
      orderBy,
      include: contentDetailInclude,
    });
  }

  count(where: Prisma.ContentWhereInput) {
    return this.prisma.content.count({ where });
  }

  findCategoryBySlug(slug: string, db: DbClient = this.prisma) {
    return db.category.findUnique({ where: { slug } });
  }

  findCategoryById(id: string, db: DbClient = this.prisma) {
    return db.category.findUnique({ where: { id } });
  }

  listCategories() {
    return this.prisma.category.findMany({ orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }] });
  }

  listTags() {
    return this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { contents: true } } },
    });
  }

  async refreshSearchDocument(
    contentId: string,
    title: string | null,
    summary: string | null,
    body: string | null,
    db: DbClient = this.prisma,
  ) {
    const text = `${title ?? ''} ${summary ?? ''} ${(body ?? '').slice(0, 5000)}`;
    await db.$executeRaw`
      UPDATE contents
      SET search_document = to_tsvector('simple', ${text})
      WHERE id = ${contentId}::uuid
    `;
  }

  async createAudit(
    input: {
      action: string;
      actorId: string;
      targetId: string;
      requestId: string | null;
      detail?: Prisma.InputJsonValue;
    },
    db: DbClient = this.prisma,
  ) {
    await db.auditLog.create({
      data: {
        category: 'CONTENT',
        action: input.action,
        actorId: input.actorId,
        targetType: 'CONTENT',
        targetId: input.targetId,
        requestId: input.requestId,
        result: 'SUCCEEDED',
        detail: input.detail,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
  }
}

export type { ContentType, ContentVisibility, ContentStatus };
