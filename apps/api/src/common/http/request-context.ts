import { type PermissionKey } from '@saas/contracts';
import { type Request } from 'express';
import { type PlatformRole, type Plan, type TenantStatus } from '../../generated/prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  platformRole: PlatformRole;
}

export interface AuthSession {
  id: string;
  activeTenantId: string | null;
}

export interface AuthContext {
  user: AuthUser;
  session: AuthSession;
}

/** Authorization context for one tenant, resolved from the database on every tenant-scoped request. */
export interface TenantContext {
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: TenantStatus;
    plan: Plan;
    createdAt: Date;
  };
  membershipId: string;
  roles: { id: string; key: string; name: string }[];
  permissions: ReadonlySet<PermissionKey>;
  isOwner: boolean;
}

export interface RequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
}

/** `req.id` (the request id) is declared on Express' Request by pino-http. */
export interface AppRequest extends Request {
  auth?: AuthContext;
  tenantContext?: TenantContext;
}

export function requestMeta(req: AppRequest): RequestMeta {
  const userAgent = req.get('user-agent');
  return {
    ipAddress: req.ip ?? null,
    userAgent: userAgent ? userAgent.slice(0, 512) : null,
    requestId: typeof req.id === 'string' ? req.id : null,
  };
}
