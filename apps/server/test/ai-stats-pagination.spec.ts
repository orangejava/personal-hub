import { AiToolCode } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AiService } from '../src/modules/ai/ai.service';

describe('AI 统计分页聚合', () => {
  it('仅有失败任务的日期也出现在趋势中，耗时与汇总一致', async () => {
    const createdAt = new Date();
    const service = Object.assign(Object.create(AiService.prototype), {
      prisma: {
        aiUsageRecord: { findMany: vi.fn().mockResolvedValue([]) },
        aiGenerationJob: { findMany: vi.fn()
          .mockResolvedValueOnce([{ id: 'failed', toolType: AiToolCode.IMAGE, status: 'FAILED',
            createdAt, startedAt: createdAt, finishedAt: new Date(createdAt.getTime() + 1000) }])
          .mockResolvedValueOnce([]) },
      },
    }) as AiService;
    const result = await service.adminStats('24h');
    expect(result.summary).toMatchObject({ failedCalls: 1, averageDurationMs: 1000 });
    expect(result.trends).toEqual([expect.objectContaining({
      calls: 0, tokens: 0, averageDurationMs: 1000,
    })]);
  });

  it('超过单批上限仍统计所有调用，未知估算单独计数', async () => {
    const createdAt = new Date();
    const rows = Array.from({ length: 501 }, (_, index) => ({
      id: `${index}`.padStart(4, '0'),
      createdAt,
      userId: 'user',
      user: { nickname: '用户', email: 'u@example.com' },
      modelId: null,
      userModelId: 'custom',
      model: null,
      userModel: { displayName: '自建模型', credential: { label: '自备厂商' } },
      toolType: AiToolCode.CHAT,
      inputTokens: 2,
      outputTokens: 3,
      platformCost: 0,
      estimatedPlatformCost: null,
      latencyMs: 100,
      jobId: null,
    }));
    const usageFindMany = vi.fn(
      async ({ cursor, take }: { cursor?: { id: string }; take: number }) => {
        const start = cursor ? rows.findIndex((row) => row.id === cursor.id) + 1 : 0;
        return rows.slice(start, start + take);
      },
    );
    const jobFindMany = vi.fn().mockResolvedValue([]);
    const service = Object.assign(Object.create(AiService.prototype), {
      prisma: {
        aiUsageRecord: { findMany: usageFindMany },
        aiGenerationJob: { findMany: jobFindMany },
      },
    }) as AiService;

    const result = await service.adminStats('24h');
    expect(usageFindMany).toHaveBeenCalledTimes(2);
    expect(result.summary).toMatchObject({
      totalCalls: 501,
      totalTokens: 2505,
      unknownEstimates: 501,
      estimatedCost: 0,
      activeUsers: 1,
    });
    expect(result.modelDistributions[0]).toMatchObject({ modelName: '自建模型', calls: 501 });
  });
});
