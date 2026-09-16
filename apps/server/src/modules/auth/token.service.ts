import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import type { Env } from '../../config/env.schema';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  EMAIL_VERIFICATION_TTL_SECONDS,
  PASSWORD_RESET_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from '../../infrastructure/http/refresh-cookie';
import type { AccessTokenPayload } from './token.types';

/**
 * Access JWT 与一次性邮件/重置 token。Refresh 不在这里签发 Cookie，见 refresh-cookie。
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  signAccessToken(payload: AccessTokenPayload): string {
    return this.jwtService.sign(payload, {
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      algorithm: 'HS256',
    });
  }

  /**
   * 登出 Bearer 兜底用：只验签和 claims，过期或格式不对返回 null，不抛 401。
   */
  verifyAccessToken(token: string): AccessTokenPayload | null {
    try {
      const payload = this.jwtService.verify<AccessTokenPayload>(token, {
        algorithms: ['HS256'],
      });
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.sid !== 'string' ||
        typeof payload.av !== 'number' ||
        typeof payload.pv !== 'number'
      ) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  createRefreshToken(): { token: string; tokenHash: string; expiresAt: Date } {
    return this.createOpaqueToken(REFRESH_TOKEN_TTL_SECONDS);
  }

  /**
   * 邮箱验证链接 Token 与 Refresh Token 一样只存 SHA-256 + pepper，避免库泄漏后可直接点击激活。
   */
  createEmailVerificationToken(): { token: string; tokenHash: string; expiresAt: Date } {
    return this.createOpaqueToken(EMAIL_VERIFICATION_TTL_SECONDS);
  }

  createPasswordResetToken(): { token: string; tokenHash: string; expiresAt: Date } {
    return this.createOpaqueToken(PASSWORD_RESET_TTL_SECONDS);
  }

  hashRefreshToken(token: string): string {
    return this.hashOpaqueToken(token);
  }

  hashEmailVerificationToken(token: string): string {
    return this.hashOpaqueToken(token);
  }

  hashPasswordResetToken(token: string): string {
    return this.hashOpaqueToken(token);
  }

  private createOpaqueToken(ttlSeconds: number): {
    token: string;
    tokenHash: string;
    expiresAt: Date;
  } {
    const token = randomBytes(32).toString('base64url');
    return {
      token,
      tokenHash: this.hashOpaqueToken(token),
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    };
  }

  private hashOpaqueToken(token: string): string {
    const pepper = this.config.getOrThrow('JWT_REFRESH_SECRET');
    return createHash('sha256').update(`${token}${pepper}`).digest('hex');
  }

  hashIdentifier(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  /** 验证码答案熵很低，必须加 pepper，不能只用无盐 SHA-256。 */
  hashCaptchaAnswer(answer: string): string {
    return this.hashOpaqueToken(answer.trim().toLowerCase());
  }
}
