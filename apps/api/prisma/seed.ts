/**
 * Deterministic development/test seed. Idempotent: safe to run repeatedly.
 * Refuses to run in production. All accounts share SEED_PASSWORD.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { generateToken, hashToken } from '../src/common/security/crypto';
import { type MembershipStatus, type Plan, PrismaClient } from '../src/generated/prisma/client';
import { PasswordService } from '../src/modules/auth/password.service';
import { provisionTenant, syncPermissionCatalog } from '../src/modules/tenants/tenant-provisioning';

export const SEED_USERS = {
  superAdmin: { email: 'superadmin@platform.test', name: 'Sasha Platform' },
  acmeOwner: { email: 'olivia.owner@acme.test', name: 'Olivia Owner' },
  acmeAdmin: { email: 'adam.admin@acme.test', name: 'Adam Admin' },
  acmeManager: { email: 'maya.manager@acme.test', name: 'Maya Manager' },
  acmeMember: { email: 'mike.member@acme.test', name: 'Mike Member' },
  acmeSuspended: { email: 'sam.suspended@acme.test', name: 'Sam Suspended' },
  globexOwner: { email: 'grace.owner@globex.test', name: 'Grace Owner' },
} as const;

export const SEED_TENANTS = {
  acme: { slug: 'acme', name: 'Acme Inc.', plan: 'PRO' },
  globex: { slug: 'globex', name: 'Globex Corporation', plan: 'FREE' },
} as const satisfies Record<string, { slug: string; name: string; plan: Plan }>;

async function main(): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('Refusing to seed a production database');
  }
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');
  const password = process.env['SEED_PASSWORD'] ?? 'ChangeMe-dev-only-1';

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  const passwords = new PasswordService();
  const passwordHash = await passwords.hash(password);

  try {
    await prisma.$transaction((tx) => syncPermissionCatalog(tx));

    const upsertUser = async (
      user: { email: string; name: string },
      superAdmin = false,
    ): Promise<string> => {
      const record = await prisma.user.upsert({
        where: { email: user.email },
        create: {
          email: user.email,
          name: user.name,
          passwordHash,
          emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
          platformRole: superAdmin ? 'SUPER_ADMIN' : 'USER',
        },
        update: { name: user.name, passwordHash, status: 'ACTIVE' },
      });
      return record.id;
    };
    await upsertUser(SEED_USERS.superAdmin, true);
    const userIds = {
      acmeOwner: await upsertUser(SEED_USERS.acmeOwner),
      acmeAdmin: await upsertUser(SEED_USERS.acmeAdmin),
      acmeManager: await upsertUser(SEED_USERS.acmeManager),
      acmeMember: await upsertUser(SEED_USERS.acmeMember),
      acmeSuspended: await upsertUser(SEED_USERS.acmeSuspended),
      globexOwner: await upsertUser(SEED_USERS.globexOwner),
    };

    const acme = await ensureTenant(prisma, SEED_TENANTS.acme, userIds.acmeOwner);
    const globex = await ensureTenant(prisma, SEED_TENANTS.globex, userIds.globexOwner);

    await ensureMember(prisma, acme, userIds.acmeAdmin, 'admin');
    await ensureMember(prisma, acme, userIds.acmeManager, 'manager');
    await ensureMember(prisma, acme, userIds.acmeMember, 'member');
    await ensureMember(prisma, acme, userIds.acmeSuspended, 'member', 'SUSPENDED');
    // Mike belongs to two tenants with different roles, to exercise tenant switching.
    await ensureMember(prisma, globex, userIds.acmeMember, 'viewer');

    const pending = await prisma.invitation.count({
      where: { tenantId: acme.id, email: 'new.hire@acme.test', status: 'PENDING' },
    });
    const memberRoleId = acme.roleIds['member'];
    if (pending === 0 && memberRoleId) {
      await prisma.invitation.create({
        data: {
          tenantId: acme.id,
          email: 'new.hire@acme.test',
          roleId: memberRoleId,
          tokenHash: hashToken(generateToken()),
          invitedById: userIds.acmeOwner,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    }

    console.log('Seed complete.');
    console.log(`  Tenants: ${SEED_TENANTS.acme.slug}, ${SEED_TENANTS.globex.slug}`);
    console.log(
      `  Users:   ${Object.values(SEED_USERS)
        .map((u) => u.email)
        .join(', ')}`,
    );
    console.log('  Password: value of SEED_PASSWORD (see apps/api/.env)');
  } finally {
    await prisma.$disconnect();
  }
}

interface SeededTenant {
  id: string;
  roleIds: Record<string, string>;
}

async function ensureTenant(
  prisma: PrismaClient,
  input: { slug: string; name: string; plan: Plan },
  ownerUserId: string,
): Promise<SeededTenant> {
  const existing = await prisma.tenant.findUnique({
    where: { slug: input.slug },
    include: { roles: true },
  });
  if (existing) {
    return {
      id: existing.id,
      roleIds: Object.fromEntries(existing.roles.map((r) => [r.key, r.id])),
    };
  }
  return prisma.$transaction(async (tx) => {
    const { tenant, roleIds } = await provisionTenant(tx, { ...input, ownerUserId });
    await tx.auditLog.create({
      data: {
        action: 'tenant.created',
        actorId: ownerUserId,
        tenantId: tenant.id,
        targetType: 'tenant',
        targetId: tenant.id,
      },
    });
    return { id: tenant.id, roleIds };
  });
}

async function ensureMember(
  prisma: PrismaClient,
  tenant: SeededTenant,
  userId: string,
  roleKey: string,
  status: MembershipStatus = 'ACTIVE',
): Promise<void> {
  const roleId = tenant.roleIds[roleKey];
  if (!roleId) throw new Error(`Role ${roleKey} not found`);
  await prisma.$transaction(async (tx) => {
    const membership = await tx.membership.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId } },
      create: { tenantId: tenant.id, userId, status },
      update: { status },
    });
    await tx.membershipRole.deleteMany({ where: { membershipId: membership.id } });
    await tx.membershipRole.create({
      data: { membershipId: membership.id, roleId, tenantId: tenant.id },
    });
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
