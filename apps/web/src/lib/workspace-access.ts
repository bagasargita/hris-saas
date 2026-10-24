import { SYSTEM_ROLE_KEYS, type MembershipSummaryDto } from '@saas/contracts';

/**
 * First workspace: anyone. Extra workspaces: only users who already own one.
 * Matches API `TenantsService.assertCanCreateWorkspace`.
 */
export function canCreateWorkspace(memberships: readonly MembershipSummaryDto[]): boolean {
  if (memberships.length === 0) return true;
  return memberships.some(
    (m) =>
      m.status === 'ACTIVE' &&
      m.tenant.status === 'ACTIVE' &&
      m.roles.some((r) => r.key === SYSTEM_ROLE_KEYS.OWNER),
  );
}
