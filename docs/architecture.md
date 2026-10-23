# Architecture

## Overview

```
Browser ──HTTPS──► Next.js (apps/web) ──rewrite /api/v1/*──► NestJS API (apps/api) ──► PostgreSQL
   │                    │                                         │
   │  same-origin        │ Server Components forward the            ├─► SMTP (Mailpit in dev)
   │  cookies only       │ user's Cookie header to the API          └─► Audit log (same DB, same transaction)
```

- **apps/web** — Next.js App Router (React 19, TypeScript strict, Tailwind v4, shadcn/ui on Radix). It is a
  presentation layer and a same-origin gateway. It holds **no secrets** and makes **no authorization decisions**:
  permissions it receives are only used to hide UI the user cannot use.
- **apps/api** — NestJS modular monolith. Owns authentication, sessions, tenant resolution, authorization,
  validation, persistence and audit logging. Every request is authorized here.
- **packages/contracts** — browser-safe constants (permission keys, roles, plans, error codes) and API DTO
  interfaces shared by both apps. It must never import server code.
- **packages/config** — shared TypeScript and ESLint configuration.

## Why the browser never talks to the API origin directly

`next.config.ts` rewrites `/api/v1/*` to `API_INTERNAL_URL`. The browser therefore sees a single origin:

- session and CSRF cookies are first-party (`SameSite=Lax`, `__Host-` prefix in production);
- no credentialed CORS is needed in the default deployment (CORS is still allow-listed in the API for
  deployments that expose it on its own origin);
- the API URL is not exposed in client bundles (`API_INTERNAL_URL` has no `NEXT_PUBLIC_` prefix).

## API module map

| Module                  | Responsibility                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `auth`                  | register, login/logout, sessions, CSRF tokens, email verification, password reset, active tenant |
| `users`                 | profile, password change, session listing and revocation                                         |
| `tenants`               | create/list/update workspaces, stats, leave; tenant provisioning (system roles)                  |
| `memberships`           | list/search members, change roles and status, remove                                             |
| `roles` / `permissions` | custom roles, permission catalog, **authorization policy** (pure functions)                      |
| `invitations`           | create, resend (token rotation), revoke, preview, accept                                         |
| `audit-logs`            | append-only audit trail, written inside the same transaction as the change                       |
| `billing`               | explicit integration boundary (`BillingProvider`), returns 501 until configured                  |
| `platform`              | SUPER_ADMIN console: tenants, users, cross-tenant audit log                                      |
| `health`                | liveness `/health`, readiness `/health/ready` (checks DB)                                        |
| `mail`                  | SMTP / log / in-memory transports                                                                |

## Request pipeline (API)

1. `helmet`, `cookie-parser`, CORS allow-list, pino-http (request id, redaction).
2. Global guards in order: `ThrottlerGuard` → `SessionAuthGuard` (resolves the session from the DB) →
   `CsrfGuard` (unsafe methods only).
3. Route guards: `TenantAccessGuard` (loads membership + permissions from the DB for `:tenantId`),
   `PlatformAdminGuard`.
4. `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`).
5. Handler → service → Prisma; mutations and their audit entries share one transaction.
6. `NoStoreInterceptor` adds `Cache-Control: no-store` and `Vary: Cookie`.
7. `AllExceptionsFilter` renders every error as `{ error: { code, message, statusCode, requestId, details? } }`.

## Frontend state

- **Server data**: TanStack Query. Tenant-scoped keys start with `['tenant', tenantId]`; the whole cache is
  cleared on login and logout, so data cannot leak between accounts or workspaces.
- **UI state**: Zustand (`stores/ui-store.ts`) — sidebar and mobile navigation only.
- **Forms**: React Hook Form + Zod (mirrors API limits for fast feedback; the API remains authoritative).
- **Tables**: TanStack Table v9 (`useTable` + `tableFeatures`) with server-side pagination.

## Known limitations

- Rate-limit counters use the in-memory Throttler storage: correct for a single API instance only. Use a
  Redis storage adapter when running several replicas.
- PostgreSQL Row-Level Security is **not** configured. Isolation is enforced in the application layer and
  by composite foreign keys (see [multi-tenancy](./multi-tenancy.md)).
- The CSP allows `'unsafe-inline'` scripts because Next.js injects inline bootstrap code; a nonce-based CSP
  (via `proxy.ts`) is the recommended hardening step.
- Billing is an integration boundary, not an implementation (see [api](./api.md#billing)).
