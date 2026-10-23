import { Injectable } from '@nestjs/common';
import { isPermissionKey, type RoleDto, SYSTEM_ROLE_KEYS } from '@saas/contracts';
import { AppException } from '../../common/errors/app-exception';
import { type RequestMeta, type TenantContext } from '../../common/http/request-context';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { AUDIT_ACTIONS, AuditLogService } from '../audit-logs/audit-log.service';
import {
  actorScope,
  assertCanEditRole,
  assertCanGrantPermissions,
} from '../permissions/authorization.policy';
import { slugify } from '../tenants/tenant-provisioning';
import { type CreateRoleDto, type UpdateRoleDto } from './roles.dto';

const roleInclude = {
  permissions: { select: { permission: { select: { key: true } } } },
  _count: { select: { memberships: true } },
} satisfies Prisma.RoleInclude;

type RoleRow = Prisma.RoleGetPayload<{ include: typeof roleInclude }>;

const RESERVED_KEYS = new Set<string>(Object.values(SYSTEM_ROLE_KEYS));

function permissionKeys(row: RoleRow): string[] {
  return row.permissions.map((p) => p.permission.key);
}

function toRoleDto(row: RoleRow): RoleDto {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    isSystem: row.isSystem,
    permissions: permissionKeys(row).filter(isPermissionKey).sort(),
    memberCount: row._count.memberships,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(tenantId: string): Promise<RoleDto[]> {
    const rows = await this.prisma.role.findMany({
      where: { tenantId },
      include: roleInclude,
      orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
    });
    return rows.map(toRoleDto);
  }

  async get(tenantId: string, roleId: string): Promise<RoleDto> {
    return toRoleDto(await this.findOrThrow(tenantId, roleId));
  }

  async create(
    context: TenantContext,
    actorId: string,
    dto: CreateRoleDto,
    meta: RequestMeta,
  ): Promise<RoleDto> {
    assertCanGrantPermissions(actorScope(context), dto.permissions);
    const tenantId = context.tenant.id;
    const key = dto.key ?? slugify(dto.name).slice(0, 40);
    if (RESERVED_KEYS.has(key))
      throw AppException.badRequest(`"${key}" is reserved for a default role`);

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const permissionIds = await this.permissionIds(tx, dto.permissions);
        const role = await tx.role.create({
          data: {
            tenantId,
            key,
            name: dto.name,
            description: dto.description ?? null,
            permissions: { create: permissionIds.map((permissionId) => ({ permissionId })) },
          },
          include: roleInclude,
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.ROLE_CREATED,
            actorId,
            tenantId,
            targetType: 'role',
            targetId: role.id,
            metadata: { key, permissions: dto.permissions },
            meta,
          },
          tx,
        );
        return role;
      });
      return toRoleDto(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw AppException.conflict('A role with this key already exists');
      }
      throw error;
    }
  }

  async update(
    context: TenantContext,
    actorId: string,
    roleId: string,
    dto: UpdateRoleDto,
    meta: RequestMeta,
  ): Promise<RoleDto> {
    const tenantId = context.tenant.id;
    const row = await this.prisma.$transaction(
      async (tx) => {
        const existing = await this.findOrThrow(tenantId, roleId, tx);
        assertCanEditRole(
          actorScope(context),
          { key: existing.key, permissions: permissionKeys(existing) },
          dto.permissions,
        );

        if (dto.permissions) {
          const permissionIds = await this.permissionIds(tx, dto.permissions);
          await tx.rolePermission.deleteMany({ where: { roleId } });
          await tx.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
          });
        }
        const updated = await tx.role.update({
          where: { id: roleId },
          data: {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.description !== undefined ? { description: dto.description } : {}),
          },
          include: roleInclude,
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.ROLE_UPDATED,
            actorId,
            tenantId,
            targetType: 'role',
            targetId: roleId,
            metadata: {
              ...(dto.name !== undefined ? { name: dto.name } : {}),
              ...(dto.permissions
                ? { permissionsBefore: permissionKeys(existing), permissionsAfter: dto.permissions }
                : {}),
            },
            meta,
          },
          tx,
        );
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return toRoleDto(row);
  }

  async remove(
    context: TenantContext,
    actorId: string,
    roleId: string,
    meta: RequestMeta,
  ): Promise<void> {
    const tenantId = context.tenant.id;
    await this.prisma.$transaction(
      async (tx) => {
        const existing = await this.findOrThrow(tenantId, roleId, tx);
        if (existing.isSystem) throw AppException.forbidden('Default roles cannot be deleted');
        assertCanEditRole(actorScope(context), {
          key: existing.key,
          permissions: permissionKeys(existing),
        });
        if (existing._count.memberships > 0) {
          throw AppException.conflict(
            'This role is still assigned to members. Reassign them first.',
          );
        }
        const pending = await tx.invitation.count({
          where: { roleId, tenantId, status: 'PENDING' },
        });
        if (pending > 0)
          throw AppException.conflict(
            'This role is used by pending invitations. Revoke them first.',
          );

        await tx.role.delete({ where: { id: roleId } });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.ROLE_DELETED,
            actorId,
            tenantId,
            targetType: 'role',
            targetId: roleId,
            metadata: { key: existing.key, name: existing.name },
            meta,
          },
          tx,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /** Scoped lookup: a role id belonging to another tenant is reported as not found. */
  private async findOrThrow(
    tenantId: string,
    roleId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<RoleRow> {
    const row = await tx.role.findFirst({ where: { id: roleId, tenantId }, include: roleInclude });
    if (!row) throw AppException.notFound('Role not found');
    return row;
  }

  private async permissionIds(
    tx: Prisma.TransactionClient,
    keys: readonly string[],
  ): Promise<string[]> {
    const permissions = await tx.permission.findMany({
      where: { key: { in: [...keys] } },
      select: { id: true },
    });
    if (permissions.length !== keys.length) throw AppException.badRequest('Unknown permission');
    return permissions.map((p) => p.id);
  }
}
