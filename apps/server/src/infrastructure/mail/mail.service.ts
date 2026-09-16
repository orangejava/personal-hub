import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Env } from '../../config/env.schema';

export interface VerificationEmailInput {
  to: string;
  verifyUrl: string;
}

export interface PasswordResetEmailInput {
  to: string;
  resetUrl: string;
}

/**
 * 统一封装验证邮件和密码重置邮件。
 *
 * 未配置 SMTP 账号时连接本地 Mailpit；配置 SMTP_USER / SMTP_PASSWORD 后，
 * 使用真实 SMTP 服务（例如 QQ 邮箱授权码）发信。日志只记录连接初始化，
 * 不记录账号密码或授权码。
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  async sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<void> {
    await this.getTransporter().sendMail({
      from: this.config.getOrThrow('MAIL_FROM'),
      to: input.to,
      subject: '重置你的 Personal Hub 密码',
      text: [
        '请在 30 分钟内打开以下链接重置密码：',
        input.resetUrl,
        '',
        '如果不是你本人操作，请忽略本邮件。',
      ].join('\n'),
      html: `<p>请在 30 分钟内打开以下链接重置密码：</p><p><a href="${input.resetUrl}">${input.resetUrl}</a></p><p>如果不是你本人操作，请忽略本邮件。</p>`,
    });
  }

  async sendVerificationEmail(input: VerificationEmailInput): Promise<void> {
    await this.getTransporter().sendMail({
      from: this.config.getOrThrow('MAIL_FROM'),
      to: input.to,
      subject: '验证你的 Personal Hub 邮箱',
      text: [
        '请在 24 小时内打开以下链接完成邮箱验证：',
        input.verifyUrl,
        '',
        '如果不是你本人操作，请忽略本邮件。',
      ].join('\n'),
      html: `<p>请在 24 小时内打开以下链接完成邮箱验证：</p><p><a href="${input.verifyUrl}">${input.verifyUrl}</a></p><p>如果不是你本人操作，请忽略本邮件。</p>`,
    });
  }

  private getTransporter(): Transporter {
    if (this.transporter === null) {
      const user = this.config.get('SMTP_USER');
      const password = this.config.get('SMTP_PASSWORD');
      if ((user === undefined) !== (password === undefined)) {
        throw new Error('SMTP_USER 和 SMTP_PASSWORD 必须同时配置。');
      }

      const auth =
        user === undefined || password === undefined ? undefined : { user, pass: password };
      const secure = this.config.getOrThrow('SMTP_SECURE');
      this.transporter = nodemailer.createTransport({
        host: this.config.getOrThrow('SMTP_HOST'),
        port: this.config.getOrThrow('SMTP_PORT'),
        secure,
        ...(auth === undefined ? {} : { auth, requireTLS: !secure }),
      });
      this.logger.log('SMTP transporter initialized');
    }
    return this.transporter;
  }
}
