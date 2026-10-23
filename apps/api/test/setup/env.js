// Loaded in every integration test worker before any module. Tests never touch the dev database.
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://saas:saas_dev_password@localhost:5433/saas_test?schema=public';

Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: testDatabaseUrl,
  APP_URL: 'http://localhost:3000',
  CORS_ORIGINS: 'http://localhost:3000',
  CSRF_SECRET: 'integration-test-csrf-secret-0123456789abcdef',
  COOKIE_SECURE: 'false',
  SWAGGER_ENABLED: 'false',
  THROTTLE_DEFAULT_LIMIT: '100000',
  THROTTLE_AUTH_LIMIT: '100000',
});
delete process.env.SMTP_URL;
