import type { Response } from 'express';

export const REFRESH_COOKIE_NAME = 'ph_refresh';
export const ACCESS_TOKEN_TTL_SECONDS = 8 * 60 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
export const MEMBER_ACTIVE_SESSION_LIMIT = 5;
export const LOGIN_FAIL_WINDOW_SECONDS = 15 * 60;
export const LOGIN_FAIL_ACCOUNT_IP_LIMIT = 5;
export const LOGIN_FAIL_IP_LIMIT = 20;
export const EMAIL_VERIFICATION_TTL_SECONDS = 24 * 60 * 60;
export const PASSWORD_RESET_TTL_SECONDS = 30 * 60;
export const REGISTER_ATTEMPT_WINDOW_SECONDS = 15 * 60;
export const FORGOT_ATTEMPT_EMAIL_IP_LIMIT = 3;
export const FORGOT_ATTEMPT_IP_LIMIT = 10;
export const REGISTER_ATTEMPT_EMAIL_IP_LIMIT = 5;
export const REGISTER_ATTEMPT_IP_LIMIT = 20;
export const RESEND_ATTEMPT_EMAIL_IP_LIMIT = 3;
export const LOGIN_CAPTCHA_AFTER_FAILURES = 3;
export const CAPTCHA_TTL_SECONDS = 5 * 60;
export const CAPTCHA_CHALLENGE_IP_LIMIT = 20;

/**
 * Refresh Cookie 只由基础设施层写入 Express Response。
 * 不设 Domain，让浏览器按当前访问主机（开发期经 Umi 代理为 localhost:8000）保存。
 */
export function setRefreshCookie(
  response: Response,
  token: string,
  options: { secure: boolean },
): void {
  response.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: options.secure,
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
}

export function clearRefreshCookie(response: Response, options: { secure: boolean }): void {
  response.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: options.secure,
    sameSite: 'lax',
    path: '/',
  });
}
