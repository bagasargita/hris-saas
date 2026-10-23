import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import { ApiCookieAuth, ApiForbiddenResponse, ApiParam } from '@nestjs/swagger';
import { type PermissionKey } from '@saas/contracts';
import { AppException } from '../errors/app-exception';
import {
  type AppRequest,
  type AuthContext,
  type RequestMeta,
  type TenantContext,
  requestMeta,
} from '../http/request-context';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { TenantAccessGuard } from '../guards/tenant-access.guard';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const SKIP_CSRF_KEY = 'auth:skipCsrf';
export const PERMISSIONS_KEY = 'auth:permissions';

/** Route does not require a session. A valid session is still resolved if present. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Only for endpoints that never use ambient credentials (none currently). */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);

/**
 * Marks a controller or route as tenant-scoped: the `:tenantId` route parameter selects the tenant,
 * the guard verifies an active membership in an active tenant and the listed permissions.
 */
export function TenantScoped(...permissions: PermissionKey[]) {
  return applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissions),
    UseGuards(TenantAccessGuard),
    ApiCookieAuth(),
    ApiParam({ name: 'tenantId', format: 'uuid' }),
    ApiForbiddenResponse({ description: 'Not an active member or missing permission' }),
  );
}

/** Additional permissions on a single route inside a tenant-scoped controller. */
export const RequirePermissions = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export function PlatformAdminOnly() {
  return applyDecorators(UseGuards(PlatformAdminGuard), ApiCookieAuth());
}

export const Auth = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthContext => {
  const req = ctx.switchToHttp().getRequest<AppRequest>();
  if (!req.auth) throw AppException.unauthenticated();
  return req.auth;
});

export const Tenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    // Reaching a handler without context means the route forgot @TenantScoped(): fail closed.
    if (!req.tenantContext) throw AppException.forbidden();
    return req.tenantContext;
  },
);

export const ReqMeta = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestMeta => {
    return requestMeta(ctx.switchToHttp().getRequest<AppRequest>());
  },
);
