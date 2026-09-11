import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainHttpException } from '../../common/errors/domain-http.exception';
import { RedisService } from '../../infrastructure/redis/redis.service';

/**
 * 跨实例停止：本机 AbortController + Redis 标记。流式循环每次增量都检查 Redis。
 */
@Injectable()
export class AiRuntimeService {
  private readonly controllers = new Map<string, AbortController>();

  constructor(private readonly redis: RedisService) {}

  begin(runId: string): AbortSignal {
    this.abort(runId);
    const controller = new AbortController();
    this.controllers.set(runId, controller);
    return controller.signal;
  }

  private abort(runId: string): void {
    this.controllers.get(runId)?.abort();
    this.controllers.delete(runId);
  }

  async requestStop(runId: string): Promise<void> {
    await this.redis.getClient().set(`ai:stop:${runId}`, '1', 'EX', 300);
    this.controllers.get(runId)?.abort();
  }

  async isStopped(runId: string): Promise<boolean> {
    if (this.controllers.get(runId)?.signal.aborted) {
      return true;
    }
    const flag = await this.redis.get(`ai:stop:${runId}`);
    return flag === '1';
  }

  finish(runId: string): void {
    this.controllers.delete(runId);
  }

  async acquireUserSlot(userId: string, maxConcurrent: number): Promise<void> {
    const key = `ai:semaphore:${userId}`;
    const count = await this.redis.incrWithTtl(key, 120);
    if (count > maxConcurrent) {
      await this.redis.getClient().decr(key);
      throw new DomainHttpException(
        HttpStatus.TOO_MANY_REQUESTS,
        'AI_CONCURRENCY_LIMITED',
        '并发生成已达上限，请等待当前任务结束',
      );
    }
  }

  async releaseUserSlot(userId: string): Promise<void> {
    const key = `ai:semaphore:${userId}`;
    const value = await this.redis.get(key);
    if (value && Number(value) > 0) {
      await this.redis.getClient().decr(key);
    }
  }

  async acquireConversation(conversationId: string): Promise<void> {
    const key = `ai:conversation:${conversationId}`;
    const ok = await this.redis.getClient().set(key, '1', 'EX', 120, 'NX');
    if (ok !== 'OK') {
      throw new DomainHttpException(
        HttpStatus.CONFLICT,
        'AI_GENERATION_IN_PROGRESS',
        '该会话已有生成进行中',
      );
    }
  }

  async releaseConversation(conversationId: string): Promise<void> {
    await this.redis.del(`ai:conversation:${conversationId}`);
  }

  async hitRateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
    const count = await this.redis.incrWithTtl(key, windowSeconds);
    if (count > limit) {
      throw new DomainHttpException(
        HttpStatus.TOO_MANY_REQUESTS,
        'AI_CONCURRENCY_LIMITED',
        '请求过于频繁，请稍后再试',
        [],
        { retryAfterSeconds: windowSeconds },
      );
    }
  }
}
