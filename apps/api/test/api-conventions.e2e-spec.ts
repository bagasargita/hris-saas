import request from 'supertest';
import { AuditLogService } from '../src/modules/audit-logs/audit-log.service';
import { createHarness, type Harness, role } from './helpers/harness';

describe('API conventions (integration)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => {
    await h.close();
  });
  beforeEach(async () => {
    await h.reset();
  });

  describe('health', () => {
    it('reports liveness and readiness without authentication', async () => {
      const server = h.server;
      const live = await request(server).get('/api/v1/health');
      expect(live.status).toBe(200);
      expect(live.body.status).toBe('ok');
      const ready = await request(server).get('/api/v1/health/ready');
      expect(ready.status).toBe(200);
      expect(ready.body).toEqual({ status: 'ok', checks: { database: 'up' } });
    });
  });

  describe('errors and request ids', () => {
    it('uses the standard error envelope with a request id that echoes a valid incoming id', async () => {
      const res = await request(h.server)
        .get('/api/v1/auth/me')
        .set('X-Request-Id', 'test-req-123');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: expect.objectContaining({
          code: 'UNAUTHENTICATED',
          statusCode: 401,
          message: expect.any(String),
          requestId: 'test-req-123',
        }),
      });
      expect(res.headers['x-request-id']).toBe('test-req-123');
    });

    it('generates a request id when the incoming one is unsafe', async () => {
      // Use a value Node's HTTP client will send (no CR/LF) but that fails our allow-list
      // (`^[A-Za-z0-9._-]{8,128}$`). Newlines are rejected by Node before the request leaves.
      const res = await request(h.server)
        .get('/api/v1/health')
        .set('X-Request-Id', 'bad id with spaces');
      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('returns 404 in the standard format for unknown routes', async () => {
      const res = await request(h.server).get('/api/v1/does-not-exist');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('sets security and caching headers', async () => {
      const res = await request(h.server).get('/api/v1/health');
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['cache-control']).toContain('no-store');
    });

    it('does not reflect disallowed CORS origins', async () => {
      const res = await request(h.server)
        .get('/api/v1/health')
        .set('Origin', 'https://evil.example');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      const ok = await request(h.server)
        .get('/api/v1/health')
        .set('Origin', 'http://localhost:3000');
      expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(ok.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('validation', () => {
    it('returns field-level details for invalid input', async () => {
      const res = await h
        .client()
        .post('/api/v1/auth/register', { email: 'not-an-email', password: 'short', name: '' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const fields = (res.body.error.details as { field: string }[]).map((d) => d.field).sort();
      expect(fields).toEqual(expect.arrayContaining(['email', 'password']));
    });

    it('rejects unknown properties (mass assignment)', async () => {
      const res = await h.client().post('/api/v1/auth/register', {
        name: 'Eve',
        email: 'eve@example.test',
        password: 'a-strong-password-1',
        platformRole: 'SUPER_ADMIN',
        emailVerifiedAt: new Date().toISOString(),
      });
      expect(res.status).toBe(400);
      expect(await h.prisma.user.count()).toBe(0);
    });

    it('rejects malformed UUID path parameters', async () => {
      const user = await h.createUser({ email: 'alice@acme.test' });
      const tenant = await h.createTenant('acme', user.id);
      const client = await h.loginAs('alice@acme.test');
      const res = await client.get(`/api/v1/tenants/${tenant.id}/members/not-a-uuid`);
      expect(res.status).toBe(400);
    });
  });

  describe('pagination', () => {
    it('paginates, sorts and filters members with a stable meta block', async () => {
      const owner = await h.createUser({ email: 'owner@acme.test', name: 'Owner' });
      const tenant = await h.createTenant('acme', owner.id);
      for (let i = 0; i < 24; i++) {
        const u = await h.createUser({
          email: `user${String(i).padStart(2, '0')}@acme.test`,
          name: `User ${String(i).padStart(2, '0')}`,
        });
        await h.addMember(tenant.id, u.id, role(tenant.roleIds, i % 2 === 0 ? 'member' : 'viewer'));
      }
      const client = await h.loginAs('owner@acme.test');
      const base = `/api/v1/tenants/${tenant.id}/members`;

      const page1 = await client.get(`${base}?page=1&limit=10&sortBy=email&sortOrder=asc`);
      expect(page1.status).toBe(200);
      expect(page1.body.meta).toEqual({ page: 1, limit: 10, total: 25, totalPages: 3 });
      expect(page1.body.data).toHaveLength(10);
      expect(page1.body.data[0].user.email).toBe('owner@acme.test');

      const page3 = await client.get(`${base}?page=3&limit=10&sortBy=email&sortOrder=asc`);
      expect(page3.body.data).toHaveLength(5);

      const all = [
        ...page1.body.data,
        ...(await client.get(`${base}?page=2&limit=10&sortBy=email&sortOrder=asc`)).body.data,
        ...page3.body.data,
      ];
      expect(new Set(all.map((m: { id: string }) => m.id)).size).toBe(25);

      const beyond = await client.get(`${base}?page=99&limit=10`);
      expect(beyond.body.data).toEqual([]);
      expect(beyond.body.meta.total).toBe(25);

      const search = await client.get(`${base}?search=user 0`);
      expect(search.body.meta.total).toBe(10);

      const filtered = await client.get(`${base}?roleId=${role(tenant.roleIds, 'viewer')}`);
      expect(filtered.body.meta.total).toBe(12);
    });

    it.each([
      ['limit=0', 400],
      ['limit=101', 400],
      ['page=0', 400],
      ['page=abc', 400],
      ['sortBy=passwordHash', 400],
      ['sortOrder=sideways', 400],
    ])('rejects invalid pagination parameter %s', async (query, status) => {
      const owner = await h.createUser({ email: 'owner@acme.test' });
      const tenant = await h.createTenant('acme', owner.id);
      const client = await h.loginAs('owner@acme.test');
      const res = await client.get(`/api/v1/tenants/${tenant.id}/members?${query}`);
      expect(res.status).toBe(status);
    });
  });

  describe('transactions', () => {
    it('rolls back tenant creation completely if any step fails', async () => {
      await h.createUser({ email: 'alice@acme.test' });
      const client = await h.loginAs('alice@acme.test');
      const audit = h.app.get(AuditLogService);
      const spy = jest.spyOn(audit, 'record').mockRejectedValueOnce(new Error('simulated failure'));

      const res = await client.post('/api/v1/tenants', { name: 'Doomed Inc', slug: 'doomed' });
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL_ERROR');
      expect(res.body.error.message).not.toContain('simulated');
      spy.mockRestore();

      expect(await h.prisma.tenant.count({ where: { slug: 'doomed' } })).toBe(0);
      expect(await h.prisma.role.count()).toBe(0);
      expect(await h.prisma.membership.count()).toBe(0);

      const retry = await client.post('/api/v1/tenants', { name: 'Doomed Inc', slug: 'doomed' });
      expect(retry.status).toBe(201);
      expect(retry.body.roles.map((r: { key: string }) => r.key)).toEqual(['owner']);
    });

    it('rolls back role changes if the audit write fails', async () => {
      const owner = await h.createUser({ email: 'owner@acme.test' });
      const bob = await h.createUser({ email: 'bob@acme.test' });
      const tenant = await h.createTenant('acme', owner.id);
      const bobMembership = await h.addMember(tenant.id, bob.id, role(tenant.roleIds, 'member'));
      const client = await h.loginAs('owner@acme.test');
      const spy = jest
        .spyOn(h.app.get(AuditLogService), 'record')
        .mockRejectedValueOnce(new Error('boom'));

      const res = await client.put(`/api/v1/tenants/${tenant.id}/members/${bobMembership}/roles`, {
        roleIds: [role(tenant.roleIds, 'admin')],
      });
      expect(res.status).toBe(500);
      spy.mockRestore();

      const roles = await h.prisma.membershipRole.findMany({
        where: { membershipId: bobMembership },
        include: { role: true },
      });
      expect(roles.map((r) => r.role.key)).toEqual(['member']);
    });

    it('rejects a duplicate explicit slug with 409 and creates nothing', async () => {
      await h.createUser({ email: 'alice@acme.test' });
      const client = await h.loginAs('alice@acme.test');
      expect((await client.post('/api/v1/tenants', { name: 'Acme', slug: 'acme' })).status).toBe(
        201,
      );
      const dup = await client.post('/api/v1/tenants', { name: 'Acme 2', slug: 'acme' });
      expect(dup.status).toBe(409);
      expect(await h.prisma.tenant.count()).toBe(1);
    });
  });

  describe('billing boundary', () => {
    it('reports the plan and refuses checkout explicitly when no provider is configured', async () => {
      const owner = await h.createUser({ email: 'owner@acme.test' });
      const tenant = await h.createTenant('acme', owner.id);
      const client = await h.loginAs('owner@acme.test');
      const billing = await client.get(`/api/v1/tenants/${tenant.id}/billing`);
      expect(billing.status).toBe(200);
      expect(billing.body.plan).toBe('FREE');
      const checkout = await client.post(`/api/v1/tenants/${tenant.id}/billing/checkout`, {
        plan: 'PRO',
      });
      expect(checkout.status).toBe(501);
      expect(checkout.body.error.code).toBe('NOT_IMPLEMENTED');
    });
  });

  describe('platform tenant deletion', () => {
    it('lets a super admin permanently delete a tenant and keep the user accounts', async () => {
      const owner = await h.createUser({ email: 'owner@acme.test' });
      const tenant = await h.createTenant('acme', owner.id);
      await h.createUser({ email: 'root@platform.test', platformRole: 'SUPER_ADMIN' });
      const admin = await h.loginAs('root@platform.test');

      const deleted = await admin.delete(`/api/v1/platform/tenants/${tenant.id}`);
      expect(deleted.status).toBe(204);
      expect(await h.prisma.tenant.count({ where: { id: tenant.id } })).toBe(0);
      expect(await h.prisma.membership.count({ where: { tenantId: tenant.id } })).toBe(0);
      expect(await h.prisma.role.count({ where: { tenantId: tenant.id } })).toBe(0);
      expect(await h.prisma.user.count({ where: { email: 'owner@acme.test' } })).toBe(1);

      const audit = await h.prisma.auditLog.findFirst({
        where: { action: 'platform.tenant_deleted', targetId: tenant.id },
      });
      expect(audit).not.toBeNull();
      expect(audit?.tenantId).toBeNull();

      const missing = await admin.delete(`/api/v1/platform/tenants/${tenant.id}`);
      expect(missing.status).toBe(404);
    });
  });
});
