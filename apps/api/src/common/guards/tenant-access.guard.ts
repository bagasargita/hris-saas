import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type PermissionKey } from '@saas/contracts';
import { isUUID } from 'class-validator';
import { AuthorizationService } from '../../modules/permissions/authorization.service';
import { PERMISSIONS_KEY } from '../decorators';
import { AppException } from '../errors/app-exception';
import { type AppRequest } from '../http/request-context';

/**
 * Resolves the tenant authorization context for `:tenantId` from the database and enforces the
 * permissions declared with @TenantScoped / @RequirePermissions. The route parameter only selects
 * the tenant; access is proven exclusively by an active membership row.
 */
@Injectable()
export class TenantAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorization: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AppRequest>();
    if (!req.auth) throw AppException.unauthenticated();

    const tenantId = req.params['tenantId'];
    if (typeof tenantId !== 'string' || !isUUID(tenantId)) {
      throw AuthorizationService.tenantAccessDenied();
    }

    const tenantContext = await this.authorization.resolveTenantContext(req.auth.user.id, tenantId);

    const required =
      this.reflector.getAllAndMerge<PermissionKey[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const missing = required.filter((permission) => !tenantContext.permissions.has(permission));
    if (missing.length > 0) {
      throw AppException.forbidden(`Missing permission: ${missing.join(', ')}`);
    }

    req.tenantContext = tenantContext;
    return true;
  }
}
