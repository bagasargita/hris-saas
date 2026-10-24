import { Injectable } from '@nestjs/common';
import { type AuditLogDto, type Paginated } from '@saas/contracts';
import { type RequestMeta } from '../../common/http/request-context';
import { paginated, skipTake } from '../../common/pagination/pagination';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { type AuditLogQueryDto } from './audit-log.dto';

export const AUDIT_ACTIONS = {
  AUTH_REGISTERED: 'auth.registered',
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGIN_FAILED: 'auth.login_failed',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_EMAIL_VERIFIED: 'auth.email_verified',
  AUTH_PASSWORD_RESET_REQUESTED: 'auth.password_reset_requested',
  AUTH_PASSWORD_RESET: 'auth.password_reset',
  USER_PASSWORD_CHANGED: 'user.password_changed',
  USER_PROFILE_UPDATED: 'user.profile_updated',
  USER_SESSION_REVOKED: 'user.session_revoked',
  TENANT_CREATED: 'tenant.created',
  TENANT_UPDATED: 'tenant.updated',
  MEMBER_ROLES_CHANGED: 'member.roles_changed',
  MEMBER_STATUS_CHANGED: 'member.status_changed',
  MEMBER_REMOVED: 'member.removed',
  MEMBER_LEFT: 'member.left',
  MEMBER_MANAGER_CHANGED: 'member.manager_changed',
  ATTENDANCE_SITE_CREATED: 'attendance.site_created',
  ATTENDANCE_SITE_UPDATED: 'attendance.site_updated',
  ATTENDANCE_SITE_DELETED: 'attendance.site_deleted',
  ATTENDANCE_SCHEDULE_UPDATED: 'attendance.schedule_updated',
  ATTENDANCE_CLOCK_IN: 'attendance.clock_in',
  ATTENDANCE_CLOCK_OUT: 'attendance.clock_out',
  ATTENDANCE_APPROVED: 'attendance.approved',
  ATTENDANCE_REJECTED: 'attendance.rejected',
  ROLE_CREATED: 'role.created',
  ROLE_UPDATED: 'role.updated',
  ROLE_DELETED: 'role.deleted',
  INVITATION_CREATED: 'invitation.created',
  INVITATION_RESENT: 'invitation.resent',
  INVITATION_REVOKED: 'invitation.revoked',
  INVITATION_ACCEPTED: 'invitation.accepted',
  PLATFORM_TENANT_STATUS_CHANGED: 'platform.tenant_status_changed',
  PLATFORM_TENANT_DELETED: 'platform.tenant_deleted',
  PLATFORM_USER_STATUS_CHANGED: 'platform.user_status_changed',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface AuditEntry {
  action: AuditAction;
  actorId: string | null;
  tenantId?: string | null;
  targetType?: string;
  targetId?: string;
  /** Never include secrets, tokens or password material. */
  metadata?: Prisma.InputJsonObject;
  meta?: RequestMeta;
}

const auditInclude = {
  actor: { select: { id: true, name: true, email: true } },
} satisfies Prisma.AuditLogInclude;
type AuditRow = Prisma.AuditLogGetPayload<{ include: typeof auditInclude }>;

function toDto(row: AuditRow): AuditLogDto {
  return {
    id: row.id,
    action: row.action,
    actor: row.actor,
    tenantId: row.tenantId,
    targetType: row.targetType,
    targetId: row.targetId,
    metadata:
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? row.metadata
        : null,
    ipAddress: row.ipAddress,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Pass the transaction client so the audit row commits or rolls back with the audited change. */
  async record(entry: AuditEntry, tx: Prisma.TransactionClient = this.prisma): Promise<void> {
    await tx.auditLog.create({
      data: {
        action: entry.action,
        actorId: entry.actorId,
        tenantId: entry.tenantId ?? null,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        metadata: entry.metadata ?? Prisma.JsonNull,
        ipAddress: entry.meta?.ipAddress ?? null,
        userAgent: entry.meta?.userAgent ?? null,
        requestId: entry.meta?.requestId ?? null,
      },
    });
  }

  /** `tenantId: undefined` lists across all tenants and is reserved for platform administrators. */
  async list(
    scope: { tenantId: string | undefined },
    query: AuditLogQueryDto,
  ): Promise<Paginated<AuditLogDto>> {
    const where: Prisma.AuditLogWhereInput = {
      ...(scope.tenantId !== undefined ? { tenantId: scope.tenantId } : {}),
      ...(query.action ? { action: { startsWith: query.action } } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: auditInclude,
        orderBy: { createdAt: query.sortOrder },
        ...skipTake(query),
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginated(rows.map(toDto), total, query);
  }
}
