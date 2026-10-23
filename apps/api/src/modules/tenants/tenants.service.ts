import { Injectable } from '@nestjs/common';
import {
  type MembershipSummaryDto,
  type TenantContextResponse,
  type TenantDto,
  type TenantStatsResponse,
} from '@saas/contracts';
import { AppException } from '../../common/errors/app-exception';
import {
  type AuthContext,
  type RequestMeta,
  type TenantContext,
} from '../../common/http/request-context';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { AUDIT_ACTIONS, AuditLogService } from '../audit-logs/audit-log.service';
import { AuthorizationService } from '../permissions/authorization.service';
import { membershipSummaryInclude, toMembershipSummary } from '../users/user.mapper';
import { provisionTenant, slugify, withRandomSuffix } from './tenant-provisioning';
import { toTenantContextResponse, toTenantDto } from './tenant.mapper';
import { type CreateTenantDto, type UpdateTenantDto } from './tenants.dto';

const ACTIVITY_DAYS = 14;

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly authorization: AuthorizationService,
  ) {}

  async listMine(userId: string): Promise<MembershipSummaryDto[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: membershipSummaryInclude,
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map(toMembershipSummary);
  }

  async create(
    auth: AuthContext,
    dto: CreateTenantDto,
    meta: RequestMeta,
  ): Promise<TenantContextResponse> {
    const explicitSlug = dto.slug !== undefined;
    const baseSlug = dto.slug ?? slugify(dto.name);

    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = attempt === 0 ? baseSlug : withRandomSuffix(baseSlug);
      try {
        const tenantId = await this.prisma.$transaction(async (tx) => {
          const { tenant } = await provisionTenant(tx, {
            name: dto.name,
            slug,
            ownerUserId: auth.user.id,
          });
          await this.audit.record(
            {
              action: AUDIT_ACTIONS.TENANT_CREATED,
              actorId: auth.user.id,
              tenantId: tenant.id,
              targetType: 'tenant',
              targetId: tenant.id,
              metadata: { name: tenant.name, slug: tenant.slug },
              meta,
            },
            tx,
          );
          return tenant.id;
        });
        return toTenantContextResponse(
          await this.authorization.resolveTenantContext(auth.user.id, tenantId),
        );
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        if (explicitSlug) throw AppException.conflict('This workspace URL is already taken');
      }
    }
    throw AppException.conflict(
      'Could not generate a unique workspace URL. Please choose one explicitly.',
    );
  }

  async update(
    context: TenantContext,
    actorId: string,
    dto: UpdateTenantDto,
    meta: RequestMeta,
  ): Promise<TenantDto> {
    if (dto.name === undefined && dto.slug === undefined) {
      throw AppException.badRequest('Nothing to update');
    }
    try {
      const tenant = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.tenant.update({
          where: { id: context.tenant.id },
          data: {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
          },
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.TENANT_UPDATED,
            actorId,
            tenantId: updated.id,
            targetType: 'tenant',
            targetId: updated.id,
            metadata: {
              ...(dto.name !== undefined ? { name: dto.name } : {}),
              ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
            },
            meta,
          },
          tx,
        );
        return updated;
      });
      return toTenantDto(tenant);
    } catch (error) {
      if (isUniqueViolation(error))
        throw AppException.conflict('This workspace URL is already taken');
      throw error;
    }
  }

  async stats(tenantId: string): Promise<TenantStatsResponse> {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (ACTIVITY_DAYS - 1));

    const [activeMembers, suspendedMembers, pendingInvitations, roles, roleCounts, activity] =
      await Promise.all([
        this.prisma.membership.count({ where: { tenantId, status: 'ACTIVE' } }),
        this.prisma.membership.count({ where: { tenantId, status: 'SUSPENDED' } }),
        this.prisma.invitation.count({
          where: { tenantId, status: 'PENDING', expiresAt: { gt: new Date() } },
        }),
        this.prisma.role.findMany({ where: { tenantId }, select: { id: true, name: true } }),
        this.prisma.membershipRole.groupBy({
          by: ['roleId'],
          where: { tenantId },
          _count: { _all: true },
        }),
        this.prisma.$queryRaw<{ day: Date; count: bigint }[]>`
        SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC') AS day, COUNT(*)::bigint AS count
        FROM "audit_logs"
        WHERE "tenantId" = ${tenantId}::uuid AND "createdAt" >= ${since}
        GROUP BY 1
        ORDER BY 1`,
      ]);

    const countByRole = new Map(roleCounts.map((r) => [r.roleId, r._count._all]));
    const countByDay = new Map(
      activity.map((a) => [a.day.toISOString().slice(0, 10), Number(a.count)]),
    );
    const activityByDay = Array.from({ length: ACTIVITY_DAYS }, (_, i) => {
      const day = new Date(since);
      day.setUTCDate(since.getUTCDate() + i);
      const date = day.toISOString().slice(0, 10);
      return { date, count: countByDay.get(date) ?? 0 };
    });

    return {
      activeMembers,
      suspendedMembers,
      pendingInvitations,
      roles: roles.length,
      membersByRole: roles.map((role) => ({
        role: role.name,
        count: countByRole.get(role.id) ?? 0,
      })),
      activityByDay,
    };
  }

  /** Leaving is always allowed except for the last active owner, who must transfer ownership first. */
  async leave(context: TenantContext, auth: AuthContext, meta: RequestMeta): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        if (
          context.isOwner &&
          (await this.authorization.countActiveOwners(context.tenant.id, tx)) <= 1
        ) {
          throw AppException.conflict(
            'You are the last owner. Assign another owner before leaving.',
          );
        }
        await tx.membership.delete({ where: { id: context.membershipId } });
        await tx.session.updateMany({
          where: { userId: auth.user.id, activeTenantId: context.tenant.id },
          data: { activeTenantId: null },
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.MEMBER_LEFT,
            actorId: auth.user.id,
            tenantId: context.tenant.id,
            targetType: 'membership',
            targetId: context.membershipId,
            meta,
          },
          tx,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
