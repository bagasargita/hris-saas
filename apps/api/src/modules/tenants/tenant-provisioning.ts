import { randomBytes } from 'node:crypto';
import { DEFAULT_TENANT_ROLES, PERMISSION_DEFINITIONS, SYSTEM_ROLE_KEYS } from '@saas/contracts';
import { type Plan, type Prisma, type Tenant } from '../../generated/prisma/client';

/** Idempotently syncs the permission catalog from @saas/contracts into the database. */
export async function syncPermissionCatalog(tx: Prisma.TransactionClient): Promise<void> {
  for (const definition of PERMISSION_DEFINITIONS) {
    await tx.permission.upsert({
      where: { key: definition.key },
      create: { key: definition.key, group: definition.group, description: definition.description },
      update: { group: definition.group, description: definition.description },
    });
  }
}

export interface ProvisionTenantInput {
  name: string;
  slug: string;
  ownerUserId: string;
  plan?: Plan;
}

export interface ProvisionedTenant {
  tenant: Tenant;
  membershipId: string;
  roleIds: Record<string, string>;
}

/**
 * Creates a tenant with its default roles and makes the given user its owner.
 * Must run inside a transaction so a tenant never exists without an owner.
 */
export async function provisionTenant(
  tx: Prisma.TransactionClient,
  input: ProvisionTenantInput,
): Promise<ProvisionedTenant> {
  const tenant = await tx.tenant.create({
    data: { name: input.name, slug: input.slug, plan: input.plan ?? 'FREE' },
  });

  const permissions = await tx.permission.findMany({ select: { id: true, key: true } });
  const permissionIdByKey = new Map(permissions.map((p) => [p.key, p.id]));

  const roleIds: Record<string, string> = {};
  for (const definition of DEFAULT_TENANT_ROLES) {
    const role = await tx.role.create({
      data: {
        tenantId: tenant.id,
        key: definition.key,
        name: definition.name,
        description: definition.description,
        isSystem: true,
        permissions: {
          create: definition.permissions.map((key) => {
            const permissionId = permissionIdByKey.get(key);
            if (!permissionId)
              throw new Error(
                `Permission ${key} missing from catalog; run syncPermissionCatalog first`,
              );
            return { permissionId };
          }),
        },
      },
    });
    roleIds[definition.key] = role.id;
  }

  const ownerRoleId = roleIds[SYSTEM_ROLE_KEYS.OWNER];
  if (!ownerRoleId) throw new Error('Owner role was not provisioned');

  const membership = await tx.membership.create({
    data: { tenantId: tenant.id, userId: input.ownerUserId },
  });
  await tx.membershipRole.create({
    data: { membershipId: membership.id, roleId: ownerRoleId, tenantId: tenant.id },
  });

  return { tenant, membershipId: membership.id, roleIds };
}

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

export function withRandomSuffix(slug: string): string {
  return `${slug.slice(0, 40).replace(/-+$/g, '')}-${randomBytes(3).toString('hex')}`;
}

export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return slug || 'workspace';
}
