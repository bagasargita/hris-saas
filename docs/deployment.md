# Deployment

## Topology

```
Internet ─► TLS-terminating proxy / load balancer ─► Next.js (web, port 3000)
                                                      └─► NestJS API (private network, port 4000) ─► PostgreSQL
```

Expose **only the web app** publicly. It rewrites `/api/v1/*` to the API over the private network
(`API_INTERNAL_URL`). If you must expose the API on its own origin, set `CORS_ORIGINS` to the exact web
origin(s) and set `COOKIE_DOMAIN` only if the web and API share a parent domain.

## Runtime

Use **Node.js 24 LTS** (minimum `24.22.1`; pinned in `.nvmrc` and CI). Prefer an Active/Maintenance LTS
build matching that floor on every host that runs `yarn install`, builds, or starts the API/web processes.

## Build

```bash
yarn install --immutable
yarn db:generate
yarn build                       # contracts → api (dist/) → web (.next/standalone)
```

Run:

```bash
yarn db:migrate:deploy           # before starting a new API version
node apps/api/dist/main.js       # API
node apps/web/.next/standalone/apps/web/server.js   # web (copy .next/static and public as per Next docs)
```

## API environment (production)

| Variable                                              | Required | Notes                                                                            |
| ----------------------------------------------------- | -------- | -------------------------------------------------------------------------------- |
| `NODE_ENV=production`                                 | yes      | enables production safety checks                                                 |
| `DATABASE_URL`                                        | yes      | use TLS (`sslmode=require`) and a least-privilege role                           |
| `APP_URL`                                             | yes      | public web origin, used in email links                                           |
| `CORS_ORIGINS`                                        | yes      | comma-separated exact origins; also the CSRF origin allow-list                   |
| `CSRF_SECRET`                                         | yes      | ≥ 32 random characters; the API refuses to start with the example value          |
| `COOKIE_SECURE=true`                                  | yes      | the API refuses to start otherwise; cookies use the `__Host-` prefix             |
| `SMTP_URL`, `MAIL_FROM`                               | yes      | the API refuses to start without SMTP in production                              |
| `TRUST_PROXY`                                         | yes      | number of proxy hops or subnets; wrong values break rate limiting and IP logging |
| `SESSION_IDLE_TTL_HOURS`, `SESSION_ABSOLUTE_TTL_DAYS` | no       | defaults 168 h / 30 d                                                            |
| `THROTTLE_*`                                          | no       | rate limits                                                                      |
| `SWAGGER_ENABLED`                                     | no       | defaults to `false` in production                                                |
| `REGISTRATION_ENABLED`                                | no       | set `false` for invite-only deployments                                          |

Generate secrets with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` and
store them in your platform's secret manager. **Never commit them.**

## Web environment

| Variable               | Notes                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `API_INTERNAL_URL`     | server-side only; private URL of the API                                                              |
| `NEXT_PUBLIC_APP_NAME` | public display name. Never put secrets in `NEXT_PUBLIC_*` — they are inlined into browser JavaScript. |

## Operational checklist

- [ ] TLS everywhere; HSTS is sent by the web app in production.
- [ ] Database backups and point-in-time recovery enabled; restore tested.
- [ ] Migrations reviewed before `migrate deploy`; destructive changes planned with a rollback.
- [ ] Logs shipped centrally (JSON pino output) with request ids; redaction verified.
- [ ] `/api/v1/health` for liveness, `/api/v1/health/ready` for readiness probes.
- [ ] Single API replica **or** a shared (Redis) Throttler storage for multiple replicas.
- [ ] Periodic cleanup job for expired sessions/tokens (rows are already ignored once expired).
- [ ] Rotate `CSRF_SECRET` by deploying a new value (outstanding CSRF tokens become invalid; clients refetch
      transparently).
- [ ] Consider PostgreSQL RLS as defence in depth (see [multi-tenancy](./multi-tenancy.md#row-level-security)).
- [ ] Connect a real payment provider before selling paid plans (see [api](./api.md#billing)).

## CI

`.github/workflows/ci.yml` runs format check, lint, typecheck, unit tests and build; API integration tests
against a PostgreSQL service container; and Playwright end-to-end tests against a migrated and seeded
database.
