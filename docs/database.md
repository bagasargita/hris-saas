# Database

PostgreSQL 17, accessed through Prisma 7 (`prisma-client` generator, `@prisma/adapter-pg` driver adapter).
Schema: `apps/api/prisma/schema.prisma`. Tables use `snake_case` names.

## Entities

| Model            | Notes                                                                                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`           | Global identity. `email` unique (normalised lowercase). `passwordHash` (Argon2id). `platformRole` (`USER` / `SUPER_ADMIN`) is separate from tenant roles. `status` `ACTIVE`/`SUSPENDED`.        |
| `Tenant`         | Workspace. `slug` unique. `plan`, `status`.                                                                                                                                                     |
| `Membership`     | User ↔ Tenant. Unique `(tenantId, userId)`, plus unique `(id, tenantId)` used by composite FKs.                                                                                                 |
| `Role`           | Per-tenant. Unique `(tenantId, key)`. `isSystem` marks the five provisioned roles.                                                                                                              |
| `Permission`     | Global catalog, synced from `@saas/contracts` on API start.                                                                                                                                     |
| `RolePermission` | Role ↔ Permission.                                                                                                                                                                              |
| `MembershipRole` | Membership ↔ Role. Carries `tenantId` with **composite foreign keys** to `Membership(id, tenantId)` and `Role(id, tenantId)`: the database itself refuses to attach a role from another tenant. |
| `Invitation`     | `tokenHash` unique (raw token only in the email). Composite FK to the role in the same tenant. Status `PENDING`/`ACCEPTED`/`REVOKED`; `EXPIRED` is derived from `expiresAt`.                    |
| `Session`        | Opaque server-side session. Only `tokenHash` is stored. `expiresAt` (idle), `absoluteExpiresAt`, `revokedAt`, `activeTenantId`.                                                                 |
| `UserToken`      | Email verification and password reset tokens (hashed, single-use, expiring).                                                                                                                    |
| `AuditLog`       | Append-only. `action`, `actorId`, `tenantId`, `targetType/Id`, `metadata` (JSON), `ipAddress`, `userAgent`, `requestId`.                                                                        |

## Migrations

```bash
docker compose up -d db                    # PostgreSQL on localhost:5433
yarn db:generate                           # generate the Prisma client into apps/api/src/generated
yarn db:migrate                            # prisma migrate dev (creates/applies migrations)
yarn db:seed                               # idempotent development seed (refuses NODE_ENV=production)
yarn db:migrate:deploy                     # production: apply committed migrations only
```

`yarn db:reset` drops the development database. **Never run it against shared or production data.**

The integration test suite applies migrations to a separate `saas_test` database (created by
`docker/postgres/init/01-create-test-database.sql`) and truncates it between tests.

## Transactions

- Tenant creation (tenant, 5 roles, role permissions, owner membership, audit entry) is one transaction.
- Role/status changes, removals, invitation creation and anything that checks the "last owner" invariant run
  with `Serializable` isolation so concurrent requests cannot both pass the check. A serialization failure
  surfaces as `409 CONFLICT` and is **not** retried automatically.
- Single-use tokens (verification, reset, invitation acceptance) are consumed with a conditional
  `updateMany(... status/consumedAt ...)` so two concurrent uses cannot both succeed.

## Seed data (development only)

All seeded accounts use `SEED_PASSWORD` (default `ChangeMe-dev-only-1`).

| Email                      | Notes                                               |
| -------------------------- | --------------------------------------------------- |
| `superadmin@platform.test` | Platform SUPER_ADMIN, no tenant membership          |
| `olivia.owner@acme.test`   | Owner of **Acme Inc.** (`/t/acme`, PRO)             |
| `adam.admin@acme.test`     | Admin in Acme                                       |
| `maya.manager@acme.test`   | Manager in Acme                                     |
| `mike.member@acme.test`    | Member in Acme, Viewer in Globex                    |
| `sam.suspended@acme.test`  | Suspended account                                   |
| `grace.owner@globex.test`  | Owner of **Globex Corporation** (`/t/globex`, FREE) |

A pending invitation for `new.hire@acme.test` is also created.
