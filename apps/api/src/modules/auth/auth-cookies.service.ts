import { Injectable } from '@nestjs/common';
import { type CookieOptions, type Request, type Response } from 'express';
import { AppConfig } from '../../config/app-config';
import { CsrfService } from './csrf.service';

@Injectable()
export class AuthCookiesService {
  constructor(
    private readonly config: AppConfig,
    private readonly csrf: CsrfService,
  ) {}

  get sessionCookieName(): string {
    return this.config.cookieName('sid');
  }

  get csrfCookieName(): string {
    return this.config.cookieName('csrf');
  }

  readSessionToken(req: Request): string | null {
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const value = cookies?.[this.sessionCookieName];
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  readCsrfCookie(req: Request): string | null {
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const value = cookies?.[this.csrfCookieName];
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  setSession(res: Response, token: string, absoluteExpiresAt: Date): void {
    res.cookie(this.sessionCookieName, token, {
      ...this.baseOptions(),
      httpOnly: true,
      expires: absoluteExpiresAt,
    });
  }

  clearSession(res: Response): void {
    res.clearCookie(this.sessionCookieName, { ...this.baseOptions(), httpOnly: true });
  }

  /** Issues a CSRF token bound to the given session and stores it in a JS-readable cookie. */
  issueCsrf(res: Response, sessionId: string | null): string {
    const token = this.csrf.issue(sessionId);
    res.cookie(this.csrfCookieName, token, { ...this.baseOptions(), httpOnly: false });
    return token;
  }

  private baseOptions(): CookieOptions {
    const { secure, domain } = this.config.env.cookie;
    return {
      secure,
      sameSite: 'lax',
      path: '/',
      ...(domain ? { domain } : {}),
    };
  }
}
