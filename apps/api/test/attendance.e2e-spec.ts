import { createHarness, type Harness, role } from './helpers/harness';
import { type TestClient } from './helpers/client';

const HQ = { latitude: -6.175392, longitude: 106.827153, radiusMeters: 200 };
/** ~1.1km north — outside a 200m geofence. */
const FAR = { latitude: -6.165, longitude: 106.827153 };

describe('Attendance (integration)', () => {
  let h: Harness;
  let tenant: Awaited<ReturnType<Harness['createTenant']>>;
  let owner: TestClient;
  let manager: TestClient;
  let member: TestClient;
  let managerMembershipId: string;
  let memberMembershipId: string;
  let siteId: string;
  const base = () => `/api/v1/tenants/${tenant.id}/attendance`;

  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => {
    await h.close();
  });

  beforeEach(async () => {
    await h.reset();
    const olivia = await h.createUser({ email: 'olivia@acme.test' });
    const maya = await h.createUser({ email: 'maya@acme.test' });
    const mike = await h.createUser({ email: 'mike@acme.test' });
    tenant = await h.createTenant('acme', olivia.id);
    managerMembershipId = await h.addMember(
      tenant.id,
      maya.id,
      role(tenant.roleIds, 'manager'),
    );
    memberMembershipId = await h.addMember(
      tenant.id,
      mike.id,
      role(tenant.roleIds, 'member'),
    );
    await h.prisma.membership.update({
      where: { id: memberMembershipId },
      data: { managerId: managerMembershipId },
    });

    owner = await h.loginAs('olivia@acme.test');
    manager = await h.loginAs('maya@acme.test');
    member = await h.loginAs('mike@acme.test');

    const site = await owner.post(`${base()}/sites`, {
      name: 'HQ',
      ...HQ,
      timezone: 'Asia/Jakarta',
    });
    expect(site.status).toBe(201);
    siteId = site.body.id;
  });

  it('rejects clock-in outside the geofence and accepts inside', async () => {
    const outside = await member.post(`${base()}/clock-in`, {
      siteId,
      latitude: FAR.latitude,
      longitude: FAR.longitude,
    });
    expect(outside.status).toBe(400);
    expect(outside.body.error.message).toMatch(/outside/i);

    const inside = await member.post(`${base()}/clock-in`, {
      siteId,
      latitude: HQ.latitude,
      longitude: HQ.longitude,
    });
    expect(inside.status).toBe(201);
    expect(inside.body.status).toBe('OPEN');

    const out = await member.post(`${base()}/clock-out`, {
      latitude: HQ.latitude,
      longitude: HQ.longitude,
    });
    expect(out.status).toBe(201);
    expect(out.body.status).toBe('PENDING');
  });

  it('lets the direct manager approve; another manager cannot', async () => {
    const punchIn = await member.post(`${base()}/clock-in`, {
      siteId,
      latitude: HQ.latitude,
      longitude: HQ.longitude,
    });
    const punchOut = await member.post(`${base()}/clock-out`, {
      latitude: HQ.latitude,
      longitude: HQ.longitude,
    });
    expect(punchOut.status).toBe(201);
    const recordId = punchOut.body.id as string;

    const stranger = await h.createUser({ email: 'other.mgr@acme.test' });
    await h.addMember(tenant.id, stranger.id, role(tenant.roleIds, 'manager'));
    const otherManager = await h.loginAs('other.mgr@acme.test');

    const denied = await otherManager.post(`${base()}/records/${recordId}/approve`, {
      decision: 'APPROVED',
    });
    expect(denied.status).toBe(403);

    const ok = await manager.post(`${base()}/records/${recordId}/approve`, {
      decision: 'APPROVED',
    });
    expect(ok.status).toBe(201);
    expect(ok.body.status).toBe('APPROVED');

    // Owner/admin override still works on a fresh pending punch.
    const againIn = await member.post(`${base()}/clock-in`, {
      siteId,
      latitude: HQ.latitude,
      longitude: HQ.longitude,
    });
    expect(againIn.status).toBe(201);
    const againOut = await member.post(`${base()}/clock-out`, {
      latitude: HQ.latitude,
      longitude: HQ.longitude,
    });
    const ownerApprove = await owner.post(`${base()}/records/${againOut.body.id}/approve`, {
      decision: 'REJECTED',
    });
    expect(ownerApprove.status).toBe(201);
    expect(ownerApprove.body.status).toBe('REJECTED');

    void punchIn;
  });
});
