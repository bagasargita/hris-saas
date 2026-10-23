import { Injectable } from '@nestjs/common';
import { type Paginated, type PlatformTenantDto, type PlatformUserDto } from '@saas/contracts';
import { AppException } from '../../common/errors/app-exception';
import { type AuthContext, type RequestMeta } from '../../common/http/request-context';
import { paginated, skipTake } from '../../common/pagination/pagination';
import { PrismaService } from '../../database/prisma.service';
import { type Prisma } from '../../generated/prisma/client';
import { AUDIT_ACTIONS, AuditLogService } from '../audit-logs/audit-log.service';
import { SessionService } from '../auth/session.service';
import { toTenantDto } from '../tenants/tenant.mapper';
import { toUserDto } from '../users/user.mapper';
import { type PlatformListQueryDto, type UpdateStatusDto } from './platform.dto';

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly sessions: SessionService,
  ) {}

  async listTenants(query: PlatformListQueryDto): Promise<Paginated<PlatformTenantDto>> {
    const search = query.search?.trim();
    const where: Prisma.TenantWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.tenant.findMany({
        where,
        include: { _count: { select: { memberships: true } } },
        orderBy: { createdAt: query.sortOrder },
        ...skipTake(query),
      }),
      this.prisma.tenant.count({ where }),
    ]);
    return paginated(
      rows.map((t) => ({ ...toTenantDto(t), memberCount: t._count.memberships })),
      total,
      query,
    );
  }

  async setTenantStatus(
    auth: AuthContext,
    tenantId: string,
    dto: UpdateStatusDto,
    meta: RequestMeta,
  ): Promise<PlatformTenantDto> {
    const tenant = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.tenant.findUnique({ where: { id: tenantId } });
      if (!existing) throw AppException.notFound('Tenant not found');
      const updated = await tx.tenant.update({
        where: { id: tenantId },
        data: { status: dto.status },
        include: { _count: { select: { memberships: true } } },
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.PLATFORM_TENANT_STATUS_CHANGED,
          actorId: auth.user.id,
          tenantId,
          targetType: 'tenant',
          targetId: tenantId,
          metadata: { from: existing.status, to: dto.status },
          meta,
        },
        tx,
      );
      return updated;
    });
    return { ...toTenantDto(tenant), memberCount: tenant._count.memberships };
  }

  /**
   * Permanently removes a tenant and all tenant-scoped data. Users and their
   * global accounts are kept. Tenant-scoped audit rows are removed with the
   * tenant; a single platform-level audit entry records the deletion.
   */
  async deleteTenant(auth: AuthContext, tenantId: string, meta: RequestMeta): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.tenant.findUnique({
        where: { id: tenantId },
        include: { _count: { select: { memberships: true } } },
      });
      if (!existing) throw AppException.notFound('Tenant not found');

      // FK order: invitations/membership roles → memberships → roles → audit → tenant.
      // Sessions only reference the tenant as optional activeTenantId (SetNull).
      await tx.invitation.deleteMany({ where: { tenantId } });
      await tx.membershipRole.deleteMany({ where: { tenantId } });
      await tx.membership.deleteMany({ where: { tenantId } });
      await tx.role.deleteMany({ where: { tenantId } });
      await tx.auditLog.deleteMany({ where: { tenantId } });
      await tx.session.updateMany({
        where: { activeTenantId: tenantId },
        data: { activeTenantId: null },
      });
      await tx.tenant.delete({ where: { id: tenantId } });

      await this.audit.record(
        {
          action: AUDIT_ACTIONS.PLATFORM_TENANT_DELETED,
          actorId: auth.user.id,
          tenantId: null,
          targetType: 'tenant',
          targetId: tenantId,
          metadata: {
            name: existing.name,
            slug: existing.slug,
            plan: existing.plan,
            status: existing.status,
            memberCount: existing._count.memberships,
          },
          meta,
        },
        tx,
      );
    });
  }

  async listUsers(query: PlatformListQueryDto): Promise<Paginated<PlatformUserDto>> {
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: { _count: { select: { memberships: true } } },
        orderBy: { createdAt: query.sortOrder },
        ...skipTake(query),
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginated(
      rows.map((u) => ({ ...toUserDto(u), membershipCount: u._count.memberships })),
      total,
      query,
    );
  }

  /** Suspending a user also revokes every session so access ends immediately. */
  async setUserStatus(
    auth: AuthContext,
    userId: string,
    dto: UpdateStatusDto,
    meta: RequestMeta,
  ): Promise<PlatformUserDto> {
    if (userId === auth.user.id)
      throw AppException.forbidden('You cannot change your own account status');
    const user = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { id: userId } });
      if (!existing) throw AppException.notFound('User not found');
      const updated = await tx.user.update({
        where: { id: userId },
        data: { status: dto.status },
        include: { _count: { select: { memberships: true } } },
      });
      if (dto.status === 'SUSPENDED') await this.sessions.revokeAllForUser(userId, {}, tx);
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.PLATFORM_USER_STATUS_CHANGED,
          actorId: auth.user.id,
          targetType: 'user',
          targetId: userId,
          metadata: { from: existing.status, to: dto.status },
          meta,
        },
        tx,
      );
      return updated;
    });
    return { ...toUserDto(user), membershipCount: user._count.memberships };
  }
}
