import { Injectable } from '@nestjs/common';
import { type MemberDto, type Paginated, SYSTEM_ROLE_KEYS } from '@saas/contracts';
import { AppException } from '../../common/errors/app-exception';
import { type RequestMeta, type TenantContext } from '../../common/http/request-context';
import { paginated, skipTake } from '../../common/pagination/pagination';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { AUDIT_ACTIONS, AuditLogService } from '../audit-logs/audit-log.service';
import {
  actorScope,
  assertCanAssignRole,
  assertCanManageMember,
} from '../permissions/authorization.policy';
import { AuthorizationService } from '../permissions/authorization.service';
import { type ListMembersQueryDto, type MemberStatusValue } from './memberships.dto';

const memberInclude = {
  user: { select: { id: true, email: true, name: true } },
  roles: {
    select: { role: { select: { id: true, key: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.MembershipInclude;

type MemberRow = Prisma.MembershipGetPayload<{ include: typeof memberInclude }>;

function toMemberDto(row: MemberRow): MemberDto {
  return {
    id: row.id,
    status: row.status,
    joinedAt: row.createdAt.toISOString(),
    user: row.user,
    roles: row.roles.map(({ role }) => role),
  };
}

const SERIALIZABLE = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } as const;

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditLogService,
  ) {}

  async list(tenantId: string, query: ListMembersQueryDto): Promise<Paginated<MemberDto>> {
    const search = query.search?.trim();
    const where: Prisma.MembershipWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.roleId ? { roles: { some: { roleId: query.roleId } } } : {}),
      ...(search
        ? {
            user: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };
    const orderBy: Prisma.MembershipOrderByWithRelationInput =
      query.sortBy === 'joinedAt'
        ? { createdAt: query.sortOrder }
        : { user: { [query.sortBy]: query.sortOrder } };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.membership.findMany({
        where,
        include: memberInclude,
        orderBy: [orderBy, { id: 'asc' }],
        ...skipTake(query),
      }),
      this.prisma.membership.count({ where }),
    ]);
    return paginated(rows.map(toMemberDto), total, query);
  }

  async get(tenantId: string, membershipId: string): Promise<MemberDto> {
    const row = await this.prisma.membership.findFirst({
      where: { id: membershipId, tenantId },
      include: memberInclude,
    });
    if (!row) throw AppException.notFound('Member not found');
    return toMemberDto(row);
  }

  async updateRoles(
    context: TenantContext,
    actorId: string,
    membershipId: string,
    roleIds: string[],
    meta: RequestMeta,
  ): Promise<MemberDto> {
    const tenantId = context.tenant.id;
    const uniqueRoleIds = [...new Set(roleIds)];

    await this.prisma.$transaction(async (tx) => {
      const target = await this.authorization.loadMemberScope(tenantId, membershipId, tx);
      const actor = actorScope(context);
      assertCanManageMember(actor, target);

      // Filtering by tenantId makes role ids from other tenants indistinguishable from unknown ids.
      const roles = await tx.role.findMany({
        where: { id: { in: uniqueRoleIds }, tenantId },
        include: { permissions: { select: { permission: { select: { key: true } } } } },
      });
      if (roles.length !== uniqueRoleIds.length) {
        throw AppException.badRequest('One or more roles do not exist in this workspace');
      }
      for (const role of roles) {
        assertCanAssignRole(actor, {
          key: role.key,
          permissions: role.permissions.map((p) => p.permission.key),
        });
      }

      const keepsOwner = roles.some((r) => r.key === SYSTEM_ROLE_KEYS.OWNER);
      if (
        target.isOwner &&
        !keepsOwner &&
        (await this.authorization.countActiveOwners(tenantId, tx)) <= 1
      ) {
        throw AppException.conflict('A workspace must keep at least one active owner');
      }

      await tx.membershipRole.deleteMany({ where: { membershipId, tenantId } });
      await tx.membershipRole.createMany({
        data: uniqueRoleIds.map((roleId) => ({ membershipId, roleId, tenantId })),
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.MEMBER_ROLES_CHANGED,
          actorId,
          tenantId,
          targetType: 'membership',
          targetId: membershipId,
          metadata: { roles: roles.map((r) => r.key) },
          meta,
        },
        tx,
      );
    }, SERIALIZABLE);

    return this.get(tenantId, membershipId);
  }

  async updateStatus(
    context: TenantContext,
    actorId: string,
    membershipId: string,
    status: MemberStatusValue,
    meta: RequestMeta,
  ): Promise<MemberDto> {
    const tenantId = context.tenant.id;
    await this.prisma.$transaction(async (tx) => {
      const target = await this.authorization.loadMemberScope(tenantId, membershipId, tx);
      assertCanManageMember(actorScope(context), target);
      if (target.status === status) return;
      if (
        status === 'SUSPENDED' &&
        target.isOwner &&
        (await this.authorization.countActiveOwners(tenantId, tx)) <= 1
      ) {
        throw AppException.conflict('A workspace must keep at least one active owner');
      }
      await tx.membership.update({ where: { id: membershipId }, data: { status } });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.MEMBER_STATUS_CHANGED,
          actorId,
          tenantId,
          targetType: 'membership',
          targetId: membershipId,
          metadata: { from: target.status, to: status },
          meta,
        },
        tx,
      );
    }, SERIALIZABLE);
    return this.get(tenantId, membershipId);
  }

  async remove(
    context: TenantContext,
    actorId: string,
    membershipId: string,
    meta: RequestMeta,
  ): Promise<void> {
    const tenantId = context.tenant.id;
    await this.prisma.$transaction(async (tx) => {
      const target = await this.authorization.loadMemberScope(tenantId, membershipId, tx);
      assertCanManageMember(actorScope(context), target);
      if (target.isOwner && (await this.authorization.countActiveOwners(tenantId, tx)) <= 1) {
        throw AppException.conflict('A workspace must keep at least one active owner');
      }
      await tx.membership.delete({ where: { id: membershipId } });
      await tx.session.updateMany({
        where: { userId: target.userId, activeTenantId: tenantId },
        data: { activeTenantId: null },
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.MEMBER_REMOVED,
          actorId,
          tenantId,
          targetType: 'membership',
          targetId: membershipId,
          metadata: { userId: target.userId },
          meta,
        },
        tx,
      );
    }, SERIALIZABLE);
  }
}
