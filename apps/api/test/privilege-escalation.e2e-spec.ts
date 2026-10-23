import { createHarness, type Harness, role } from './helpers/harness';
import { type TestClient } from './helpers/client';

/**
 * Acme has an owner, an admin (everything except billing.manage), a manager (can invite) and a
 * plain member. Each test attempts to gain or grant more access than the actor holds.
 */
describe('Privilege escalation (integration)', () => {
  let h: Harness;
  let tenant: Awaited<ReturnType<Harness['createTenant']>>;
  let owner: TestClient;
  let admin: TestClient;
  let manager: TestClient;
  let member: TestClient;
  let adminMembership: string;
  let managerMembership: string;
  let memberMembership: string;
  let base: string;

  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => {
    await h.close();
  });
  beforeEach(async () => {
    await h.reset();
    const o = await h.createUser({ email: 'owner@acme.test' });
    const a = await h.createUser({ email: 'admin@acme.test' });
    const mg = await h.createUser({ email: 'manager@acme.test' });
    const m = await h.createUser({ email: 'member@acme.test' });
    tenant = await h.createTenant('acme', o.id);
    adminMembership = await h.addMember(tenant.id, a.id, role(tenant.roleIds, 'admin'));
    managerMembership = await h.addMember(tenant.id, mg.id, role(tenant.roleIds, 'manager'));
    memberMembership = await h.addMember(tenant.id, m.id, role(tenant.roleIds, 'member'));
    [owner, admin, manager, member] = await Promise.all([
      h.loginAs('owner@acme.test'),
      h.loginAs('admin@acme.test'),
      h.loginAs('manager@acme.test'),
      h.loginAs('member@acme.test'),
    ]);
    base = `/api/v1/tenants/${tenant.id}`;
  });

  describe('permission checks', () => {
    it('a member cannot use endpoints that need permissions they lack', async () => {
      const results = await Promise.all([
        member.patch(base, { name: 'Hijacked' }),
        member.post(`${base}/roles`, { name: 'Mine', permissions: [] }),
        member.post(`${base}/invitations`, {
          email: 'x@acme.test',
          roleId: role(tenant.roleIds, 'viewer'),
        }),
        member.get(`${base}/audit-logs`),
        member.delete(`${base}/members/${managerMembership}`),
      ]);
      for (const res of results) {
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      }
    });

    it('client-supplied role or permission claims are ignored', async () => {
      const res = await member.get(`${base}/audit-logs`, {
        'X-Role': 'owner',
        'X-Permissions': 'audit_logs.read',
      });
      expect(res.status).toBe(403);
    });

    it('a member cannot change their own roles', async () => {
      const res = await member.put(`${base}/members/${memberMembership}/roles`, {
        roleIds: [role(tenant.roleIds, 'owner')],
      });
      expect(res.status).toBe(403);
    });
  });

  describe('role assignment', () => {
    it('only owners can assign the owner role', async () => {
      const res = await admin.put(`${base}/members/${memberMembership}/roles`, {
        roleIds: [role(tenant.roleIds, 'owner')],
      });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PRIVILEGE_ESCALATION');

      const ok = await owner.put(`${base}/members/${memberMembership}/roles`, {
        roleIds: [role(tenant.roleIds, 'owner')],
      });
      expect(ok.status).toBe(200);
      expect(ok.body.roles.map((r: { key: string }) => r.key)).toEqual(['owner']);
    });

    it('an admin cannot assign their own role to themselves or change their own membership', async () => {
      const res = await admin.put(`${base}/members/${adminMembership}/roles`, {
        roleIds: [role(tenant.roleIds, 'owner')],
      });
      expect(res.status).toBe(403);
    });

    it('an admin cannot manage an owner', async () => {
      const ownerMembership = tenant.ownerMembershipId;
      const demote = await admin.put(`${base}/members/${ownerMembership}/roles`, {
        roleIds: [role(tenant.roleIds, 'viewer')],
      });
      const suspend = await admin.patch(`${base}/members/${ownerMembership}`, {
        status: 'SUSPENDED',
      });
      const remove = await admin.delete(`${base}/members/${ownerMembership}`);
      for (const res of [demote, suspend, remove]) {
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('PRIVILEGE_ESCALATION');
      }
    });

    it('an admin cannot assign a custom role holding permissions the admin lacks', async () => {
      const billingRole = await owner.post(`${base}/roles`, {
        name: 'Billing',
        permissions: ['billing.manage', 'tenant.read'],
      });
      expect(billingRole.status).toBe(201);

      const res = await admin.put(`${base}/members/${memberMembership}/roles`, {
        roleIds: [billingRole.body.id],
      });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PRIVILEGE_ESCALATION');
    });

    it('an admin cannot manage a member who holds permissions beyond the admin', async () => {
      const billingRole = await owner.post(`${base}/roles`, {
        name: 'Billing',
        permissions: ['billing.manage'],
      });
      await owner.put(`${base}/members/${memberMembership}/roles`, {
        roleIds: [role(tenant.roleIds, 'member'), billingRole.body.id],
      });

      const res = await admin.patch(`${base}/members/${memberMembership}`, { status: 'SUSPENDED' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PRIVILEGE_ESCALATION');
    });
  });

  describe('role editing', () => {
    it('cannot create a role with permissions the actor does not hold', async () => {
      const res = await admin.post(`${base}/roles`, {
        name: 'Super',
        permissions: ['billing.manage'],
      });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PRIVILEGE_ESCALATION');
    });

    it('cannot add permissions beyond the actor to an existing role', async () => {
      const res = await admin.patch(`${base}/roles/${role(tenant.roleIds, 'member')}`, {
        permissions: ['tenant.read', 'members.read', 'billing.manage'],
      });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PRIVILEGE_ESCALATION');
    });

    it('nobody can edit or delete the owner role', async () => {
      const edit = await owner.patch(`${base}/roles/${role(tenant.roleIds, 'owner')}`, {
        permissions: ['tenant.read'],
      });
      expect(edit.status).toBe(403);
      const del = await owner.delete(`${base}/roles/${role(tenant.roleIds, 'owner')}`);
      expect([400, 403, 409]).toContain(del.status);
      expect(await h.prisma.role.count({ where: { id: role(tenant.roleIds, 'owner') } })).toBe(1);
    });

    it('rejects unknown permission keys', async () => {
      const res = await owner.post(`${base}/roles`, {
        name: 'Weird',
        permissions: ['platform.super'],
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('last-owner protection', () => {
    it('with two owners one may be demoted, but the remaining last owner cannot leave', async () => {
      const second = await h.createUser({ email: 'owner2@acme.test' });
      const secondMembership = await h.addMember(
        tenant.id,
        second.id,
        role(tenant.roleIds, 'owner'),
      );
      const owner2 = await h.loginAs('owner2@acme.test');

      expect(
        (
          await owner2.put(`${base}/members/${tenant.ownerMembershipId}/roles`, {
            roleIds: [role(tenant.roleIds, 'admin')],
          })
        ).status,
      ).toBe(200);

      const leave = await owner2.post(`${base}/leave`);
      expect(leave.status).toBe(409);
      expect(await h.prisma.membership.count({ where: { id: secondMembership } })).toBe(1);
    });

    it('the sole owner cannot leave the workspace', async () => {
      const res = await owner.post(`${base}/leave`);
      expect(res.status).toBe(409);
      expect(await h.prisma.membership.count({ where: { id: tenant.ownerMembershipId } })).toBe(1);
    });

    it('concurrent demotion of the two remaining owners never leaves the tenant ownerless', async () => {
      const second = await h.createUser({ email: 'owner2@acme.test' });
      const secondMembership = await h.addMember(
        tenant.id,
        second.id,
        role(tenant.roleIds, 'owner'),
      );
      const owner2 = await h.loginAs('owner2@acme.test');
      const adminRole = role(tenant.roleIds, 'admin');

      const results = await Promise.all([
        owner.put(`${base}/members/${secondMembership}/roles`, { roleIds: [adminRole] }),
        owner2.put(`${base}/members/${tenant.ownerMembershipId}/roles`, { roleIds: [adminRole] }),
      ]);
      expect(results.filter((r) => r.status === 200).length).toBeLessThanOrEqual(1);
      for (const res of results.filter((r) => r.status !== 200))
        expect([403, 409]).toContain(res.status);
      const owners = await h.prisma.membership.count({
        where: {
          tenantId: tenant.id,
          status: 'ACTIVE',
          roles: { some: { role: { key: 'owner' } } },
        },
      });
      expect(owners).toBeGreaterThanOrEqual(1);
    });
  });

  describe('invitations', () => {
    it('a manager can invite with a role inside their scope but not above it', async () => {
      const ok = await manager.post(`${base}/invitations`, {
        email: 'viewer@new.test',
        roleId: role(tenant.roleIds, 'viewer'),
      });
      expect(ok.status).toBe(201);

      const adminInvite = await manager.post(`${base}/invitations`, {
        email: 'admin@new.test',
        roleId: role(tenant.roleIds, 'admin'),
      });
      expect(adminInvite.status).toBe(403);
      expect(adminInvite.body.error.code).toBe('PRIVILEGE_ESCALATION');

      const ownerInvite = await manager.post(`${base}/invitations`, {
        email: 'owner@new.test',
        roleId: role(tenant.roleIds, 'owner'),
      });
      expect(ownerInvite.status).toBe(403);
    });

    it('accepting an invitation grants exactly the invited role and requires the invited email', async () => {
      await owner.post(`${base}/invitations`, {
        email: 'new@acme.test',
        roleId: role(tenant.roleIds, 'viewer'),
      });
      const token = /token=([A-Za-z0-9_-]+)/.exec(h.mail.lastTo('new@acme.test')?.text ?? '')?.[1];
      expect(token).toBeDefined();

      const intruder = await h.createUser({ email: 'intruder@evil.test' });
      const intruderClient = await h.loginAs('intruder@evil.test');
      const stolen = await intruderClient.post('/api/v1/invitations/accept', { token });
      expect(stolen.status).toBe(403);
      expect(await h.prisma.membership.count({ where: { userId: intruder.id } })).toBe(0);

      await h.createUser({ email: 'new@acme.test' });
      const invitee = await h.loginAs('new@acme.test');
      const accepted = await invitee.post('/api/v1/invitations/accept', {
        token,
        roleId: role(tenant.roleIds, 'owner'),
      });
      expect(accepted.status).toBe(400);

      const ok = await invitee.post('/api/v1/invitations/accept', { token });
      expect(ok.status).toBe(200);
      expect(ok.body.roles.map((r: { key: string }) => r.key)).toEqual(['viewer']);

      const replay = await invitee.post('/api/v1/invitations/accept', { token });
      expect(replay.status).toBeGreaterThanOrEqual(400);
    });

    it('a revoked invitation cannot be accepted', async () => {
      const created = await owner.post(`${base}/invitations`, {
        email: 'new@acme.test',
        roleId: role(tenant.roleIds, 'viewer'),
      });
      const token = /token=([A-Za-z0-9_-]+)/.exec(h.mail.lastTo('new@acme.test')?.text ?? '')?.[1];
      expect((await owner.post(`${base}/invitations/${created.body.id}/revoke`)).status).toBe(200);

      await h.createUser({ email: 'new@acme.test' });
      const invitee = await h.loginAs('new@acme.test');
      const res = await invitee.post('/api/v1/invitations/accept', { token });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('platform administration', () => {
    it('tenant owners cannot reach platform endpoints', async () => {
      for (const path of [
        '/api/v1/platform/tenants',
        '/api/v1/platform/users',
        '/api/v1/platform/audit-logs',
      ]) {
        const res = await owner.get(path);
        expect(res.status).toBe(403);
      }
    });

    it('tenant owners cannot delete tenants through the platform API', async () => {
      const res = await owner.delete(`/api/v1/platform/tenants/${tenant.id}`);
      expect(res.status).toBe(403);
    });

    it('platform role cannot be self-assigned through the profile endpoint', async () => {
      const res = await owner.patch('/api/v1/users/me', {
        name: 'Owner',
        platformRole: 'SUPER_ADMIN',
      });
      expect(res.status).toBe(400);
      const me = await owner.get('/api/v1/auth/me');
      expect(me.body.user.platformRole).toBe('USER');
    });
  });
});
