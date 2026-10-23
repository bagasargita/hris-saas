import type { PermissionKey } from './permissions';
import type { PlanKey } from './plans';
import type { PlatformRole } from './roles';

/** ISO-8601 timestamp string as serialized by the API. */
export type IsoDate = string;

export type UserStatus = 'ACTIVE' | 'SUSPENDED';
export type TenantStatus = 'ACTIVE' | 'SUSPENDED';
export type MembershipStatus = 'ACTIVE' | 'SUSPENDED';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export interface UserDto {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  platformRole: PlatformRole;
  status: UserStatus;
  createdAt: IsoDate;
}

export interface RoleRefDto {
  id: string;
  key: string;
  name: string;
}

export interface MembershipSummaryDto {
  membershipId: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: TenantStatus;
    plan: PlanKey;
  };
  status: MembershipStatus;
  roles: RoleRefDto[];
}

export interface MeResponse {
  user: UserDto;
  activeTenantId: string | null;
  memberships: MembershipSummaryDto[];
}

export interface CsrfResponse {
  csrfToken: string;
}

/** Login rotates both the session and the CSRF token; the new token is returned for convenience. */
export interface LoginResponse extends MeResponse, CsrfResponse {}

export interface MessageResponse {
  message: string;
}

/** Effective authorization context for one tenant, as resolved by the API. */
export interface TenantContextResponse {
  tenant: TenantDto;
  membershipId: string;
  roles: RoleRefDto[];
  permissions: PermissionKey[];
}

export interface TenantDto {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  plan: PlanKey;
  createdAt: IsoDate;
}

export interface TenantStatsResponse {
  activeMembers: number;
  suspendedMembers: number;
  pendingInvitations: number;
  roles: number;
  membersByRole: { role: string; count: number }[];
  activityByDay: { date: string; count: number }[];
}

export interface MemberDto {
  id: string;
  status: MembershipStatus;
  joinedAt: IsoDate;
  user: { id: string; email: string; name: string };
  roles: RoleRefDto[];
}

export interface RoleDto {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: PermissionKey[];
  memberCount: number;
  createdAt: IsoDate;
}

export interface PermissionDto {
  key: PermissionKey;
  group: string;
  description: string;
}

export interface InvitationDto {
  id: string;
  email: string;
  status: InvitationStatus;
  role: RoleRefDto;
  invitedBy: { id: string; name: string } | null;
  expiresAt: IsoDate;
  createdAt: IsoDate;
}

export interface InvitationPreviewDto {
  tenantName: string;
  email: string;
  roleName: string;
  expiresAt: IsoDate;
}

/** One row from a bulk invitation CSV import. */
export interface InvitationImportRowResult {
  line: number;
  email: string;
  role: string;
  status: 'invited' | 'skipped' | 'failed';
  message?: string;
  invitationId?: string;
}

export interface InvitationImportResultDto {
  total: number;
  invited: number;
  skipped: number;
  failed: number;
  rows: InvitationImportRowResult[];
}

export interface AuditLogDto {
  id: string;
  action: string;
  actor: { id: string; name: string; email: string } | null;
  tenantId: string | null;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: IsoDate;
}

export interface SessionDto {
  id: string;
  current: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: IsoDate;
  lastUsedAt: IsoDate;
  expiresAt: IsoDate;
}

export interface BillingDto {
  plan: PlanKey;
  providerConfigured: boolean;
  memberCount: number;
  memberLimit: number | null;
}

export interface PlatformTenantDto extends TenantDto {
  memberCount: number;
}

export interface PlatformUserDto extends UserDto {
  membershipCount: number;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  checks: Record<string, 'up' | 'down'>;
}
