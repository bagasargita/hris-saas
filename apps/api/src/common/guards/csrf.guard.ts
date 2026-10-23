import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppConfig } from '../../config/app-config';
import { AuthCookiesService } from '../../modules/auth/auth-cookies.service';
import { CsrfService } from '../../modules/auth/csrf.service';
import { SKIP_CSRF_KEY } from '../decorators';
import { AppException } from '../errors/app-exception';
import { type AppRequest } from '../http/request-context';
import { safeEqual } from '../security/crypto';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Global guard for state-changing requests. Two independent checks:
 *  1. Origin (or Referer) must be an allowlisted origin when the browser sends one.
 *  2. X-CSRF-Token header must equal the CSRF cookie and carry a valid signature for the current session.
 * Runs after SessionAuthGuard so the token can be bound to the resolved session.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: AppConfig,
    private readonly csrf: CsrfService,
    private readonly cookies: AuthCookiesService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AppRequest>();
    if (SAFE_METHODS.has(req.method)) return true;

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const origin = this.requestOrigin(req);
    if (origin !== null && !this.config.env.allowedOrigins.includes(origin)) {
      throw this.reject('Request origin is not allowed');
    }

    const header = req.get('x-csrf-token');
    const cookie = this.cookies.readCsrfCookie(req);
    if (!header || !cookie || !safeEqual(header, cookie)) {
      throw this.reject('Missing or invalid CSRF token');
    }
    if (!this.csrf.verify(header, req.auth?.session.id ?? null)) {
      throw this.reject('Missing or invalid CSRF token');
    }
    return true;
  }

  private requestOrigin(req: AppRequest): string | null {
    const origin = req.get('origin');
    if (origin) return origin;
    const referer = req.get('referer');
    if (!referer) return null;
    try {
      return new URL(referer).origin;
    } catch {
      return 'invalid';
    }
  }

  private reject(message: string): AppException {
    return new AppException('CSRF_INVALID', message, HttpStatus.FORBIDDEN);
  }
}
