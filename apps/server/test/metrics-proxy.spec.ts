import { ExpressAdapter, type NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Logger } from 'nestjs-pino';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { configureHttpApp } from '../src/bootstrap';
import { MetricsController } from '../src/modules/metrics/metrics.controller';
import { MetricsService } from '../src/modules/metrics/metrics.service';
import type { Env } from '../src/config/env.schema';
import type { MetricsRedis } from '../src/modules/metrics/metrics.redis';
import type { RedisService } from '../src/infrastructure/redis/redis.service';
import type { MetricsRepository } from '../src/modules/metrics/metrics.repository';
import type { SystemService } from '../src/modules/system/system.service';

function proxyApp() {
  const express = new ExpressAdapter().getInstance();
  const app = {
    useLogger: vi.fn(),
    use: express.use.bind(express),
    set: express.set.bind(express),
    setGlobalPrefix: vi.fn(),
    useGlobalPipes: vi.fn(),
    useGlobalInterceptors: vi.fn(),
    useGlobalFilters: vi.fn(),
    get: () => new Reflector(),
  } as unknown as NestExpressApplication;
  configureHttpApp(
    app,
    new ConfigService({
      NODE_ENV: 'production',
      TRUST_PROXY_CIDRS: '172.30.0.0/24',
    }) as ConfigService<Env, true>,
    {} as Logger,
  );
  return express;
}

function requestFrom(
  app: ReturnType<typeof proxyApp>,
  remoteAddress: string,
  forwarded: string,
): Request {
  return Object.assign(Object.create(app.request), {
    app,
    socket: { remoteAddress },
    headers: { 'x-forwarded-for': forwarded },
  });
}

describe('性能上报代理限流', () => {
  it('不同客户端通过受信代理各有 60 次额度，直连伪造转发头无效', async () => {
    const app = proxyApp();
    const first = requestFrom(app, '172.30.0.2', '198.51.100.1');
    const second = requestFrom(app, '172.30.0.2', '198.51.100.2');
    expect(first.ip).toBe('198.51.100.1');
    expect(second.ip).toBe('198.51.100.2');
    expect(requestFrom(app, '198.51.100.9', '198.51.100.1').ip).toBe('198.51.100.9');
    // 从右向左只经过一层受信代理；客户端追加的左侧伪造 IP 不可信。
    expect(requestFrom(app, '172.30.0.2', '203.0.113.1, 198.51.100.9').ip).toBe('198.51.100.9');
    const counts = new Map<string, number>();
    const counters = {
      incrWithTtl: vi.fn(async (key: string) => {
        const n = (counts.get(key) ?? 0) + 1;
        counts.set(key, n);
        return n;
      }),
    } as unknown as RedisService;
    const service = new MetricsService(
      { increment: vi.fn() } as unknown as MetricsRedis,
      counters,
      {} as MetricsRepository,
      {} as SystemService,
    );
    const controller = new MetricsController(service);
    const payload = { route: '/', samples: [{ metric: 'LCP', value: 100 }] };
    for (let i = 0; i < 60; i += 1) {
      await controller.accept(payload, first);
      await controller.accept(payload, second);
    }
    await expect(controller.accept(payload, first)).rejects.toMatchObject({ status: 429 });
    const nginx = readFileSync(resolve(__dirname, '../../../deploy/nginx/default.conf'), 'utf8');
    expect(nginx).toContain('proxy_set_header X-Forwarded-For $remote_addr;');
  });
});
