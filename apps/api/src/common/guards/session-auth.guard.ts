import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Response } from 'express';
import { AuthCookiesService } from '../../modules/auth/auth-cookies.service';
import { SessionService } from '../../modules/auth/session.service';
import { IS_PUBLIC_KEY } from '../decorators';
import { AppException } from '../errors/app-exception';
import { type AppRequest } from '../http/request-context';

/** Global guard: resolves the session cookie on every request and rejects anonymous access to non-public routes. */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly cookies: AuthCookiesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<AppRequest>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const token = this.cookies.readSessionToken(req);
    if (token) {
      const auth = await this.sessions.resolve(token);
      if (auth) {
        req.auth = auth;
      } else {
        this.cookies.clearSession(http.getResponse<Response>());
      }
    }

    if (!req.auth && !isPublic) {
      throw AppException.unauthenticated();
    }
    return true;
  }
}
