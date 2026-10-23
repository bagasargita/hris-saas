/**
 * Every tenant-scoped key starts with ['tenant', tenantId] so data from one workspace can never be
 * served from cache while viewing another, and a whole workspace can be invalidated at once.
 */
export const queryKeys = {
  me: ['me'] as const,
  myTenants: ['me', 'tenants'] as const,
  mySessions: ['me', 'sessions'] as const,
  tenant: (tenantId: string) => ['tenant', tenantId] as const,
  tenantStats: (tenantId: string) => ['tenant', tenantId, 'stats'] as const,
  members: (tenantId: string, params?: object) =>
    ['tenant', tenantId, 'members', params ?? {}] as const,
  roles: (tenantId: string) => ['tenant', tenantId, 'roles'] as const,
  permissions: (tenantId: string) => ['tenant', tenantId, 'permissions'] as const,
  invitations: (tenantId: string, params?: object) =>
    ['tenant', tenantId, 'invitations', params ?? {}] as const,
  auditLogs: (tenantId: string, params?: object) =>
    ['tenant', tenantId, 'audit-logs', params ?? {}] as const,
  billing: (tenantId: string) => ['tenant', tenantId, 'billing'] as const,
  platformTenants: (params?: object) => ['platform', 'tenants', params ?? {}] as const,
  platformUsers: (params?: object) => ['platform', 'users', params ?? {}] as const,
  platformAuditLogs: (params?: object) => ['platform', 'audit-logs', params ?? {}] as const,
};

export function toSearchParams(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}
