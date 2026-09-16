import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { PrismaClient, type Prisma } from '@prisma/client';

export const AI_ANON_COOKIE = 'ph_ai_anon';
export const AI_ANON_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * 把匿名主体 ID 签进 HttpOnly Cookie。签名失败则视为无主体，避免伪造 UUID 认领别人的历史。
 */
export function readSignedAnonymousId(request: Request, secret: string): string | null {
  const raw = request.cookies?.[AI_ANON_COOKIE];
  if (typeof raw !== 'string' || !raw.includes('.')) {
    return null;
  }
  const [id, sig] = raw.split('.');
  if (!id || !sig) {
    return null;
  }
  const expected = signAnonymousId(id, secret);
  try {
    if (timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return id;
    }
  } catch {
    return null;
  }
  return null;
}

export function signAnonymousId(id: string, secret: string): string {
  return createHmac('sha256', secret).update(id).digest('hex');
}

export function setAnonymousCookie(
  response: Response,
  id: string,
  secret: string,
  secure: boolean,
): void {
  response.cookie(AI_ANON_COOKIE, `${id}.${signAnonymousId(id, secret)}`, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: AI_ANON_TTL_MS,
  });
}

export async function ensureAnonymousSubject(
  db: Db,
  request: Request,
  response: Response,
  secret: string,
  ipHash: string | null,
  options?: { createIfMissing?: boolean; secure?: boolean },
): Promise<string | null> {
  const existingId = readSignedAnonymousId(request, secret);
  if (existingId) {
    const row = await db.aiAnonymousSubject.findUnique({ where: { id: existingId } });
    if (row && !row.claimedUserId && row.expiresAt > new Date()) {
      request.aiAnonymousId = existingId;
      return existingId;
    }
  }
  if (options?.createIfMissing === false) {
    return null;
  }
  const created = await db.aiAnonymousSubject.create({
    data: {
      expiresAt: new Date(Date.now() + AI_ANON_TTL_MS),
      lastIpHash: ipHash,
    },
  });
  setAnonymousCookie(response, created.id, secret, options?.secure ?? false);
  request.aiAnonymousId = created.id;
  return created.id;
}

/**
 * 登录后认领未过期匿名会话。失败不得抛出让登录失败。
 */
export async function claimAnonymousHistory(
  db: PrismaClient,
  userId: string,
  subjectId: string,
): Promise<void> {
  const subject = await db.aiAnonymousSubject.findUnique({ where: { id: subjectId } });
  if (!subject || subject.claimedUserId || subject.expiresAt <= new Date()) {
    return;
  }
  await db.$transaction(async (tx) => {
    await tx.aiConversation.updateMany({
      where: {
        ownerType: 'ANONYMOUS',
        ownerId: subjectId,
        deletedAt: null,
      },
      data: { ownerType: 'USER', ownerId: userId },
    });
    await tx.aiUsageRecord.updateMany({
      where: { ownerType: 'ANONYMOUS', ownerId: subjectId },
      data: { ownerType: 'USER', ownerId: userId, userId },
    });
    await tx.aiAnonymousSubject.update({
      where: { id: subjectId },
      data: { claimedUserId: userId, claimedAt: new Date() },
    });
  });
}
