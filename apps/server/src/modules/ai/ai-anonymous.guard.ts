import { createHash } from 'node:crypto';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { Env } from '../../config/env.schema';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ensureAnonymousSubject } from './ai-anonymous';

/**
 * 在幂等拦截器之前写入匿名主体。Guard 早于 Interceptor，
 * 否则公开写接口拿不到 request.aiAnonymousId，会 401。
 */
@Injectable()
export class AiAnonymousGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    await ensureAnonymousSubject(
      this.prisma,
      request,
      response,
      this.config.getOrThrow('JWT_REFRESH_SECRET'),
      hashIp(request.ip),
      { secure: this.config.getOrThrow('COOKIE_SECURE') },
    );
    return true;
  }

  /**
   * 只读取已有 Cookie，不新建匿名主体。
   * 目录 GET 不该为了拉模型列表就 mint 身份。
   */
  async peek(request: Request, response: Response): Promise<void> {
    await ensureAnonymousSubject(
      this.prisma,
      request,
      response,
      this.config.getOrThrow('JWT_REFRESH_SECRET'),
      hashIp(request.ip),
      { createIfMissing: false, secure: this.config.getOrThrow('COOKIE_SECURE') },
    );
  }
}

function hashIp(ip: string | undefined): string {
  return createHash('sha256')
    .update(ip ?? 'unknown')
    .digest('hex');
}
