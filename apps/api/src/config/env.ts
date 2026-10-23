export type NodeEnv = 'development' | 'test' | 'production';

export interface AppEnv {
  nodeEnv: NodeEnv;
  port: number;
  databaseUrl: string;
  /** Public URL of the web app; used to build links in emails. */
  appUrl: string;
  /** Origins allowed for CORS and for the CSRF origin check. */
  allowedOrigins: string[];
  trustProxy: string | number | boolean;
  cookie: {
    secure: boolean;
    domain: string | undefined;
  };
  session: {
    idleTtlMs: number;
    absoluteTtlMs: number;
  };
  csrfSecret: string;
  registrationEnabled: boolean;
  swaggerEnabled: boolean;
  logLevel: string;
  mail: {
    smtpUrl: string | undefined;
    from: string;
  };
  throttle: {
    defaultLimit: number;
    authLimit: number;
    ttlMs: number;
  };
}

type RawEnv = Record<string, string | undefined>;

function str(env: RawEnv, key: string, fallback?: string): string {
  const value = env[key]?.trim();
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable ${key}`);
}

function int(env: RawEnv, key: string, fallback: number): number {
  const raw = env[key]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Environment variable ${key} must be a non-negative integer`);
  }
  return value;
}

function bool(env: RawEnv, key: string, fallback: boolean): boolean {
  const raw = env[key]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (['1', 'true', 'yes'].includes(raw)) return true;
  if (['0', 'false', 'no'].includes(raw)) return false;
  throw new Error(`Environment variable ${key} must be a boolean`);
}

function parseTrustProxy(raw: string | undefined): string | number | boolean {
  if (!raw) return 'loopback';
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const asNumber = Number(raw);
  return Number.isInteger(asNumber) ? asNumber : raw;
}

function parseOrigin(value: string, key: string): string {
  try {
    return new URL(value).origin;
  } catch {
    throw new Error(`${key} contains an invalid URL: ${value}`);
  }
}

/** Parses and validates process environment. Throws on invalid or unsafe production configuration. */
export function loadEnv(env: RawEnv = process.env): AppEnv {
  const nodeEnvRaw = str(env, 'NODE_ENV', 'development');
  if (!['development', 'test', 'production'].includes(nodeEnvRaw)) {
    throw new Error('NODE_ENV must be development, test or production');
  }
  const nodeEnv = nodeEnvRaw as NodeEnv;
  const isProd = nodeEnv === 'production';

  const appUrl = parseOrigin(str(env, 'APP_URL', 'http://localhost:3000'), 'APP_URL');
  const allowedOrigins = str(env, 'CORS_ORIGINS', appUrl)
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
    .map((o) => parseOrigin(o, 'CORS_ORIGINS'));

  const csrfSecret = str(
    env,
    'CSRF_SECRET',
    isProd ? undefined : 'dev-only-csrf-secret-change-me-please-0000',
  );
  if (csrfSecret.length < 32) {
    throw new Error('CSRF_SECRET must be at least 32 characters');
  }

  const cookieSecure = bool(env, 'COOKIE_SECURE', isProd);
  const smtpUrl = env['SMTP_URL']?.trim() || undefined;

  if (isProd) {
    if (!cookieSecure) throw new Error('COOKIE_SECURE must be true in production');
    if (csrfSecret.startsWith('dev-only')) throw new Error('CSRF_SECRET must be set in production');
    if (!smtpUrl) throw new Error('SMTP_URL is required in production');
  }

  return {
    nodeEnv,
    port: int(env, 'PORT', 4000),
    databaseUrl: str(env, 'DATABASE_URL'),
    appUrl,
    allowedOrigins,
    trustProxy: parseTrustProxy(env['TRUST_PROXY']?.trim()),
    cookie: {
      secure: cookieSecure,
      domain: env['COOKIE_DOMAIN']?.trim() || undefined,
    },
    session: {
      idleTtlMs: int(env, 'SESSION_IDLE_TTL_HOURS', 24 * 7) * 60 * 60 * 1000,
      absoluteTtlMs: int(env, 'SESSION_ABSOLUTE_TTL_DAYS', 30) * 24 * 60 * 60 * 1000,
    },
    csrfSecret,
    registrationEnabled: bool(env, 'REGISTRATION_ENABLED', true),
    swaggerEnabled: bool(env, 'SWAGGER_ENABLED', !isProd),
    logLevel: str(env, 'LOG_LEVEL', isProd ? 'info' : 'debug'),
    mail: {
      smtpUrl,
      from: str(env, 'MAIL_FROM', 'SaaS Platform <no-reply@localhost>'),
    },
    throttle: {
      defaultLimit: int(env, 'THROTTLE_DEFAULT_LIMIT', 300),
      authLimit: int(env, 'THROTTLE_AUTH_LIMIT', 10),
      ttlMs: int(env, 'THROTTLE_TTL_SECONDS', 60) * 1000,
    },
  };
}
