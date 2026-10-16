import { EventEmitter } from 'node:events';
import {
  AiMessageRole,
  AiMessageStatus,
  AiOwnerType,
  AiTitleSource,
  type AiMessage,
} from '@prisma/client';
import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { AiService } from '../src/modules/ai/ai.service';
import type { ChatProviderInput } from '../src/modules/ai/providers/ai-provider.types';

/** 在真实 AiService 控制流中替换持久层和厂商，覆盖事务调用、停止与资源释放。 */
function fixture() {
  const owner = { type: AiOwnerType.USER, id: 'owner', userId: 'owner' };
  const session = {
    id: 'session',
    ownerType: owner.type,
    ownerId: owner.id,
    deletedAt: null as Date | null,
    activeMessageId: null as string | null,
    modelId: 'model',
    contextLimit: 20,
    titleSource: AiTitleSource.AUTO,
    messageCount: 0,
  };
  let sequence = 0;
  const messages: AiMessage[] = [];
  const makeMessage = (data: Partial<AiMessage>) =>
    ({
      id: `message-${++sequence}`,
      conversationId: session.id,
      content: '',
      role: AiMessageRole.USER,
      status: AiMessageStatus.DONE,
      createdAt: new Date(Date.UTC(2026, 9, 16, 0, 0, sequence)),
      inputTokens: 0,
      outputTokens: 0,
      isCurrentVariant: true,
      feedback: null,
      feedbackAt: null,
      ...data,
    }) as AiMessage;
  const prisma = {
    aiConversation: {
      findFirst: vi.fn(async () => (session.deletedAt ? null : { ...session })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(session, data);
        return session;
      }),
    },
    aiMessage: {
      create: vi.fn(async ({ data }: { data: Partial<AiMessage> }) => {
        const row = makeMessage(data);
        messages.push(row);
        return row;
      }),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) =>
        messages.find((m) => m.id === where.id)!,
      ),
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: { id?: string; role?: string; isCurrentVariant?: boolean };
        }) => {
          const row = where.id
            ? messages.find(
                (m) =>
                  m.id === where.id &&
                  (where.isCurrentVariant === undefined ||
                    m.isCurrentVariant === where.isCurrentVariant),
              )
            : [...messages].reverse().find((m) => m.role === where.role);
          return row ? { ...row, conversation: session } : null;
        },
      ),
      findMany: vi.fn(async () => [] as AiMessage[]),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<AiMessage> }) => {
          const row = messages.find((m) => m.id === where.id)!;
          Object.assign(row, data);
          return row;
        },
      ),
    },
    aiUsageRecord: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn(async (work: unknown): Promise<unknown> =>
      typeof work === 'function' ? work(prisma) : Promise.all(work as Promise<unknown>[]),
    ),
  };
  let locked = false;
  const controller = new AbortController();
  const runtime = {
    acquireConversation: vi.fn(async () => {
      if (locked) throw new Error('该会话已有生成进行中');
      locked = true;
      return 'lease';
    }),
    releaseConversation: vi.fn(async () => {
      locked = false;
    }),
    renewConversation: vi.fn().mockResolvedValue(undefined),
    acquireUserSlot: vi.fn().mockResolvedValue('user-lease'),
    releaseUserSlot: vi.fn().mockResolvedValue(undefined),
    renewUserSlot: vi.fn().mockResolvedValue(undefined),
    hitRateLimit: vi.fn().mockResolvedValue(undefined),
    begin: vi.fn(() => controller.signal),
    isStopped: vi.fn(async () => controller.signal.aborted),
    requestStop: vi.fn(async () => {
      controller.abort();
    }),
    finish: vi.fn(),
  };
  const quota = {
    reserve: vi.fn().mockResolvedValue({ id: 'reservation' }),
    settle: vi.fn().mockResolvedValue(undefined),
    release: vi.fn().mockResolvedValue(undefined),
    renew: vi.fn().mockResolvedValue(undefined),
  };
  const provider = {
    stream: vi.fn(async function* (input: ChatProviderInput) {
      expect(input.messages.length).toBeGreaterThan(0);
      yield { content: '回答' };
    }),
  };
  const service = new AiService(
    prisma as never,
    quota as never,
    runtime as never,
    {} as never,
    {} as never,
    {} as never,
    provider,
    {} as never,
    {} as never,
    {} as never,
  );
  vi.spyOn(service, 'entitlement').mockResolvedValue({
    maxConcurrent: 3,
    rpm: 30,
    rpd: 300,
  } as never);
  vi.spyOn(
    service as unknown as { assertToolAvailable: () => Promise<void> },
    'assertToolAvailable',
  ).mockResolvedValue();
  vi.spyOn(
    service as unknown as { resolveModel: () => Promise<unknown> },
    'resolveModel',
  ).mockResolvedValue({
    id: 'model',
    modelKey: 'model',
    maxReserveAmount: 10,
    inputPricePer1k: 1,
    outputPricePer1k: 1,
    fixedPlatformCost: null,
  });
  const response = Object.assign(new EventEmitter(), {
    destroyed: false,
    writableEnded: false,
    status: vi.fn(),
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn(),
    end: vi.fn(() => {
      response.writableEnded = true;
    }),
  });
  const send = () =>
    service.streamChat({
      owner,
      sessionId: session.id,
      body: { content: '最新问题' },
      requestId: 'request',
      response: response as unknown as Response,
    });
  return {
    service,
    owner,
    session,
    messages,
    makeMessage,
    prisma,
    runtime,
    quota,
    provider,
    response,
    send,
  };
}

describe('AI Chat 生命周期', () => {
  it('生成中删除被拒绝，原会话仍可停止，终态后才能删除', async () => {
    const f = fixture();
    let entered!: () => void;
    let resume!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const pending = new Promise<void>((resolve) => {
      resume = resolve;
    });
    f.provider.stream.mockImplementation(async function* () {
      entered();
      await pending;
      yield { content: '已生成' };
    });
    const sending = f.send();
    await started;
    await expect(f.service.deleteSession(f.owner, f.session.id)).rejects.toThrow('生成进行中');
    expect(f.session.deletedAt).toBeNull();
    await f.service.stopMessage(f.owner, f.messages.at(-1)!.id);
    resume();
    await sending;
    expect(f.messages.at(-1)?.status).toBe('STOPPED');
    await f.service.deleteSession(f.owner, f.session.id);
    expect(f.session.deletedAt).toBeInstanceOf(Date);
    expect(f.runtime.releaseUserSlot).toHaveBeenCalledWith('owner', 'user-lease');
  });

  it('真实 Provider 停止抛 AbortError 时保留部分文本并结算，发送 stopped 终态', async () => {
    const f = fixture();
    f.provider.stream.mockImplementation(async function* () {
      yield { content: '已生成内容' };
      await f.service.stopMessage(f.owner, f.messages.at(-1)!.id);
      throw new Error('AbortError');
    });
    await f.send();
    expect(f.messages.at(-1)).toMatchObject({
      status: 'STOPPED',
      content: '已生成内容',
      errorCode: null,
    });
    expect(f.quota.settle).toHaveBeenCalled();
    expect(f.quota.release).not.toHaveBeenCalled();
    expect(f.session.activeMessageId).toBeNull();
    expect(f.response.write.mock.calls.some(([text]) => text.includes('"status":"stopped"'))).toBe(
      true,
    );
    expect(f.runtime.releaseConversation).toHaveBeenCalledWith('session', 'lease');
  });

  it('离页关闭 SSE 会停止服务端生成并释放额度和名额', async () => {
    const f = fixture();
    f.provider.stream.mockImplementation(async function* () {
      f.response.destroyed = true;
      f.response.emit('close');
      yield { content: '不应继续写入' };
    });
    await f.send();
    expect(f.runtime.requestStop).toHaveBeenCalled();
    expect(f.quota.release).toHaveBeenCalledWith('reservation', 'request');
    expect(f.runtime.releaseUserSlot).toHaveBeenCalled();
    expect(f.response.listenerCount('close')).toBe(0);
  });

  it('删除在发送取锁前完成时，二次校验阻止向已删会话写消息', async () => {
    const f = fixture();
    f.runtime.acquireConversation.mockImplementationOnce(async () => {
      f.session.deletedAt = new Date();
      return 'lease';
    });
    await expect(f.send()).rejects.toThrow('会话不存在');
    expect(f.prisma.aiMessage.create).not.toHaveBeenCalled();
    expect(f.runtime.releaseConversation).toHaveBeenCalledWith('session', 'lease');
  });

  it('重新生成额度拒绝保留旧回答；成功时只新增回答，不复制问题，保留原排序位置', async () => {
    const f = fixture();
    const user = f.makeMessage({ content: '原问题' });
    const original = f.makeMessage({ role: AiMessageRole.ASSISTANT, content: '原回答' });
    f.messages.push(user, original);
    f.quota.reserve.mockRejectedValueOnce(new Error('额度不足'));
    await expect(
      f.service.regenerate(f.owner, original.id, 'retry', f.response as unknown as Response),
    ).rejects.toThrow('额度不足');
    expect(original.isCurrentVariant).toBe(true);
    expect(f.messages).toHaveLength(2);
    await f.service.regenerate(f.owner, original.id, 'retry2', f.response as unknown as Response);
    expect(f.messages).toHaveLength(3);
    expect(f.messages.filter((m) => m.role === AiMessageRole.USER)).toHaveLength(1);
    expect(original.isCurrentVariant).toBe(false);
    expect(f.messages.at(-1)?.createdAt).toEqual(original.createdAt);
    expect(f.provider.stream.mock.calls[0][0].messages.at(-1)).toEqual({
      role: 'user',
      content: '原问题',
    });
  });

  it('上下文从最新历史取窗口，并始终把本次问题放在最后', async () => {
    const f = fixture();
    const recent = f.makeMessage({ role: AiMessageRole.ASSISTANT, content: '最近回答' });
    f.prisma.aiMessage.findMany.mockResolvedValue([recent]);
    await f.send();
    expect(f.prisma.aiMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 19 }),
    );
    expect(f.provider.stream.mock.calls[0][0].messages).toEqual([
      { role: 'assistant', content: '最近回答' },
      { role: 'user', content: '最新问题' },
    ]);
  });

  it('历史第 101 条不被静默截断，下一页使用同排序的 cursor/skip', async () => {
    const f = fixture();
    f.prisma.aiMessage.findMany.mockResolvedValue(
      Array.from({ length: 101 }, () => f.makeMessage({})),
    );
    const page = await f.service.listMessages(f.owner, f.session.id);
    expect(page.list).toHaveLength(100);
    expect(page.hasMore).toBe(true);
    await f.service.listMessages(f.owner, f.session.id, page.nextCursor!);
    expect(f.prisma.aiMessage.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: { id: page.nextCursor }, skip: 1, take: 101 }),
    );
  });
});
