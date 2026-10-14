import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { METRICS_KEY_TTL_SECONDS, METRICS_OPEN_SET, parseMinuteKey } from './metrics-histogram';

/**
 * 分钟桶用哈希计数。首次写入起保留 48 小时，容纳 worker 重启和短期数据库故障。
 */
@Injectable()
export class MetricsRedis {
  private readonly logger = new Logger(MetricsRedis.name);
  constructor(private readonly redis: RedisService) {}

  async increment(key: string, field: string): Promise<void> {
    const client = this.redis.getClient();
    const pipeline = client.pipeline();
    pipeline.hincrby(key, field, 1);
    pipeline.expire(key, METRICS_KEY_TTL_SECONDS, 'NX');
    pipeline.sadd(METRICS_OPEN_SET, key);
    const results = await pipeline.exec();
    if (!results) throw new Error('Redis 性能计数批量操作失败');
    for (const [error] of results) if (error) throw error;
  }

  async readOpen(
    since?: Date,
    before?: Date,
  ): Promise<{ key: string; counts: Record<string, number> }[]> {
    const client = this.redis.getClient();
    const keys = await client.smembers(METRICS_OPEN_SET);
    const rows: { key: string; counts: Record<string, number> }[] = [];
    const selected = keys.filter((key) => {
      const parsed = parseMinuteKey(key);
      return parsed && (!since || parsed.at >= since) && (!before || parsed.at < before);
    });
    const stale: string[] = [];
    for (let offset = 0; offset < selected.length; offset += 500) {
      const batch = selected.slice(offset, offset + 500);
      const pipeline = client.pipeline();
      for (const key of batch) pipeline.hgetall(key);
      const results = await pipeline.exec();
      if (!results) throw new Error('Redis 分钟桶批量读取失败');
      for (let index = 0; index < batch.length; index += 1) {
        const [error, value] = results[index] ?? [];
        if (error) throw error;
        const raw = value as Record<string, string>;
        if (Object.keys(raw).length === 0) {
          stale.push(batch[index]);
          continue;
        }
        const counts: Record<string, number> = {};
        for (const [field, text] of Object.entries(raw)) {
          const count = Number(text);
          if (Number.isFinite(count) && count > 0) counts[field] = count;
        }
        rows.push({ key: batch[index], counts });
      }
    }
    if (stale.length) {
      this.logger.warn(`${stale.length} 个性能分钟桶已过期，检查 worker 汇总状态`);
      await client.srem(METRICS_OPEN_SET, ...stale);
    }
    return rows;
  }

  /**
   * 锁携带本进程令牌，释放时只删自己的锁，避免长任务误删后来者的锁。
   * @returns 抢到锁时返回令牌，否则返回 null
   */
  async tryLock(key: string, ttlSeconds: number): Promise<string | null> {
    const token = randomUUID();
    const result = await this.redis.getClient().set(key, token, 'EX', ttlSeconds, 'NX');
    return result === 'OK' ? token : null;
  }

  async releaseLock(key: string, token: string): Promise<void> {
    await this.redis
      .getClient()
      .eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        1,
        key,
        token,
      );
  }

  async drop(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    const client = this.redis.getClient();
    const pipeline = client.pipeline();
    pipeline.del(...keys);
    pipeline.srem(METRICS_OPEN_SET, ...keys);
    const results = await pipeline.exec();
    if (!results) throw new Error('Redis 性能计数批量操作失败');
    for (const [error] of results) if (error) throw error;
  }
}
