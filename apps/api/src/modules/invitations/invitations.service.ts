import { HttpStatus, Injectable } from '@nestjs/common';
import {
  type InvitationDto,
  type InvitationImportResultDto,
  type InvitationImportRowResult,
  type InvitationPreviewDto,
  type InvitationStatus,
  type Paginated,
  type TenantContextResponse,
} from '@saas/contracts';
import { AppException } from '../../common/errors/app-exception';
import {
  type AuthContext,
  type RequestMeta,
  type TenantContext,
} from '../../common/http/request-context';
import { paginated, skipTake } from '../../common/pagination/pagination';
import { generateToken, hashToken } from '../../common/security/crypto';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { AUDIT_ACTIONS, AuditLogService } from '../audit-logs/audit-log.service';
import { SessionService } from '../auth/session.service';
import { MailService } from '../mail/mail.service';
import { actorScope, assertCanAssignRole } from '../permissions/authorization.policy';
import { AuthorizationService } from '../permissions/authorization.service';
import { toTenantContextResponse } from '../tenants/tenant.mapper';
import {
  INVITATION_IMPORT_MAX_BYTES,
  isPlausibleEmail,
  parseInvitationCsv,
} from './invitation-csv';
import { type CreateInvitationDto, type ListInvitationsQueryDto } from './invitations.dto';

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const invitationInclude = {
  role: { select: { id: true, key: true, name: true } },
  invitedBy: { select: { id: true, name: true } },
} satisfies Prisma.InvitationInclude;

type InvitationRow = Prisma.InvitationGetPayload<{ include: typeof invitationInclude }>;

function effectiveStatus(
  row: { status: InvitationRow['status']; expiresAt: Date },
  now = new Date(),
): InvitationStatus {
  return row.status === 'PENDING' && row.expiresAt <= now ? 'EXPIRED' : row.status;
}

function toInvitationDto(row: InvitationRow): InvitationDto {
  return {
    id: row.id,
    email: row.email,
    status: effectiveStatus(row),
    role: row.role,
    invitedBy: row.invitedBy,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly mail: MailService,
    private readonly authorization: AuthorizationService,
    private readonly sessions: SessionService,
  ) {}

  async list(tenantId: string, query: ListInvitationsQueryDto): Promise<Paginated<InvitationDto>> {
    const now = new Date();
    const statusFilter: Prisma.InvitationWhereInput =
      query.status === 'PENDING'
        ? { status: 'PENDING', expiresAt: { gt: now } }
        : query.status === 'EXPIRED'
          ? { status: 'PENDING', expiresAt: { lte: now } }
          : query.status
            ? { status: query.status }
            : {};
    const where: Prisma.InvitationWhereInput = { tenantId, ...statusFilter };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.invitation.findMany({
        where,
        include: invitationInclude,
        orderBy: { createdAt: query.sortOrder },
        ...skipTake(query),
      }),
      this.prisma.invitation.count({ where }),
    ]);
    return paginated(rows.map(toInvitationDto), total, query);
  }

  async create(
    context: TenantContext,
    auth: AuthContext,
    dto: CreateInvitationDto,
    meta: RequestMeta,
  ): Promise<InvitationDto> {
    const tenantId = context.tenant.id;
    const token = generateToken();

    const invitation = await this.prisma.$transaction(
      async (tx) => {
        const role = await tx.role.findFirst({
          where: { id: dto.roleId, tenantId },
          include: { permissions: { select: { permission: { select: { key: true } } } } },
        });
        if (!role) throw AppException.badRequest('Role does not exist in this workspace');
        // Inviting someone with a role is granting that role: same escalation rules apply.
        assertCanAssignRole(actorScope(context), {
          key: role.key,
          permissions: role.permissions.map((p) => p.permission.key),
        });

        const alreadyMember = await tx.membership.findFirst({
          where: { tenantId, user: { email: dto.email } },
          select: { id: true },
        });
        if (alreadyMember)
          throw AppException.conflict('This person is already a member of the workspace');

        await tx.invitation.updateMany({
          where: { tenantId, email: dto.email, status: 'PENDING' },
          data: { status: 'REVOKED', revokedAt: new Date() },
        });
        const created = await tx.invitation.create({
          data: {
            tenantId,
            email: dto.email,
            roleId: role.id,
            tokenHash: hashToken(token),
            invitedById: auth.user.id,
            expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
          },
          include: invitationInclude,
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.INVITATION_CREATED,
            actorId: auth.user.id,
            tenantId,
            targetType: 'invitation',
            targetId: created.id,
            metadata: { email: dto.email, role: role.key },
            meta,
          },
          tx,
        );
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.mail.sendInvitation(dto.email, context.tenant.name, auth.user.name, token);
    return toInvitationDto(invitation);
  }

  /**
   * Bulk-invite from a CSV (email, role key). Each row is attempted independently so one
   * failure does not roll back successful invitations already sent.
   */
  async importCsv(
    context: TenantContext,
    auth: AuthContext,
    file: { buffer: Buffer; size: number; mimetype?: string; originalname?: string },
    meta: RequestMeta,
  ): Promise<InvitationImportResultDto> {
    if (file.size <= 0 || file.buffer.length === 0) {
      throw AppException.badRequest('Empty file is not allowed');
    }
    if (file.size > INVITATION_IMPORT_MAX_BYTES || file.buffer.length > INVITATION_IMPORT_MAX_BYTES) {
      throw AppException.badRequest(
        `File is too large (max ${String(INVITATION_IMPORT_MAX_BYTES / 1024)} KB)`,
      );
    }
    const name = (file.originalname ?? '').toLowerCase();
    const type = (file.mimetype ?? '').toLowerCase();
    const looksLikeCsv =
      name.endsWith('.csv') ||
      type.includes('csv') ||
      type === 'text/plain' ||
      type === 'application/vnd.ms-excel' ||
      type === 'application/octet-stream' ||
      type === '';
    if (!looksLikeCsv) {
      throw AppException.badRequest('Upload a .csv file with columns email and role');
    }

    let rows;
    try {
      rows = parseInvitationCsv(file.buffer.toString('utf8'));
    } catch (error) {
      throw AppException.badRequest(error instanceof Error ? error.message : 'Invalid CSV');
    }

    const seen = new Set<string>();
    const results: InvitationImportRowResult[] = [];

    for (const row of rows) {
      const email = row.email;
      const roleKey = row.role;

      if (!email && !roleKey) {
        results.push({
          line: row.line,
          email: '',
          role: '',
          status: 'skipped',
          message: 'Empty row',
        });
        continue;
      }
      if (!isPlausibleEmail(email)) {
        results.push({
          line: row.line,
          email,
          role: roleKey,
          status: 'failed',
          message: 'Invalid email address',
        });
        continue;
      }
      if (!roleKey) {
        results.push({
          line: row.line,
          email,
          role: roleKey,
          status: 'failed',
          message: 'Role is required',
        });
        continue;
      }
      if (seen.has(email)) {
        results.push({
          line: row.line,
          email,
          role: roleKey,
          status: 'skipped',
          message: 'Duplicate email in this file',
        });
        continue;
      }
      seen.add(email);

      try {
        const role = await this.prisma.role.findFirst({
          where: { tenantId: context.tenant.id, key: roleKey },
          select: { id: true },
        });
        if (!role) {
          results.push({
            line: row.line,
            email,
            role: roleKey,
            status: 'failed',
            message: `Unknown role key "${roleKey}"`,
          });
          continue;
        }
        const invitation = await this.create(
          context,
          auth,
          { email, roleId: role.id },
          meta,
        );
        results.push({
          line: row.line,
          email,
          role: roleKey,
          status: 'invited',
          invitationId: invitation.id,
        });
      } catch (error) {
        const message =
          error instanceof AppException
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Invitation failed';
        results.push({
          line: row.line,
          email,
          role: roleKey,
          status: 'failed',
          message,
        });
      }
    }

    return {
      total: results.length,
      invited: results.filter((r) => r.status === 'invited').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      failed: results.filter((r) => r.status === 'failed').length,
      rows: results,
    };
  }

  async revoke(
    context: TenantContext,
    actorId: string,
    invitationId: string,
    meta: RequestMeta,
  ): Promise<InvitationDto> {
    const tenantId = context.tenant.id;
    const row = await this.prisma.$transaction(async (tx) => {
      const result = await tx.invitation.updateMany({
        where: { id: invitationId, tenantId, status: 'PENDING' },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
      if (result.count === 0) {
        const exists = await tx.invitation.findFirst({
          where: { id: invitationId, tenantId },
          select: { id: true },
        });
        throw exists
          ? AppException.conflict('Only pending invitations can be revoked')
          : AppException.notFound('Invitation not found');
      }
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.INVITATION_REVOKED,
          actorId,
          tenantId,
          targetType: 'invitation',
          targetId: invitationId,
          meta,
        },
        tx,
      );
      return tx.invitation.findUniqueOrThrow({
        where: { id: invitationId },
        include: invitationInclude,
      });
    });
    return toInvitationDto(row);
  }

  /** Rotates the token (old links stop working) and restarts the expiry window. */
  async resend(
    context: TenantContext,
    auth: AuthContext,
    invitationId: string,
    meta: RequestMeta,
  ): Promise<InvitationDto> {
    const tenantId = context.tenant.id;
    const token = generateToken();
    const row = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.invitation.findFirst({
        where: { id: invitationId, tenantId },
        include: {
          role: { include: { permissions: { select: { permission: { select: { key: true } } } } } },
        },
      });
      if (!existing) throw AppException.notFound('Invitation not found');
      if (existing.status !== 'PENDING')
        throw AppException.conflict('Only pending invitations can be resent');
      assertCanAssignRole(actorScope(context), {
        key: existing.role.key,
        permissions: existing.role.permissions.map((p) => p.permission.key),
      });
      const updated = await tx.invitation.update({
        where: { id: invitationId },
        data: { tokenHash: hashToken(token), expiresAt: new Date(Date.now() + INVITATION_TTL_MS) },
        include: invitationInclude,
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.INVITATION_RESENT,
          actorId: auth.user.id,
          tenantId,
          targetType: 'invitation',
          targetId: invitationId,
          meta,
        },
        tx,
      );
      return updated;
    });
    await this.mail.sendInvitation(row.email, context.tenant.name, auth.user.name, token);
    return toInvitationDto(row);
  }

  async preview(token: string): Promise<InvitationPreviewDto> {
    const invitation = await this.findUsable(token);
    return {
      tenantName: invitation.tenant.name,
      email: invitation.email,
      roleName: invitation.role.name,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  async accept(
    auth: AuthContext,
    token: string,
    meta: RequestMeta,
  ): Promise<TenantContextResponse> {
    const invitation = await this.findUsable(token);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.user.id } });
    if (user.email !== invitation.email) {
      throw AppException.forbidden('This invitation was sent to a different email address');
    }
    if (!user.emailVerifiedAt) {
      throw new AppException(
        'EMAIL_NOT_VERIFIED',
        'Verify your email address before accepting invitations',
        HttpStatus.FORBIDDEN,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.invitation.updateMany({
        where: { id: invitation.id, status: 'PENDING', expiresAt: { gt: new Date() } },
        data: { status: 'ACCEPTED', acceptedAt: new Date(), acceptedById: user.id },
      });
      if (claimed.count !== 1) throw AppException.invalidToken();

      const existing = await tx.membership.findUnique({
        where: { tenantId_userId: { tenantId: invitation.tenantId, userId: user.id } },
        select: { id: true },
      });
      if (existing) throw AppException.conflict('You are already a member of this workspace');

      const membership = await tx.membership.create({
        data: { tenantId: invitation.tenantId, userId: user.id },
      });
      await tx.membershipRole.create({
        data: {
          membershipId: membership.id,
          roleId: invitation.roleId,
          tenantId: invitation.tenantId,
        },
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.INVITATION_ACCEPTED,
          actorId: user.id,
          tenantId: invitation.tenantId,
          targetType: 'membership',
          targetId: membership.id,
          metadata: { invitationId: invitation.id, role: invitation.role.key },
          meta,
        },
        tx,
      );
    });

    await this.sessions.setActiveTenant(auth.session.id, invitation.tenantId);
    return toTenantContextResponse(
      await this.authorization.resolveTenantContext(user.id, invitation.tenantId),
    );
  }

  private async findUsable(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        tenant: { select: { name: true, status: true } },
        role: { select: { key: true, name: true } },
      },
    });
    if (
      !invitation ||
      effectiveStatus(invitation) !== 'PENDING' ||
      invitation.tenant.status !== 'ACTIVE'
    ) {
      throw AppException.invalidToken('This invitation is invalid, expired or has been revoked');
    }
    return invitation;
  }
}
