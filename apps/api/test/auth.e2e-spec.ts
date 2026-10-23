import request from 'supertest';
import { createHarness, type Harness, ORIGIN, PASSWORD } from './helpers/harness';

function tokenFrom(text: string | undefined): string {
  const match = text?.match(/token=([A-Za-z0-9_-]+)/);
  if (!match?.[1]) throw new Error(`no token in email: ${text}`);
  return match[1];
}

describe('Authentication (integration)', () => {
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

  describe('login', () => {
    it('logs in with valid credentials, sets an HttpOnly session cookie and returns the user', async () => {
      await h.createUser({ email: 'alice@example.test', name: 'Alice' });
      const client = h.client();
      const res = await client.post('/api/v1/auth/login', {
        email: 'ALICE@example.test ',
        password: PASSWORD,
      });

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        email: 'alice@example.test',
        name: 'Alice',
        emailVerified: true,
      });
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(typeof res.body.csrfToken).toBe('string');
      const cookies = res.headers['set-cookie'] as unknown as string[];
      const sid = cookies.find((c) => c.startsWith('sid='));
      expect(sid).toMatch(/HttpOnly/i);
      expect(sid).toMatch(/SameSite=Lax/i);

      const me = await client.get('/api/v1/auth/me');
      expect(me.status).toBe(200);
      expect(me.body.user.email).toBe('alice@example.test');
    });

    it('returns the same generic error for a wrong password and an unknown email', async () => {
      await h.createUser({ email: 'alice@example.test' });
      const wrongPassword = await h
        .client()
        .post('/api/v1/auth/login', { email: 'alice@example.test', password: 'nope-nope-nope' });
      const unknown = await h
        .client()
        .post('/api/v1/auth/login', { email: 'ghost@example.test', password: 'nope-nope-nope' });

      expect(wrongPassword.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(unknown.body.error).toMatchObject({
        code: wrongPassword.body.error.code,
        message: wrongPassword.body.error.message,
      });
      expect(wrongPassword.headers['set-cookie']?.toString() ?? '').not.toContain('sid=');
    });

    it('rejects unverified and suspended accounts only after the password is proven', async () => {
      await h.createUser({ email: 'new@example.test', verified: false });
      const suspended = await h.createUser({ email: 'sus@example.test' });
      await h.prisma.user.update({ where: { id: suspended.id }, data: { status: 'SUSPENDED' } });

      const unverified = await h
        .client()
        .post('/api/v1/auth/login', { email: 'new@example.test', password: PASSWORD });
      expect(unverified.status).toBe(403);
      expect(unverified.body.error.code).toBe('EMAIL_NOT_VERIFIED');

      const blocked = await h
        .client()
        .post('/api/v1/auth/login', { email: 'sus@example.test', password: PASSWORD });
      expect(blocked.status).toBe(403);
      expect(blocked.body.error.code).toBe('ACCOUNT_SUSPENDED');

      const wrong = await h
        .client()
        .post('/api/v1/auth/login', { email: 'sus@example.test', password: 'wrong-password-1' });
      expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('writes audit entries for successful and failed logins', async () => {
      const user = await h.createUser({ email: 'alice@example.test' });
      await h
        .client()
        .post('/api/v1/auth/login', { email: 'alice@example.test', password: 'wrong-password-1' });
      await h.loginAs('alice@example.test');
      const actions = (
        await h.prisma.auditLog.findMany({
          where: { actorId: user.id },
          orderBy: { createdAt: 'asc' },
        })
      ).map((a) => a.action);
      expect(actions).toEqual(['auth.login_failed', 'auth.login']);
    });
  });

  describe('sessions', () => {
    it('logout revokes the session server-side', async () => {
      await h.createUser({ email: 'alice@example.test' });
      const client = await h.loginAs('alice@example.test');
      expect((await client.post('/api/v1/auth/logout')).status).toBe(204);
      const me = await client.get('/api/v1/auth/me');
      expect(me.status).toBe(401);
      expect(me.body.error.code).toBe('UNAUTHENTICATED');
      expect(await h.prisma.session.count({ where: { revokedAt: null } })).toBe(0);
    });

    it('rejects an expired session', async () => {
      await h.createUser({ email: 'alice@example.test' });
      const client = await h.loginAs('alice@example.test');
      await h.prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
      expect((await client.get('/api/v1/auth/me')).status).toBe(401);
    });

    it('rejects a session past its absolute lifetime even if recently used', async () => {
      await h.createUser({ email: 'alice@example.test' });
      const client = await h.loginAs('alice@example.test');
      await h.prisma.session.updateMany({
        data: { absoluteExpiresAt: new Date(Date.now() - 1000) },
      });
      expect((await client.get('/api/v1/auth/me')).status).toBe(401);
    });

    it('rejects a session revoked from another device', async () => {
      await h.createUser({ email: 'alice@example.test' });
      const laptop = await h.loginAs('alice@example.test');
      const phone = await h.loginAs('alice@example.test');

      const sessions = await laptop.get('/api/v1/users/me/sessions');
      expect(sessions.body).toHaveLength(2);
      const phoneSession = (sessions.body as { id: string; current: boolean }[]).find(
        (s) => !s.current,
      );
      expect((await laptop.delete(`/api/v1/users/me/sessions/${phoneSession?.id}`)).status).toBe(
        204,
      );

      expect((await phone.get('/api/v1/auth/me')).status).toBe(401);
      expect((await laptop.get('/api/v1/auth/me')).status).toBe(200);
    });

    it("cannot revoke another user's session", async () => {
      await h.createUser({ email: 'alice@example.test' });
      await h.createUser({ email: 'bob@example.test' });
      const alice = await h.loginAs('alice@example.test');
      const bob = await h.loginAs('bob@example.test');
      const bobSession = (await bob.get('/api/v1/users/me/sessions')).body[0].id as string;

      expect((await alice.delete(`/api/v1/users/me/sessions/${bobSession}`)).status).toBe(404);
      expect((await bob.get('/api/v1/auth/me')).status).toBe(200);
    });

    it('suspending a user immediately invalidates their sessions', async () => {
      const user = await h.createUser({ email: 'alice@example.test' });
      const client = await h.loginAs('alice@example.test');
      await h.prisma.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } });
      expect((await client.get('/api/v1/auth/me')).status).toBe(401);
    });
  });

  describe('CSRF protection', () => {
    it('rejects state-changing requests without a CSRF token', async () => {
      await h.createUser({ email: 'alice@example.test' });
      const client = await h.loginAs('alice@example.test');
      const res = await client.rawPost('/api/v1/auth/logout', {}, { Origin: ORIGIN });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CSRF_INVALID');
    });

    it('rejects requests from a non-allowlisted origin even with a valid token', async () => {
      const client = h.client();
      const token = await client.refreshCsrf();
      const res = await client.rawPost(
        '/api/v1/auth/login',
        { email: 'a@example.test', password: 'whatever-123' },
        { Origin: 'https://evil.example', 'X-CSRF-Token': token },
      );
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CSRF_INVALID');
    });

    it('rejects a pre-login token after login (token is bound to the session)', async () => {
      await h.createUser({ email: 'alice@example.test' });
      const client = h.client();
      const anonymousToken = await client.refreshCsrf();
      const login = await client.post('/api/v1/auth/login', {
        email: 'alice@example.test',
        password: PASSWORD,
      });
      const sid = (login.headers['set-cookie'] as unknown as string[])
        .find((c) => c.startsWith('sid='))
        ?.split(';')[0];
      expect(sid).toBeDefined();

      const res = await request(h.server)
        .post('/api/v1/auth/logout')
        .set('Origin', ORIGIN)
        .set('Cookie', `${sid}; csrf=${encodeURIComponent(anonymousToken)}`)
        .set('X-CSRF-Token', anonymousToken);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CSRF_INVALID');
      expect((await client.get('/api/v1/auth/me')).status).toBe(200);
    });
  });

  describe('registration and email verification', () => {
    it('registers, sends a verification link and allows login only after verification', async () => {
      const client = h.client();
      const res = await client.post('/api/v1/auth/register', {
        name: 'Neo',
        email: 'neo@example.test',
        password: 'a-strong-password-1',
      });
      expect(res.status).toBe(202);

      const login = await h
        .client()
        .post('/api/v1/auth/login', { email: 'neo@example.test', password: 'a-strong-password-1' });
      expect(login.body.error.code).toBe('EMAIL_NOT_VERIFIED');

      const token = tokenFrom(h.mail.lastTo('neo@example.test')?.text);
      expect((await client.post('/api/v1/auth/verify-email', { token })).status).toBe(200);
      expect((await client.post('/api/v1/auth/verify-email', { token })).body.error.code).toBe(
        'INVALID_TOKEN',
      );

      const after = await h
        .client()
        .post('/api/v1/auth/login', { email: 'neo@example.test', password: 'a-strong-password-1' });
      expect(after.status).toBe(200);
    });

    it('does not reveal whether an email is already registered', async () => {
      await h.createUser({ email: 'taken@example.test' });
      const fresh = await h.client().post('/api/v1/auth/register', {
        name: 'A',
        email: 'fresh@example.test',
        password: 'a-strong-password-1',
      });
      const taken = await h.client().post('/api/v1/auth/register', {
        name: 'B',
        email: 'taken@example.test',
        password: 'a-strong-password-1',
      });
      expect(taken.status).toBe(fresh.status);
      expect(taken.body).toEqual(fresh.body);
      expect(h.mail.lastTo('taken@example.test')?.subject).toMatch(/tried to sign up/);
      expect(await h.prisma.user.count({ where: { email: 'taken@example.test' } })).toBe(1);
    });
  });

  describe('password reset', () => {
    it('resets the password with a single-use token and revokes all sessions', async () => {
      await h.createUser({ email: 'alice@example.test' });
      const oldSession = await h.loginAs('alice@example.test');

      const client = h.client();
      expect(
        (await client.post('/api/v1/auth/forgot-password', { email: 'alice@example.test' })).status,
      ).toBe(202);
      const token = tokenFrom(h.mail.lastTo('alice@example.test')?.text);

      const reset = await client.post('/api/v1/auth/reset-password', {
        token,
        password: 'brand-new-password-2',
      });
      expect(reset.status).toBe(200);
      expect((await oldSession.get('/api/v1/auth/me')).status).toBe(401);

      expect(
        (
          await h
            .client()
            .post('/api/v1/auth/login', { email: 'alice@example.test', password: PASSWORD })
        ).status,
      ).toBe(401);
      expect(
        (
          await h.client().post('/api/v1/auth/login', {
            email: 'alice@example.test',
            password: 'brand-new-password-2',
          })
        ).status,
      ).toBe(200);

      const reuse = await client.post('/api/v1/auth/reset-password', {
        token,
        password: 'another-password-3',
      });
      expect(reuse.body.error.code).toBe('INVALID_TOKEN');
    });

    it('responds identically for unknown emails and sends nothing', async () => {
      const known = await h.createUser({ email: 'alice@example.test' });
      const a = await h
        .client()
        .post('/api/v1/auth/forgot-password', { email: 'alice@example.test' });
      const b = await h
        .client()
        .post('/api/v1/auth/forgot-password', { email: 'nobody@example.test' });
      expect(a.status).toBe(b.status);
      expect(a.body).toEqual(b.body);
      expect(h.mail.lastTo('nobody@example.test')).toBeUndefined();
      expect(known.id).toBeDefined();
    });

    it('rejects expired reset tokens', async () => {
      await h.createUser({ email: 'alice@example.test' });
      await h.client().post('/api/v1/auth/forgot-password', { email: 'alice@example.test' });
      const token = tokenFrom(h.mail.lastTo('alice@example.test')?.text);
      await h.prisma.userToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
      const res = await h
        .client()
        .post('/api/v1/auth/reset-password', { token, password: 'brand-new-password-2' });
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });
  });
});
