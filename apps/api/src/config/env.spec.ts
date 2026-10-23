import { loadEnv } from './env';

const base = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db' };

describe('loadEnv', () => {
  it('applies safe development defaults', () => {
    const env = loadEnv({ ...base, NODE_ENV: 'development' });
    expect(env.port).toBe(4000);
    expect(env.cookie.secure).toBe(false);
    expect(env.allowedOrigins).toEqual(['http://localhost:3000']);
    expect(env.swaggerEnabled).toBe(true);
  });

  it('normalizes origins and splits the allowlist', () => {
    const env = loadEnv({
      ...base,
      CORS_ORIGINS: 'https://app.example.com/, https://admin.example.com/path',
    });
    expect(env.allowedOrigins).toEqual(['https://app.example.com', 'https://admin.example.com']);
  });

  it('requires DATABASE_URL', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rejects short CSRF secrets', () => {
    expect(() => loadEnv({ ...base, CSRF_SECRET: 'short' })).toThrow(/CSRF_SECRET/);
  });

  describe('production', () => {
    const prod = {
      ...base,
      NODE_ENV: 'production',
      CSRF_SECRET: 'x'.repeat(48),
      SMTP_URL: 'smtp://mail:25',
      APP_URL: 'https://app.example.com',
    };

    it('accepts a complete configuration and defaults to secure cookies without Swagger', () => {
      const env = loadEnv(prod);
      expect(env.cookie.secure).toBe(true);
      expect(env.swaggerEnabled).toBe(false);
    });

    it('refuses insecure cookies', () => {
      expect(() => loadEnv({ ...prod, COOKIE_SECURE: 'false' })).toThrow(/COOKIE_SECURE/);
    });

    it('refuses a missing CSRF secret', () => {
      const { CSRF_SECRET: _omit, ...rest } = prod;
      expect(() => loadEnv(rest)).toThrow(/CSRF_SECRET/);
    });

    it('refuses to run without SMTP so email links never go to logs', () => {
      const { SMTP_URL: _omit, ...rest } = prod;
      expect(() => loadEnv(rest)).toThrow(/SMTP_URL/);
    });
  });
});
