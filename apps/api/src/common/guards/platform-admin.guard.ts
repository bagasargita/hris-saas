import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { AppException } from '../errors/app-exception';
import { type AppRequest } from '../http/request-context';

/**
 * Platform administration is a separate privilege from tenant roles: it is stored on the user,
 * re-read from the database with every session lookup, and grants no tenant permissions.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AppRequest>();
    if (!req.auth) throw AppException.unauthenticated();
    if (req.auth.user.platformRole !== 'SUPER_ADMIN') {
      throw AppException.forbidden('Platform administrator access required');
    }
    return true;
  }
}
