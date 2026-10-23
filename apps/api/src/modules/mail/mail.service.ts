import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { MAIL_TRANSPORT, type MailTransport } from './mail.transport';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
    private readonly config: AppConfig,
  ) {}

  link(path: string, token: string): string {
    const url = new URL(path, this.config.env.appUrl);
    url.searchParams.set('token', token);
    return url.toString();
  }

  sendEmailVerification(to: string, name: string, token: string): Promise<void> {
    const url = this.link('/verify-email', token);
    return this.send(
      to,
      'Verify your email address',
      `Hi ${name},`,
      'Confirm your email address to activate your account. The link expires in 24 hours.',
      url,
      'Verify email',
    );
  }

  sendAccountExists(to: string): Promise<void> {
    const url = new URL('/forgot-password', this.config.env.appUrl).toString();
    return this.send(
      to,
      'Someone tried to sign up with your email',
      'Hello,',
      'An account already exists for this email address. If this was you, sign in or reset your password. Otherwise you can ignore this email.',
      url,
      'Reset password',
    );
  }

  sendPasswordReset(to: string, name: string, token: string): Promise<void> {
    const url = this.link('/reset-password', token);
    return this.send(
      to,
      'Reset your password',
      `Hi ${name},`,
      'Use the link below to choose a new password. It expires in 1 hour. If you did not request this, ignore this email.',
      url,
      'Reset password',
    );
  }

  sendInvitation(
    to: string,
    tenantName: string,
    inviterName: string,
    token: string,
  ): Promise<void> {
    const url = this.link('/invitations/accept', token);
    return this.send(
      to,
      `You're invited to join ${tenantName}`,
      'Hello,',
      `${inviterName} invited you to join ${tenantName}. The invitation expires in 7 days.`,
      url,
      'Accept invitation',
    );
  }

  private async send(
    to: string,
    subject: string,
    greeting: string,
    body: string,
    url: string,
    cta: string,
  ): Promise<void> {
    const text = `${greeting}\n\n${body}\n\n${cta}: ${url}\n`;
    const html = `<p>${escapeHtml(greeting)}</p><p>${escapeHtml(body)}</p><p><a href="${escapeHtml(url)}">${escapeHtml(cta)}</a></p>`;
    try {
      await this.transport.send({ to, subject, text, html });
    } catch (error) {
      // Delivery failures must not leak to the client (that would reveal which emails exist).
      this.logger.error({ err: error }, `Failed to send "${subject}" email`);
    }
  }
}
