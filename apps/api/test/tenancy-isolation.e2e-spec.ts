import { randomUUID } from 'node:crypto';
import { createHarness, type Harness, role } from './helpers/harness';
import { type TestClient } from './helpers/client';

/**
 * Two tenants, each with its own owner. Every test proves that tenant A's credentials can never
 * read or modify tenant B's data, regardless of which IDs the client sends.
 */
describe('Tenant isolation (integration)', () => {
  let h: Harness;
  let acme: Awaited<ReturnType<Harness['createTenant']>>;
  let globex: Awaited<ReturnType<Harness['createTenant']>>;
  let acmeOwner: TestClient;
  let globexMemberId: string;

  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => {
    await h.close();
  });
  beforeEach(async () => {
    await h.reset();
    const alice = await h.createUser({ email: 'alice@acme.test' });
    const gary = await h.createUser({ email: 'gary@globex.test' });
    const gina = await h.createUser({ email: 'gina@globex.test' });
    acme = await h.createTenant('acme', alice.id);
    globex = await h.createTenant('globex', gary.id);
    globexMemberId = await h.addMember(globex.id, gina.id, role(globex.roleIds, 'member'));
    acmeOwner = await h.loginAs('alice@acme.test');
  });

  it('returns the same 403 for another tenant and for a tenant that does not exist', async () => {
    const other = await acmeOwner.get(`/api/v1/tenants/${globex.id}`);
    const missing = await acmeOwner.get(`/api/v1/tenants/${randomUUID()}`);
    const malformed = await acmeOwner.get('/api/v1/tenants/globex');

    for (const res of [other, missing, malformed]) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('TENANT_ACCESS_DENIED');
    }
    expect(other.body.error.message).toBe(missing.body.error.message);
  });

  it.each([
    ['GET', '/members'],
    ['GET', '/roles'],
    ['GET', '/permissions'],
    ['GET', '/invitations'],
    ['GET', '/audit-logs'],
    ['GET', '/billing'],
    ['GET', '/stats'],
    ['GET', '/me'],
  ])('denies %s %s on a foreign tenant', async (_method, path) => {
    const res = await acmeOwner.get(`/api/v1/tenants/${globex.id}${path}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('TENANT_ACCESS_DENIED');
  });

  it('denies writes to a foreign tenant and leaves its data untouched', async () => {
    const attempts = await Promise.all([
      acmeOwner.patch(`/api/v1/tenants/${globex.id}`, { name: 'Pwned' }),
      acmeOwner.post(`/api/v1/tenants/${globex.id}/roles`, {
        name: 'Backdoor',
        permissions: ['members.read'],
      }),
      acmeOwner.post(`/api/v1/tenants/${globex.id}/invitations`, {
        email: 'evil@acme.test',
        roleId: role(globex.roleIds, 'owner'),
      }),
      acmeOwner.put(`/api/v1/tenants/${globex.id}/members/${globexMemberId}/roles`, {
        roleIds: [role(globex.roleIds, 'owner')],
      }),
      acmeOwner.delete(`/api/v1/tenants/${globex.id}/members/${globexMemberId}`),
    ]);
    for (const res of attempts) expect(res.status).toBe(403);

    const tenant = await h.prisma.tenant.findUniqueOrThrow({ where: { id: globex.id } });
    expect(tenant.name).toBe('GLOBEX');
    expect(await h.prisma.role.count({ where: { tenantId: globex.id, key: 'backdoor' } })).toBe(0);
    expect(await h.prisma.invitation.count({ where: { tenantId: globex.id } })).toBe(0);
    expect(await h.prisma.membership.count({ where: { id: globexMemberId } })).toBe(1);
  });

  it('does not resolve a foreign member id through my own tenant (IDOR)', async () => {
    const read = await acmeOwner.get(`/api/v1/tenants/${acme.id}/members/${globexMemberId}`);
    expect(read.status).toBe(404);

    const change = await acmeOwner.put(
      `/api/v1/tenants/${acme.id}/members/${globexMemberId}/roles`,
      {
        roleIds: [role(acme.roleIds, 'viewer')],
      },
    );
    expect(change.status).toBe(404);

    const remove = await acmeOwner.delete(`/api/v1/tenants/${acme.id}/members/${globexMemberId}`);
    expect(remove.status).toBe(404);
    expect(await h.prisma.membership.count({ where: { id: globexMemberId } })).toBe(1);
  });

  it('refuses to assign a role that belongs to another tenant', async () => {
    const bob = await h.createUser({ email: 'bob@acme.test' });
    const bobMembership = await h.addMember(acme.id, bob.id, role(acme.roleIds, 'member'));

    const res = await acmeOwner.put(`/api/v1/tenants/${acme.id}/members/${bobMembership}/roles`, {
      roleIds: [role(globex.roleIds, 'admin')],
    });
    expect(res.status).toBe(400);
    expect(
      await h.prisma.membershipRole.count({
        where: { membershipId: bobMembership, roleId: role(globex.roleIds, 'admin') },
      }),
    ).toBe(0);
  });

  it('refuses to invite into my tenant with a foreign role id', async () => {
    const res = await acmeOwner.post(`/api/v1/tenants/${acme.id}/invitations`, {
      email: 'new@acme.test',
      roleId: role(globex.roleIds, 'member'),
    });
    expect(res.status).toBe(400);
    expect(await h.prisma.invitation.count()).toBe(0);
  });

  it('database rejects a membership-role row that mixes tenants (composite foreign key)', async () => {
    const bob = await h.createUser({ email: 'bob@acme.test' });
    const bobMembership = await h.addMember(acme.id, bob.id, role(acme.roleIds, 'member'));
    await expect(
      h.prisma.membershipRole.create({
        data: {
          membershipId: bobMembership,
          roleId: role(globex.roleIds, 'admin'),
          tenantId: acme.id,
        },
      }),
    ).rejects.toThrow();
  });

  it('lists only data of the requested tenant', async () => {
    const members = await acmeOwner.get(`/api/v1/tenants/${acme.id}/members`);
    expect(members.status).toBe(200);
    expect(members.body.data.map((m: { user: { email: string } }) => m.user.email)).toEqual([
      'alice@acme.test',
    ]);

    const roles = await acmeOwner.get(`/api/v1/tenants/${acme.id}/roles`);
    const roleIds = new Set((roles.body as { id: string }[]).map((r) => r.id));
    for (const id of Object.values(globex.roleIds)) expect(roleIds.has(id)).toBe(false);

    const logs = await acmeOwner.get(`/api/v1/tenants/${acme.id}/audit-logs`);
    for (const entry of logs.body.data as { tenantId?: string | null }[]) {
      if (entry.tenantId !== undefined) expect(entry.tenantId).toBe(acme.id);
    }
  });

  it('ignores tenant ids smuggled in headers, query strings or bodies', async () => {
    const viaQuery = await acmeOwner.get(
      `/api/v1/tenants/${acme.id}/members?tenantId=${globex.id}`,
    );
    expect(viaQuery.status).toBe(400);

    const viaHeader = await acmeOwner.get(`/api/v1/tenants/${globex.id}/members`, {
      'X-Tenant-Id': globex.id,
      'X-Tenant-Slug': 'globex',
      'X-Role': 'owner',
    });
    expect(viaHeader.status).toBe(403);

    const viaBody = await acmeOwner.patch(`/api/v1/tenants/${acme.id}`, {
      name: 'Acme 2',
      tenantId: globex.id,
    });
    expect(viaBody.status).toBe(400);
    expect(viaBody.body.error.code).toBe('VALIDATION_ERROR');
    expect((await h.prisma.tenant.findUniqueOrThrow({ where: { id: globex.id } })).name).toBe(
      'GLOBEX',
    );
  });

  it('cannot switch the active tenant to one the user does not belong to', async () => {
    const res = await acmeOwner.post('/api/v1/auth/active-tenant', { tenantId: globex.id });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('TENANT_ACCESS_DENIED');
    expect((await acmeOwner.post('/api/v1/auth/active-tenant', { tenantId: acme.id })).status).toBe(
      200,
    );
  });

  it('suspended memberships and suspended tenants lose access immediately', async () => {
    const gina = await h.loginAs('gina@globex.test');
    expect((await gina.get(`/api/v1/tenants/${globex.id}`)).status).toBe(200);

    await h.prisma.membership.update({
      where: { id: globexMemberId },
      data: { status: 'SUSPENDED' },
    });
    expect((await gina.get(`/api/v1/tenants/${globex.id}`)).status).toBe(403);

    await h.prisma.membership.update({ where: { id: globexMemberId }, data: { status: 'ACTIVE' } });
    await h.prisma.tenant.update({ where: { id: globex.id }, data: { status: 'SUSPENDED' } });
    expect((await gina.get(`/api/v1/tenants/${globex.id}`)).status).toBe(403);
  });

  it('a platform super admin has no implicit tenant access', async () => {
    await h.createUser({ email: 'root@platform.test', platformRole: 'SUPER_ADMIN' });
    const admin = await h.loginAs('root@platform.test');
    expect((await admin.get(`/api/v1/tenants/${acme.id}/members`)).status).toBe(403);
    expect((await admin.get('/api/v1/platform/tenants')).status).toBe(200);
  });
});
