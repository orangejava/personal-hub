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
 * 本切片只通过本地 Mailpit SMTP 发信。生产必须改成真实 SMTP 主机，
 * 不能把 MAILPIT_HOST 长期绑到生产环境。
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
      this.transporter = nodemailer.createTransport({
        host: this.config.getOrThrow('MAILPIT_HOST'),
        port: this.config.getOrThrow('MAILPIT_PORT'),
        secure: false,
      });
      this.logger.log('SMTP transporter initialized');
    }
    return this.transporter;
  }
}
