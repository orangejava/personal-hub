import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { RoleCode, UserStatus } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { GenericContainer } from 'testcontainers';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureHttpApp } from '../src/bootstrap';
import { MailService } from '../src/infrastructure/mail/mail.service';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { REFRESH_COOKIE_NAME } from '../src/infrastructure/http/refresh-cookie';
import { runBaselineSeed } from '../prisma/seed';

vi.mock('svg-captcha', () => ({
  default: {
    createMathExpr: () => ({ text: '7', data: '<svg>7</svg>' }),
  },
}));

const mailRecorder: { messages: Array<{ to: string; verifyUrl?: string; resetUrl?: string }> } = {
  messages: [],
};

const serverDirectory = resolve(__dirname, '..');
const ORIGIN = 'http://localhost:8000';
const PASSWORD = 'OwnerPass!1';

/**
 * 本轮测试登录签发的 Refresh Cookie。afterEach 用同一条 Cookie 调登出，
 * 只撤销这次创建的会话，不清 Redis 里已有的其它键。
 */
const refreshCookiesToRevoke: string[] = [];

interface Envelope<T> {
  data?: T;
  error?: { code: string; message: string };
  requestId: string;
}

describe('Auth HTTP', () => {
  let app: NestExpressApplication;
  let baseUrl: string;
  let prisma: PrismaService;
  let stopPostgres: (() => Promise<unknown>) | undefined;
  let stopRedis: (() => Promise<unknown>) | undefined;

  beforeAll(async () => {
    const postgres = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({
        POSTGRES_DB: 'personal_hub_auth_http_test',
        POSTGRES_USER: 'personal_hub_auth_http_test',
        POSTGRES_PASSWORD: 'personal_hub_auth_http_test_password',
      })
      .withExposedPorts(5432)
      .start();
    stopPostgres = () => postgres.stop();

    const redis = await new GenericContainer('redis:7-alpine')
      .withCommand(['redis-server', '--appendonly', 'no'])
      .withExposedPorts(6379)
      .start();
    stopRedis = () => redis.stop();

    const databaseUrl = `postgresql://personal_hub_auth_http_test:personal_hub_auth_http_test_password@${postgres.getHost()}:${postgres.getMappedPort(5432)}/personal_hub_auth_http_test?schema=public`;
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl,
      REDIS_URL: `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`,
      REDIS_KEY_PREFIX: 'ph:auth-http-test',
      CORS_ORIGIN: ORIGIN,
      JWT_ACCESS_SECRET: 'test-access-secret-that-is-at-least-32-characters',
      JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-at-least-32-characters',
      MINIO_ENDPOINT: 'localhost',
      MINIO_ACCESS_KEY: 'test-access-key',
      MINIO_SECRET_KEY: 'test-secret-key',
      MINIO_BUCKET: 'test-bucket',
    });

    execFileSync(
      process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
      ['exec', 'prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'],
      {
        cwd: serverDirectory,
        env: process.env,
        stdio: 'pipe',
      },
    );

    // ConfigModule.forRoot 在 import 时就会校验；必须先写好 process.env 再加载 AppModule，
    // 否则 ignoreEnvFile 时会读到空环境，或误用 .env.local 打到开发 Redis。
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue({
        sendVerificationEmail: async (input: { to: string; verifyUrl: string }) => {
          mailRecorder.messages.push(input);
        },
        sendPasswordResetEmail: async (input: { to: string; resetUrl: string }) => {
          mailRecorder.messages.push(input);
        },
      })
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureHttpApp(app, app.get(ConfigService), app.get(Logger));
    await app.listen(0);

    const address = app.getHttpServer().address();
    if (address === null || typeof address === 'string') {
      throw new Error('Auth HTTP 测试服务未能监听随机端口');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
    prisma = app.get(PrismaService);
    expect(app.get(ConfigService).get('REDIS_KEY_PREFIX')).toBe('ph:auth-http-test');
    expect(app.get(ConfigService).get('REDIS_URL')).toContain(
      `${redis.getHost()}:${redis.getMappedPort(6379)}`,
    );
    await runBaselineSeed(prisma);

    const passwordHash = await argon2.hash(PASSWORD, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
    const [superAdmin, adminRole, editor, member] = await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { code: RoleCode.SUPER_ADMIN } }),
      prisma.role.findUniqueOrThrow({ where: { code: RoleCode.ADMIN } }),
      prisma.role.findUniqueOrThrow({ where: { code: RoleCode.EDITOR } }),
      prisma.role.findUniqueOrThrow({ where: { code: RoleCode.MEMBER } }),
    ]);
    mailRecorder.messages = [];
    await prisma.user.createMany({
      data: [
        {
          email: 'owner@example.com',
          passwordHash,
          status: UserStatus.ACTIVE,
          roleId: superAdmin.id,
          emailVerifiedAt: new Date(),
          mustChangePassword: true,
          nickname: 'Owner',
        },
        {
          email: 'editor@example.com',
          passwordHash,
          status: UserStatus.ACTIVE,
          roleId: editor.id,
          emailVerifiedAt: new Date(),
          nickname: 'Editor',
        },
        {
          email: 'member@example.com',
          passwordHash,
          status: UserStatus.ACTIVE,
          roleId: member.id,
          emailVerifiedAt: new Date(),
          nickname: 'Member',
        },
        {
          email: 'pending@example.com',
          passwordHash,
          status: UserStatus.PENDING_VERIFICATION,
          roleId: member.id,
        },
        {
          email: 'disabled@example.com',
          passwordHash,
          status: UserStatus.DISABLED,
          roleId: member.id,
          emailVerifiedAt: new Date(),
        },
        {
          email: 'captcha@example.com',
          passwordHash,
          status: UserStatus.ACTIVE,
          roleId: member.id,
          emailVerifiedAt: new Date(),
          nickname: 'Captcha',
        },
        {
          email: 'must-change@example.com',
          passwordHash,
          status: UserStatus.ACTIVE,
          roleId: member.id,
          emailVerifiedAt: new Date(),
          mustChangePassword: true,
          nickname: 'MustChange',
        },
        {
          email: 'root@example.com',
          passwordHash,
          status: UserStatus.ACTIVE,
          roleId: superAdmin.id,
          emailVerifiedAt: new Date(),
          nickname: 'Root',
        },
        {
          email: 'admin@example.com',
          passwordHash,
          status: UserStatus.ACTIVE,
          roleId: adminRole.id,
          emailVerifiedAt: new Date(),
          nickname: 'Admin',
        },
      ],
    });
  }, 120_000);

  afterAll(async () => {
    await revokeTrackedRefreshCookies(baseUrl);
    await app?.close();
    await stopRedis?.();
    await stopPostgres?.();
  }, 30_000);

  beforeEach(() => {
    mailRecorder.messages = [];
  });

  afterEach(async () => {
    await revokeTrackedRefreshCookies(baseUrl);
  });

  it('密码错误时返回统一的 AUTH_INVALID_CREDENTIALS', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ email: 'owner@example.com', password: 'WrongPass!1' }),
    });
    const body = (await response.json()) as Envelope<unknown>;
    expect(response.status).toBe(401);
    expect(body.error?.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('未验证和禁用账号不能登录', async () => {
    const pending = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ email: 'pending@example.com', password: PASSWORD }),
    });
    expect(pending.status).toBe(403);
    expect(((await pending.json()) as Envelope<unknown>).error?.code).toBe(
      'AUTH_EMAIL_NOT_VERIFIED',
    );

    const disabled = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ email: 'disabled@example.com', password: PASSWORD }),
    });
    expect(disabled.status).toBe(403);
    expect(((await disabled.json()) as Envelope<unknown>).error?.code).toBe(
      'AUTH_ACCOUNT_DISABLED',
    );
  });

  it('登录后可读取当前用户，刷新后仍可用，登出后失效', async () => {
    const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ email: 'owner@example.com', password: PASSWORD }),
    });
    const loginBody = (await login.json()) as Envelope<{
      accessToken: string;
      expiresIn: number;
      user: { email: string; role: string; mustChangePassword: boolean };
    }>;
    expect(login.status).toBe(200);
    expect(loginBody.data?.accessToken).toBeTruthy();
    expect(loginBody.data?.expiresIn).toBe(28800);
    expect(loginBody.data?.user.email).toBe('owner@example.com');
    expect(loginBody.data?.user.role).toBe('SUPER_ADMIN');
    expect(loginBody.data?.user.mustChangePassword).toBe(true);

    const cookie = rememberRefreshCookie(login);
    expect(cookie).toBeTruthy();

    const me = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { authorization: `Bearer ${loginBody.data?.accessToken}` },
    });
    const meBody = (await me.json()) as Envelope<{ email: string }>;
    expect(me.status).toBe(200);
    expect(meBody.data?.email).toBe('owner@example.com');

    const refresh = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { origin: ORIGIN, cookie: `${REFRESH_COOKIE_NAME}=${cookie}` },
    });
    const refreshBody = (await refresh.json()) as Envelope<{ accessToken: string }>;
    expect(refresh.status).toBe(200);
    expect(refreshBody.data?.accessToken).toBeTruthy();
    rememberRefreshCookie(refresh);

    const logout = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        origin: ORIGIN,
        authorization: `Bearer ${refreshBody.data?.accessToken}`,
        cookie: `${REFRESH_COOKIE_NAME}=${cookie}`,
      },
    });
    expect(logout.status).toBe(200);

    const meAfterLogout = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { authorization: `Bearer ${refreshBody.data?.accessToken}` },
    });
    expect(meAfterLogout.status).toBe(401);
    expect(((await meAfterLogout.json()) as Envelope<unknown>).error?.code).toBe('AUTH_REQUIRED');
  });

  it('登出优先认 Refresh Cookie，没有 Cookie 时再用 Access Token', async () => {
    const cookieSession = await loginWithCookie(baseUrl, 'member@example.com');
    const cookieLogout = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        origin: ORIGIN,
        cookie: `${REFRESH_COOKIE_NAME}=${cookieSession.cookie}`,
      },
    });
    expect(cookieLogout.status).toBe(200);
    const meAfterCookieLogout = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { authorization: `Bearer ${cookieSession.accessToken}` },
    });
    expect(meAfterCookieLogout.status).toBe(401);

    const bearerSession = await loginWithCookie(baseUrl, 'editor@example.com');
    const bearerLogout = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        origin: ORIGIN,
        authorization: `Bearer ${bearerSession.accessToken}`,
      },
    });
    expect(bearerLogout.status).toBe(200);
    const meAfterBearerLogout = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { authorization: `Bearer ${bearerSession.accessToken}` },
    });
    expect(meAfterBearerLogout.status).toBe(401);

    const emptyLogout = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { origin: ORIGIN },
    });
    expect(emptyLogout.status).toBe(200);

    const missingOrigin = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { cookie: `${REFRESH_COOKIE_NAME}=${cookieSession.cookie}` },
    });
    expect(missingOrigin.status).toBe(403);
    expect(((await missingOrigin.json()) as Envelope<unknown>).error?.code).toBe(
      'AUTH_ORIGIN_FORBIDDEN',
    );
  });

  it('未携带 Token 访问 /auth/me 返回 AUTH_REQUIRED', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/me`);
    const body = (await response.json()) as Envelope<unknown>;
    expect(response.status).toBe(401);
    expect(body.error?.code).toBe('AUTH_REQUIRED');
  });

  it('SUPER_ADMIN 可读取全部动作权限、ALL 范围和后台菜单', async () => {
    const snapshot = await loginAndFetchPermissions(baseUrl, 'owner@example.com');
    expect(snapshot.permissions.some((item) => item.code === 'content:purge')).toBe(true);
    expect(snapshot.permissions.every((item) => item.dataScope === 'ALL')).toBe(true);
    expect(collectRouteKeys(snapshot.menus)).toEqual(
      expect.arrayContaining(['admin.users', 'workspace.contents', 'public.home']),
    );
  });

  it('EDITOR 只有内容 OWN 权限，不能看到后台用户菜单', async () => {
    const snapshot = await loginAndFetchPermissions(baseUrl, 'editor@example.com');
    expect(snapshot.permissions.map((item) => item.code)).toEqual(
      expect.arrayContaining(['content:read', 'content:create', 'booklet:import']),
    );
    expect(snapshot.permissions.every((item) => item.dataScope === 'OWN')).toBe(true);
    expect(snapshot.permissions.some((item) => item.code === 'user:read')).toBe(false);
    const keys = collectRouteKeys(snapshot.menus);
    expect(keys).toEqual(expect.arrayContaining(['workspace.contents', 'workspace.dashboard']));
    expect(keys).not.toContain('admin.users');
    expect(keys).not.toContain('admin.content.list');
  });

  it('MEMBER 没有动作权限，仍能看到个人工作台，不能看到后台', async () => {
    const snapshot = await loginAndFetchPermissions(baseUrl, 'member@example.com');
    expect(snapshot.permissions).toEqual([]);
    const keys = collectRouteKeys(snapshot.menus);
    expect(keys).toEqual(
      expect.arrayContaining(['public.home', 'workspace.dashboard', 'workspace.profile']),
    );
    expect(keys).not.toContain('workspace.contents');
    expect(keys).not.toContain('admin.dashboard');
  });

  it('弱密码注册返回 VALIDATION_FAILED', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ email: 'weak@example.com', password: 'password' }),
    });
    const body = (await response.json()) as Envelope<unknown>;
    expect(response.status).toBe(400);
    expect(body.error?.code).toBe('VALIDATION_FAILED');
  });

  it('注册返回 202 且未验证前不能登录，验证后赠送 10000 额度且不重复发放', async () => {
    const email = 'new-user@example.com';
    const password = 'HubDev!234';
    const register = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ email, password, nickname: '新人' }),
    });
    const registerBody = (await register.json()) as Envelope<{ accepted: boolean }>;
    expect(register.status).toBe(202);
    expect(registerBody.data?.accepted).toBe(true);

    const created = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { role: { select: { code: true } } },
    });
    expect(created.status).toBe(UserStatus.PENDING_VERIFICATION);
    expect(created.role.code).toBe(RoleCode.MEMBER);
    expect(mailRecorder.messages).toHaveLength(1);
    expect(mailRecorder.messages[0]?.to).toBe(email);

    const loginBeforeVerify = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ email, password }),
    });
    expect(loginBeforeVerify.status).toBe(403);
    expect(((await loginBeforeVerify.json()) as Envelope<unknown>).error?.code).toBe(
      'AUTH_EMAIL_NOT_VERIFIED',
    );

    const verifyUrl = mailRecorder.messages[0]?.verifyUrl;
    if (verifyUrl === undefined) {
      throw new Error('注册后应发出验证邮件');
    }
    const token = readVerifyToken(verifyUrl);
    const verify = await fetch(`${baseUrl}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ token }),
    });
    const verifyBody = (await verify.json()) as Envelope<{ verified: boolean }>;
    expect(verify.status).toBe(200);
    expect(verifyBody.data?.verified).toBe(true);

    const activated = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(activated.status).toBe(UserStatus.ACTIVE);
    expect(activated.emailVerifiedAt).toBeTruthy();

    const account = await prisma.aiQuotaAccount.findUniqueOrThrow({
      where: { userId: activated.id },
    });
    expect(account.availableAmount).toBe(10000n);
    const grants = await prisma.aiQuotaTransaction.findMany({
      where: { accountId: account.id },
    });
    expect(grants).toHaveLength(1);
    expect(grants[0]?.idempotencyKey).toBe(`email-verify-grant:${activated.id}`);

    const verifyAgain = await fetch(`${baseUrl}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ token }),
    });
    expect(verifyAgain.status).toBe(200);
    const grantsAfterReplay = await prisma.aiQuotaTransaction.count({
      where: { accountId: account.id },
    });
    expect(grantsAfterReplay).toBe(1);

    await loginWithCookie(baseUrl, email, password);
  });

  it('已存在邮箱注册仍返回 202 且不发信', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ email: 'owner@example.com', password: 'HubDev!234' }),
    });
    expect(response.status).toBe(202);
    expect(mailRecorder.messages).toHaveLength(0);
    expect(await prisma.user.count({ where: { email: 'owner@example.com' } })).toBe(1);
  });

  it('重发验证邮件对未验证账号发信，对未知邮箱仍返回 202', async () => {
    const pendingResend = await fetch(`${baseUrl}/api/v1/auth/resend-verification`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ email: 'pending@example.com' }),
    });
    expect(pendingResend.status).toBe(202);
    expect(mailRecorder.messages).toHaveLength(1);
    expect(mailRecorder.messages[0]?.to).toBe('pending@example.com');

    mailRecorder.messages = [];
    const unknown = await fetch(`${baseUrl}/api/v1/auth/resend-verification`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ email: 'nobody@example.com' }),
    });
    expect(unknown.status).toBe(202);
    expect(mailRecorder.messages).toHaveLength(0);
  });

  it('无效验证 Token 返回 AUTH_VERIFICATION_TOKEN_INVALID', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ token: 'this-token-is-not-valid-at-all' }),
    });
    const body = (await response.json()) as Envelope<unknown>;
    expect(response.status).toBe(400);
    expect(body.error?.code).toBe('AUTH_VERIFICATION_TOKEN_INVALID');
  });

  it('连续 3 次登录失败后必须提交验证码', async () => {
    const headers = { 'content-type': 'application/json', origin: ORIGIN };
    for (let i = 0; i < 3; i += 1) {
      const failed = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: 'captcha@example.com', password: 'WrongPass!1' }),
      });
      expect(failed.status).toBe(401);
    }

    const missing = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: 'captcha@example.com', password: PASSWORD }),
    });
    expect(missing.status).toBe(403);
    expect(((await missing.json()) as Envelope<unknown>).error?.code).toBe('AUTH_CAPTCHA_REQUIRED');

    const challenge = await fetch(`${baseUrl}/api/v1/auth/captcha-challenges`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: 'captcha@example.com' }),
    });
    const challengeBody = (await challenge.json()) as Envelope<{
      challengeId: string;
      imageSvg: string;
      expiresIn: number;
    }>;
    expect(challenge.status).toBe(200);
    expect(challengeBody.data?.imageSvg).toContain('<svg');
    expect(challengeBody.data?.expiresIn).toBe(300);

    const wrongCaptcha = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: 'captcha@example.com',
        password: PASSWORD,
        challengeId: challengeBody.data?.challengeId,
        captchaAnswer: '99',
      }),
    });
    expect(wrongCaptcha.status).toBe(403);
    expect(((await wrongCaptcha.json()) as Envelope<unknown>).error?.code).toBe(
      'AUTH_CAPTCHA_REQUIRED',
    );

    const nextChallenge = await fetch(`${baseUrl}/api/v1/auth/captcha-challenges`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: 'captcha@example.com' }),
    });
    const nextBody = (await nextChallenge.json()) as Envelope<{ challengeId: string }>;
    const success = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { ...headers, 'user-agent': 'Mozilla/5.0 (Macintosh) Chrome/120.0.0.0' },
      body: JSON.stringify({
        email: 'captcha@example.com',
        password: PASSWORD,
        challengeId: nextBody.data?.challengeId,
        captchaAnswer: '7',
      }),
    });
    expect(success.status).toBe(200);
    rememberRefreshCookie(success);
  });

  it('刷新验证码后旧 challengeId 立即失效', async () => {
    const headers = { 'content-type': 'application/json', origin: ORIGIN };
    for (let i = 0; i < 3; i += 1) {
      await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: 'captcha@example.com', password: 'WrongPass!1' }),
      });
    }

    const first = await fetch(`${baseUrl}/api/v1/auth/captcha-challenges`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: 'captcha@example.com' }),
    });
    const firstBody = (await first.json()) as Envelope<{ challengeId: string }>;
    await fetch(`${baseUrl}/api/v1/auth/captcha-challenges`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: 'captcha@example.com' }),
    });
    const stale = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: 'captcha@example.com',
        password: PASSWORD,
        challengeId: firstBody.data?.challengeId,
        captchaAnswer: '7',
      }),
    });
    expect(stale.status).toBe(403);
    expect(((await stale.json()) as Envelope<unknown>).error?.code).toBe('AUTH_CAPTCHA_REQUIRED');
  });

  it('可列出并撤销其它设备会话', async () => {
    const first = await loginWithCookie(baseUrl, 'editor@example.com');
    const second = await loginWithCookie(baseUrl, 'editor@example.com');

    const list = await fetch(`${baseUrl}/api/v1/auth/sessions`, {
      headers: { authorization: `Bearer ${second.accessToken}` },
    });
    const listBody = (await list.json()) as Envelope<
      Array<{ id: string; isCurrent: boolean; deviceName: string; ipMasked: string | null }>
    >;
    expect(list.status).toBe(200);
    expect(listBody.data?.length).toBeGreaterThanOrEqual(2);
    expect(listBody.data?.some((item) => item.isCurrent)).toBe(true);
    expect(JSON.stringify(listBody.data)).not.toMatch(/Mozilla\/5\.0/);

    const other = listBody.data?.find((item) => !item.isCurrent);
    expect(other).toBeTruthy();
    const revoked = await fetch(`${baseUrl}/api/v1/auth/sessions/${other?.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${second.accessToken}` },
    });
    expect(revoked.status).toBe(200);

    const meOnFirst = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { authorization: `Bearer ${first.accessToken}` },
    });
    expect(meOnFirst.status).toBe(401);

    const revokeAll = await fetch(`${baseUrl}/api/v1/auth/sessions/revoke-all`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${second.accessToken}`,
      },
      body: JSON.stringify({ keepCurrent: true }),
    });
    expect(revokeAll.status).toBe(200);
  });

  it('临时密码账号必须先改密，改密后旧会话失效', async () => {
    const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ email: 'must-change@example.com', password: PASSWORD }),
    });
    const loginBody = (await login.json()) as Envelope<{
      accessToken: string;
      user: { mustChangePassword: boolean };
    }>;
    expect(login.status).toBe(200);
    expect(loginBody.data?.user.mustChangePassword).toBe(true);
    rememberRefreshCookie(login);

    const blocked = await fetch(`${baseUrl}/api/v1/auth/sessions`, {
      headers: { authorization: `Bearer ${loginBody.data?.accessToken}` },
    });
    expect(blocked.status).toBe(403);
    expect(((await blocked.json()) as Envelope<unknown>).error?.code).toBe(
      'AUTH_PASSWORD_CHANGE_REQUIRED',
    );

    const changed = await fetch(`${baseUrl}/api/v1/auth/change-password`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${loginBody.data?.accessToken}`,
      },
      body: JSON.stringify({ currentPassword: PASSWORD, newPassword: 'HubDev!234' }),
    });
    expect(changed.status).toBe(200);

    const meAfter = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { authorization: `Bearer ${loginBody.data?.accessToken}` },
    });
    expect(meAfter.status).toBe(401);

    const relogin = await loginWithCookie(baseUrl, 'must-change@example.com', 'HubDev!234');
    const me = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { authorization: `Bearer ${relogin.accessToken}` },
    });
    const meBody = (await me.json()) as Envelope<{ mustChangePassword: boolean }>;
    expect(me.status).toBe(200);
    expect(meBody.data?.mustChangePassword).toBe(false);
  });

  it('忘记密码对未知邮箱也返回 202 且不发信', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/forgot-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ email: 'nobody@example.com' }),
    });
    expect(response.status).toBe(202);
    expect(mailRecorder.messages).toHaveLength(0);
  });

  it('可通过邮件链接重置密码并作废旧会话', async () => {
    const session = await loginWithCookie(baseUrl, 'editor@example.com');
    const forgot = await fetch(`${baseUrl}/api/v1/auth/forgot-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ email: 'editor@example.com' }),
    });
    expect(forgot.status).toBe(202);
    const resetUrl = mailRecorder.messages.at(-1)?.resetUrl;
    expect(resetUrl).toContain('/user/reset-password?token=');
    const token = new URL(resetUrl ?? '', ORIGIN).searchParams.get('token');
    expect(token).toBeTruthy();

    const reset = await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ token, newPassword: 'ResetPass!2' }),
    });
    expect(reset.status).toBe(200);

    const oldSession = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    expect(oldSession.status).toBe(401);

    await loginWithCookie(baseUrl, 'editor@example.com', 'ResetPass!2');
  });

  it('后台用户列表需要 user:read，管理员可踢普通用户但不能踢自己或 super_admin', async () => {
    const member = await loginWithCookie(baseUrl, 'member@example.com');
    const forbidden = await fetch(`${baseUrl}/api/v1/admin/users`, {
      headers: { authorization: `Bearer ${member.accessToken}` },
    });
    expect(forbidden.status).toBe(403);

    const admin = await loginWithCookie(baseUrl, 'admin@example.com');
    const list = await fetch(`${baseUrl}/api/v1/admin/users?pageSize=50`, {
      headers: { authorization: `Bearer ${admin.accessToken}` },
    });
    const listBody = (await list.json()) as Envelope<{
      list: Array<{ id: string; email: string; role: string }>;
    }>;
    expect(list.status).toBe(200);
    const rootUser = listBody.data?.list.find((item) => item.email === 'root@example.com');
    const memberUser = listBody.data?.list.find((item) => item.email === 'member@example.com');
    const adminUser = listBody.data?.list.find((item) => item.email === 'admin@example.com');
    expect(rootUser && memberUser && adminUser).toBeTruthy();

    const kickRoot = await fetch(
      `${baseUrl}/api/v1/admin/users/${rootUser?.id}/sessions/revoke-all`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${admin.accessToken}` },
      },
    );
    expect(kickRoot.status).toBe(403);

    const kickSelf = await fetch(
      `${baseUrl}/api/v1/admin/users/${adminUser?.id}/sessions/revoke-all`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${admin.accessToken}` },
      },
    );
    expect(kickSelf.status).toBe(400);

    const root = await loginWithCookie(baseUrl, 'root@example.com');
    const kickMember = await fetch(
      `${baseUrl}/api/v1/admin/users/${memberUser?.id}/sessions/revoke-all`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${root.accessToken}` },
      },
    );
    expect(kickMember.status).toBe(200);
    const memberAfter = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { authorization: `Bearer ${member.accessToken}` },
    });
    expect(memberAfter.status).toBe(401);
  });

  it('后台角色列表走 Nest；不能改 SUPER_ADMIN；写接口要幂等键', async () => {
    const member = await loginWithCookie(baseUrl, 'member@example.com');
    const forbidden = await fetch(`${baseUrl}/api/v1/admin/roles`, {
      headers: { authorization: `Bearer ${member.accessToken}` },
    });
    expect(forbidden.status).toBe(403);

    const admin = await loginWithCookie(baseUrl, 'admin@example.com');
    const roles = await fetch(`${baseUrl}/api/v1/admin/roles`, {
      headers: { authorization: `Bearer ${admin.accessToken}` },
    });
    const rolesBody = (await roles.json()) as Envelope<
      Array<{ code: string; isProtected: boolean; version: number; permissions: string[] }>
    >;
    expect(roles.status).toBe(200);
    expect(rolesBody.data?.map((item) => item.code).sort()).toEqual(
      ['ADMIN', 'EDITOR', 'MEMBER', 'SUPER_ADMIN'].sort(),
    );
    expect(rolesBody.data?.find((item) => item.code === 'SUPER_ADMIN')?.isProtected).toBe(true);
    const memberRole = rolesBody.data?.find((item) => item.code === 'MEMBER');
    const superAdminRole = rolesBody.data?.find((item) => item.code === 'SUPER_ADMIN');
    expect(memberRole?.version).toBeTruthy();
    expect(superAdminRole?.version).toBeTruthy();

    const catalog = await fetch(`${baseUrl}/api/v1/admin/permissions`, {
      headers: { authorization: `Bearer ${admin.accessToken}` },
    });
    const catalogBody = (await catalog.json()) as Envelope<Array<{ code: string }>>;
    expect(catalog.status).toBe(200);
    expect((catalogBody.data?.length ?? 0) > 0).toBe(true);

    const missingKey = await fetch(`${baseUrl}/api/v1/admin/roles/MEMBER/permissions`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${admin.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ permissions: ['content:read'] }),
    });
    expect(missingKey.status).toBe(400);

    const missingVersion = await fetch(`${baseUrl}/api/v1/admin/roles/MEMBER/permissions`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${admin.accessToken}`,
        'content-type': 'application/json',
        'Idempotency-Key': 'role-member-missing-version',
      },
      body: JSON.stringify({ permissions: ['content:read'] }),
    });
    expect(missingVersion.status).toBe(400);

    const protect = await fetch(`${baseUrl}/api/v1/admin/roles/SUPER_ADMIN/permissions`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${admin.accessToken}`,
        'content-type': 'application/json',
        'Idempotency-Key': 'role-super-admin-blocked',
      },
      body: JSON.stringify({ permissions: ['content:read'], version: superAdminRole?.version }),
    });
    expect(protect.status).toBe(403);

    const updated = await fetch(`${baseUrl}/api/v1/admin/roles/MEMBER/permissions`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${admin.accessToken}`,
        'content-type': 'application/json',
        'Idempotency-Key': 'role-member-content-read',
      },
      body: JSON.stringify({ permissions: ['content:read'], version: memberRole?.version }),
    });
    const updatedBody = (await updated.json()) as Envelope<{ permissions: string[]; version: number }>;
    expect(updated.status).toBe(200);
    expect(updatedBody.data?.permissions).toEqual(['content:read']);
    expect(updatedBody.data?.version).toBe((memberRole?.version ?? 0) + 1);

    const staleMember = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { authorization: `Bearer ${member.accessToken}` },
    });
    expect(staleMember.status).toBe(401);

    const stale = await fetch(`${baseUrl}/api/v1/admin/roles/MEMBER/permissions`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${admin.accessToken}`,
        'content-type': 'application/json',
        'Idempotency-Key': 'role-member-stale-version',
      },
      body: JSON.stringify({ permissions: [], version: memberRole?.version }),
    });
    expect(stale.status).toBe(409);
    expect(((await stale.json()) as Envelope<unknown>).error?.code).toBe('ROLE_VERSION_CONFLICT');

    const restored = await fetch(`${baseUrl}/api/v1/admin/roles/MEMBER/permissions`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${admin.accessToken}`,
        'content-type': 'application/json',
        'Idempotency-Key': 'role-member-restore-empty',
      },
      body: JSON.stringify({ permissions: [], version: updatedBody.data?.version }),
    });
    expect(restored.status).toBe(200);
  });
});

interface PermissionMenuNode {
  routeKey: string | null;
  children: PermissionMenuNode[];
}

async function loginWithCookie(baseUrl: string, email: string, password = PASSWORD) {
  const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify({ email, password }),
  });
  const loginBody = (await login.json()) as Envelope<{ accessToken: string }>;
  expect(login.status).toBe(200);
  const cookie = rememberRefreshCookie(login);
  expect(cookie).toBeTruthy();
  return { accessToken: loginBody.data!.accessToken, cookie: cookie! };
}

async function loginAndFetchPermissions(baseUrl: string, email: string) {
  const { accessToken } = await loginWithCookie(baseUrl, email);

  const response = await fetch(`${baseUrl}/api/v1/auth/permissions`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const body = (await response.json()) as Envelope<{
    permissions: Array<{ code: string; dataScope: string }>;
    menus: PermissionMenuNode[];
  }>;
  expect(response.status).toBe(200);
  expect(body.data).toBeTruthy();
  return body.data!;
}

function collectRouteKeys(menus: PermissionMenuNode[]): string[] {
  return menus.flatMap((menu) => [
    ...(menu.routeKey === null ? [] : [menu.routeKey]),
    ...collectRouteKeys(menu.children ?? []),
  ]);
}

function rememberRefreshCookie(response: Response): string | null {
  const raw =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie().join(',')
      : (response.headers.get('set-cookie') ?? '');
  const cookie = readRefreshCookie(raw || null);
  if (cookie !== null) {
    refreshCookiesToRevoke.push(cookie);
  }
  return cookie;
}

/**
 * 用登录时记下的 Cookie 调登出。登出已幂等，用例自己先退出也不会失败。
 */
async function revokeTrackedRefreshCookies(baseUrl: string | undefined): Promise<void> {
  if (baseUrl === undefined || refreshCookiesToRevoke.length === 0) {
    return;
  }
  const cookies = refreshCookiesToRevoke.splice(0);
  await Promise.all(
    cookies.map((cookie) =>
      fetch(`${baseUrl}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { origin: ORIGIN, cookie: `${REFRESH_COOKIE_NAME}=${cookie}` },
      }),
    ),
  );
}

function readRefreshCookie(setCookie: string | null): string | null {
  if (setCookie === null) {
    return null;
  }
  const match = new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`).exec(setCookie);
  return match?.[1] ?? null;
}

function readVerifyToken(verifyUrl: string): string {
  const token = new URL(verifyUrl).searchParams.get('token');
  if (token === null || token.length === 0) {
    throw new Error(`验证邮件缺少 token：${verifyUrl}`);
  }
  return token;
}
