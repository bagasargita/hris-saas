'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { PermissionKey, TenantContextResponse } from '@saas/contracts';

interface TenantContextValue {
  tenant: TenantContextResponse['tenant'];
  membershipId: string;
  roles: TenantContextResponse['roles'];
  /** Used only to hide UI the user cannot use. Every action is re-authorized by the API. */
  can: (permission: PermissionKey) => boolean;
  basePath: string;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({
  context,
  children,
}: {
  context: TenantContextResponse;
  children: ReactNode;
}) {
  const value = useMemo<TenantContextValue>(() => {
    const permissions = new Set(context.permissions);
    return {
      tenant: context.tenant,
      membershipId: context.membershipId,
      roles: context.roles,
      can: (permission) => permissions.has(permission),
      basePath: `/t/${context.tenant.slug}`,
    };
  }, [context]);
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const value = useContext(TenantContext);
  if (!value) throw new Error('useTenant must be used inside a tenant route');
  return value;
}

/** Renders children only when the user holds the permission. Not a security boundary. */
export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: PermissionKey;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can } = useTenant();
  return <>{can(permission) ? children : fallback}</>;
}
