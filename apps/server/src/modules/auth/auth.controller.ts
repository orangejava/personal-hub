import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentAuth } from '../../common/decorators/current-auth.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { RequestAuthContext } from '../../common/types/request-id';
import type { Env } from '../../config/env.schema';
import {
  REFRESH_COOKIE_NAME,
  clearRefreshCookie,
  setRefreshCookie,
} from '../../infrastructure/http/refresh-cookie';
import { AuthService } from './auth.service';
import type { AuthLoginResult } from './token.types';
import { CaptchaChallengeDto } from './dto/captcha-challenge.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { RevokeAllSessionsDto } from './dto/revoke-all-sessions.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { assertSameOrigin } from './origin';
import { readSignedAnonymousId } from '../ai/ai-anonymous';

/** Cookie 类接口（login/refresh/logout）必须 assertSameOrigin，Access 仍只走 Bearer。 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: '公开注册',
    description: '创建待验证 MEMBER，发送邮箱链接。已存在邮箱也返回 202，避免枚举。',
  })
  @ApiAcceptedResponse({ description: '已接受注册请求。' })
  async register(@Body() body: RegisterDto, @Req() request: Request) {
    return this.authService.register({
      email: body.email,
      password: body.password,
      nickname: body.nickname,
      ip: this.clientIp(request),
      requestId: request.requestId,
    });
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '验证邮箱',
    description: '消费一次性邮件链接 Token，首次成功时写入验证赠额。',
  })
  async verifyEmail(@Body() body: VerifyEmailDto, @Req() request: Request) {
    return this.authService.verifyEmail({
      token: body.token,
      ip: this.clientIp(request),
      requestId: request.requestId,
    });
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: '重发验证邮件',
    description: '仅未验证账号会真正发信；响应始终 202，避免枚举。',
  })
  @ApiAcceptedResponse({ description: '已接受重发请求。' })
  async resendVerification(@Body() body: ResendVerificationDto, @Req() request: Request) {
    return this.authService.resendVerification({
      email: body.email,
      ip: this.clientIp(request),
      requestId: request.requestId,
    });
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: '忘记密码',
    description: '始终 202。仅已激活账号会收到 30 分钟重置链接。',
  })
  @ApiAcceptedResponse({ description: '已接受重置请求。' })
  async forgotPassword(@Body() body: ForgotPasswordDto, @Req() request: Request) {
    return this.authService.forgotPassword({
      email: body.email,
      ip: this.clientIp(request),
      requestId: request.requestId,
    });
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '重置密码',
    description: '消费邮件链接 Token，成功后撤销全部会话。',
  })
  async resetPassword(@Body() body: ResetPasswordDto, @Req() request: Request) {
    return this.authService.resetPassword({
      token: body.token,
      newPassword: body.newPassword,
      ip: this.clientIp(request),
      requestId: request.requestId,
    });
  }

  @Public()
  @Post('captcha-challenges')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '申请登录验证码',
    description: '返回一次性 SVG/算术题；答案只存 Redis 哈希，绑定邮箱与 IP。',
  })
  async createCaptchaChallenge(@Body() body: CaptchaChallengeDto, @Req() request: Request) {
    return this.authService.createCaptchaChallenge({
      email: body.email,
      ip: this.clientIp(request),
    });
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: '邮箱密码登录',
    description: '签发 Access Token，Refresh Token 写入 HttpOnly Cookie。连续失败后需验证码。',
  })
  @ApiOkResponse({ description: '登录成功。' })
  @ApiUnauthorizedResponse({ description: '账号或密码错误。' })
  async login(
    @Body() body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login({
      email: body.email,
      password: body.password,
      challengeId: body.challengeId,
      captchaAnswer: body.captchaAnswer,
      ip: this.clientIp(request),
      userAgent: request.get('user-agent') ?? null,
      requestId: request.requestId,
      anonymousSubjectId: readSignedAnonymousId(
        request,
        this.config.getOrThrow('JWT_REFRESH_SECRET'),
      ),
    });
    this.writeRefreshCookie(response, result.refreshToken);
    return this.toLoginBody(result);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: '刷新登录态',
    description: '读取 Refresh Cookie 并轮换后返回新的 Access Token。',
  })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    this.assertCookieOrigin(request);
    const result = await this.authService.refresh({
      refreshToken: request.cookies?.[REFRESH_COOKIE_NAME] as string | undefined,
      ip: this.clientIp(request),
      requestId: request.requestId,
    });
    this.writeRefreshCookie(response, result.refreshToken);
    return this.toLoginBody(result);
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({
    summary: '退出当前会话',
    description:
      '优先用 Refresh Cookie 识别并撤销当前会话；没有 Cookie 时再用 Access Token。无有效凭证也返回成功并清 Cookie。',
  })
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    this.assertCookieOrigin(request);
    await this.authService.logoutCurrent({
      refreshToken: request.cookies?.[REFRESH_COOKIE_NAME] as string | undefined,
      accessToken: this.readBearerToken(request.headers.authorization),
      ip: this.clientIp(request),
      requestId: request.requestId,
    });
    clearRefreshCookie(response, { secure: this.config.getOrThrow('NODE_ENV') === 'production' });
    return { loggedOut: true };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: '当前登录用户' })
  @ApiForbiddenResponse({ description: '账号不可用。' })
  async me(@CurrentAuth() auth: RequestAuthContext) {
    return this.authService.getCurrentUser(auth.userId);
  }

  @Get('permissions')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '当前权限与菜单',
    description: '返回动作权限、独立数据范围，以及按权限过滤后的菜单树。权限不写入 JWT。',
  })
  async permissions(@CurrentAuth() auth: RequestAuthContext) {
    return this.authService.getPermissionSnapshot(auth.userId, auth.permissionVersion);
  }

  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: '当前账号活跃会话' })
  async listSessions(@CurrentAuth() auth: RequestAuthContext) {
    return this.authService.listSessions(auth.userId, auth.sessionId);
  }

  @Post('sessions/revoke-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '撤销本人会话', description: '默认保留当前会话。' })
  async revokeAllSessions(
    @CurrentAuth() auth: RequestAuthContext,
    @Body() body: RevokeAllSessionsDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const keepCurrent = body.keepCurrent !== false;
    const result = await this.authService.revokeOwnSessions({
      userId: auth.userId,
      currentSessionId: auth.sessionId,
      keepCurrent,
      ip: this.clientIp(request),
      requestId: request.requestId,
    });
    if (!keepCurrent) {
      clearRefreshCookie(response, { secure: this.config.getOrThrow('NODE_ENV') === 'production' });
    }
    return result;
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '撤销指定非当前会话' })
  async revokeSession(
    @CurrentAuth() auth: RequestAuthContext,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Req() request: Request,
  ) {
    await this.authService.revokeOwnSession({
      userId: auth.userId,
      currentSessionId: auth.sessionId,
      targetSessionId: sessionId,
      ip: this.clientIp(request),
      requestId: request.requestId,
    });
    return { revoked: true };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '修改密码',
    description: '校验当前密码后更新；成功后撤销全部会话，需重新登录。',
  })
  async changePassword(
    @CurrentAuth() auth: RequestAuthContext,
    @Body() body: ChangePasswordDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.changePassword({
      userId: auth.userId,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      ip: this.clientIp(request),
      requestId: request.requestId,
    });
    clearRefreshCookie(response, { secure: this.config.getOrThrow('NODE_ENV') === 'production' });
    return result;
  }

  private toLoginBody(result: AuthLoginResult) {
    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    };
  }

  private writeRefreshCookie(response: Response, token: string): void {
    setRefreshCookie(response, token, {
      secure: this.config.getOrThrow('NODE_ENV') === 'production',
    });
  }

  private assertCookieOrigin(request: Request): void {
    const allowed = this.config.getOrThrow('CORS_ORIGIN');
    // 生产同站可把 CORS_ORIGIN 留空：HTTP CORS 本身已关闭，Cookie 只认站点根。
    const origins = allowed.length > 0 ? allowed : [this.config.getOrThrow('PUBLIC_APP_ORIGIN')];
    assertSameOrigin(request.get('origin'), request.get('referer'), origins);
  }

  private readBearerToken(header: string | undefined): string | undefined {
    if (header === undefined || !header.startsWith('Bearer ')) {
      return undefined;
    }
    const token = header.slice('Bearer '.length).trim();
    return token.length > 0 ? token : undefined;
  }

  private clientIp(request: Request): string {
    return request.ip ?? request.socket.remoteAddress ?? '0.0.0.0';
  }
}
