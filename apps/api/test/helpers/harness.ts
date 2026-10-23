import { type Server } from 'node:http';
import { type INestApplication } from '@nestjs/common';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { type MembershipStatus, type PlatformRole } from '../../src/generated/prisma/client';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { PrismaService } from '../../src/database/prisma.service';
import { PasswordService } from '../../src/modules/auth/password.service';
import { MAIL_TRANSPORT, MemoryMailTransport } from '../../src/modules/mail/mail.transport';
import { provisionTenant } from '../../src/modules/tenants/tenant-provisioning';
import { TestClient } from './client';

export const PASSWORD = 'Correct-horse-battery-1';
export const ORIGIN = 'http://localhost:3000';

export interface Harness {
  app: INestApplication;
  server: Server;
  prisma: PrismaService;
  mail: MemoryMailTransport;
  client(): TestClient;
  reset(): Promise<void>;
  createUser(input: {
    email: string;
    name?: string;
    verified?: boolean;
    platformRole?: PlatformRole;
  }): Promise<{ id: string; email: string }>;
  createTenant(
    slug: string,
    ownerId: string,
  ): Promise<{ id: string; roleIds: Record<string, string>; ownerMembershipId: string }>;
  addMember(
    tenantId: string,
    userId: string,
    roleId: string,
    status?: MembershipStatus,
  ): Promise<string>;
  loginAs(email: string, password?: string): Promise<TestClient>;
  close(): Promise<void>;
}

export async function createHarness(): Promise<Harness> {
  const mail = new MemoryMailTransport();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MAIL_TRANSPORT)
    .useValue(mail)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  configureApp(app);
  await app.init();

  const prisma = app.get(PrismaService);
  const passwordHash = await new PasswordService().hash(PASSWORD);
  const server: Server = app.getHttpServer();

  const harness: Harness = {
    app,
    server,
    prisma,
    mail,
    client: () => new TestClient(server, ORIGIN),

    async reset() {
      mail.clear();
      // Permissions are a global catalog synced at bootstrap; everything else is wiped between tests.
      await prisma.$executeRawUnsafe(
        'TRUNCATE TABLE "audit_logs", "invitations", "membership_roles", "memberships", "role_permissions", "roles", "sessions", "user_tokens", "tenants", "users" CASCADE',
      );
    },

    async createUser({ email, name, verified = true, platformRole = 'USER' }) {
      return prisma.user.create({
        data: {
          email,
          name: name ?? email.split('@')[0] ?? email,
          passwordHash,
          emailVerifiedAt: verified ? new Date() : null,
          platformRole,
        },
        select: { id: true, email: true },
      });
    },

    async createTenant(slug, ownerId) {
      const { tenant, roleIds, membershipId } = await prisma.$transaction((tx) =>
        provisionTenant(tx, { name: slug.toUpperCase(), slug, ownerUserId: ownerId }),
      );
      return { id: tenant.id, roleIds, ownerMembershipId: membershipId };
    },

    async addMember(tenantId, userId, roleId, status = 'ACTIVE') {
      const membership = await prisma.membership.create({ data: { tenantId, userId, status } });
      await prisma.membershipRole.create({
        data: { membershipId: membership.id, roleId, tenantId },
      });
      return membership.id;
    },

    async loginAs(email, password = PASSWORD) {
      const client = harness.client();
      const res = await client.post('/api/v1/auth/login', { email, password });
      if (res.status !== 200)
        throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
      return client;
    },

    async close() {
      await app.close();
    },
  };
  return harness;
}

export function role(roleIds: Record<string, string>, key: string): string {
  const id = roleIds[key];
  if (!id) throw new Error(`role ${key} not provisioned`);
  return id;
}
