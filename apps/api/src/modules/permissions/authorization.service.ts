import { HttpStatus, Injectable } from '@nestjs/common';
import { isPermissionKey, type PermissionKey, SYSTEM_ROLE_KEYS } from '@saas/contracts';
import { AppException } from '../../common/errors/app-exception';
import { type TenantContext } from '../../common/http/request-context';
import { PrismaService } from '../../database/prisma.service';
import { type Prisma } from '../../generated/prisma/client';
import { type MemberScope } from './authorization.policy';

const membershipWithPermissions = {
  roles: {
    select: {
      role: {
        select: {
          id: true,
          key: true,
          name: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
    },
  },
} satisfies Prisma.MembershipInclude;

type MembershipWithPermissions = Prisma.MembershipGetPayload<{
  include: typeof membershipWithPermissions;
}>;

function effectivePermissions(membership: MembershipWithPermissions): Set<PermissionKey> {
  const permissions = new Set<PermissionKey>();
  for (const { role } of membership.roles) {
    for (const { permission } of role.permissions) {
      if (isPermissionKey(permission.key)) permissions.add(permission.key);
    }
  }
  return permissions;
}

function isOwnerMembership(membership: MembershipWithPermissions): boolean {
  return membership.roles.some(({ role }) => role.key === SYSTEM_ROLE_KEYS.OWNER);
}

@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Same error for "tenant does not exist" and "not a member" to avoid tenant enumeration. */
  static tenantAccessDenied(): AppException {
    return new AppException(
      'TENANT_ACCESS_DENIED',
      'You do not have access to this workspace',
      HttpStatus.FORBIDDEN,
    );
  }

  async resolveTenantContext(userId: string, tenantId: string): Promise<TenantContext> {
    const membership = await this.prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      include: { ...membershipWithPermissions, tenant: true },
    });
    if (!membership || membership.status !== 'ACTIVE' || membership.tenant.status !== 'ACTIVE') {
      throw AuthorizationService.tenantAccessDenied();
    }
    const { tenant } = membership;
    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        plan: tenant.plan,
        createdAt: tenant.createdAt,
      },
      membershipId: membership.id,
      roles: membership.roles.map(({ role }) => ({ id: role.id, key: role.key, name: role.name })),
      permissions: effectivePermissions(membership),
      isOwner: isOwnerMembership(membership),
    };
  }

  /**
   * Loads a member strictly within the given tenant. A membership id from another tenant yields
   * 404, which is what prevents cross-tenant object references.
   */
  async loadMemberScope(
    tenantId: string,
    membershipId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<MemberScope & { userId: string; status: string }> {
    const membership = await tx.membership.findFirst({
      where: { id: membershipId, tenantId },
      include: membershipWithPermissions,
    });
    if (!membership) throw AppException.notFound('Member not found');
    return {
      membershipId: membership.id,
      userId: membership.userId,
      status: membership.status,
      isOwner: isOwnerMembership(membership),
      permissions: effectivePermissions(membership),
    };
  }

  /** Number of active owners in a tenant, used to protect against removing the last owner. */
  async countActiveOwners(
    tenantId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return tx.membership.count({
      where: {
        tenantId,
        status: 'ACTIVE',
        roles: { some: { role: { key: SYSTEM_ROLE_KEYS.OWNER } } },
      },
    });
  }
}
