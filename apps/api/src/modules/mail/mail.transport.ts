import { Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface MailTransport {
  send(message: MailMessage): Promise<void>;
}

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');

export class SmtpMailTransport implements MailTransport {
  private readonly transporter: Transporter;

  constructor(
    smtpUrl: string,
    private readonly from: string,
  ) {
    this.transporter = createTransport(smtpUrl);
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({ from: this.from, ...message });
  }
}

/**
 * Development fallback when SMTP_URL is unset. Production refuses to start without SMTP (see env.ts),
 * so links are never written to production logs.
 */
export class LogMailTransport implements MailTransport {
  private readonly logger = new Logger('Mail');

  send(message: MailMessage): Promise<void> {
    this.logger.warn(
      `SMTP_URL not configured. Email to ${message.to} "${message.subject}":\n${message.text}`,
    );
    return Promise.resolve();
  }
}

/** Captures emails in memory; used by automated tests to read verification and reset links. */
export class MemoryMailTransport implements MailTransport {
  readonly sent: MailMessage[] = [];

  send(message: MailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }

  lastTo(email: string): MailMessage | undefined {
    return [...this.sent].reverse().find((m) => m.to === email);
  }

  clear(): void {
    this.sent.length = 0;
  }
}
