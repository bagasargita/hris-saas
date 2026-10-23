# Multi-tenancy

## Strategy: shared database, shared schema

All tenants share one PostgreSQL database and schema. Every tenant-owned row carries a `tenantId`.

Chosen because it keeps operations simple (one migration path, one connection pool), supports users who
belong to several tenants, and scales comfortably to many small and medium tenants. Schema-per-tenant or
database-per-tenant can be introduced later for tenants with contractual isolation requirements.

## How isolation is enforced

1. **Tenant context is resolved on the server for every request.** `TenantAccessGuard` loads the caller's
   membership for the `:tenantId` route parameter from the database. The route parameter only _selects_ a
   tenant; access is proven exclusively by an active membership row.
2. **Every query is scoped by the resolved tenant id.** Services receive `TenantContext` and always filter with
   `tenantId` (e.g. `findFirst({ where: { id, tenantId } })`). An id that belongs to another tenant is
   indistinguishable from a missing one (`404`), which prevents IDOR.
3. **Composite foreign keys** make cross-tenant links impossible at the database level:
   `MembershipRole(membershipId, tenantId) → Membership(id, tenantId)` and
   `MembershipRole(roleId, tenantId) → Role(id, tenantId)`; invitations reference roles the same way.
4. **No enumeration**: "tenant does not exist", "not a member", "membership suspended" and "tenant suspended"
   all return the same `403 TENANT_ACCESS_DENIED`.
5. **Client cache isolation**: TanStack Query keys start with `['tenant', tenantId]`; the cache is cleared on
   login/logout and the previous tenant's queries are removed when switching.
6. **Web routing**: `/t/[slug]` resolves the slug only against the memberships the API returned for this
   session, then fetches the authoritative context from the API.

## Row-Level Security

**PostgreSQL RLS is not configured in this codebase.** Isolation relies on points 1–3 above and is covered by
`apps/api/test/tenancy-isolation.e2e-spec.ts`.

Recommended defence-in-depth next step:

1. Enable RLS on tenant tables with a policy `tenant_id = current_setting('app.tenant_id')::uuid`.
2. Use a non-owner database role for the application (owners bypass RLS).
3. Run tenant-scoped work inside a transaction that first executes `SET LOCAL app.tenant_id = $1`
   (a Prisma client extension can wrap this).
4. Keep platform/admin queries on a separate role with `BYPASSRLS`, and add tests that query with the wrong
   `app.tenant_id` to prove the policies work.

## Tests

`tenancy-isolation.e2e-spec.ts` proves, against a real database, that a tenant's credentials cannot:

- read any tenant-scoped endpoint of another tenant;
- write to another tenant (update, roles, invitations, member changes) and that the data is unchanged;
- reach another tenant's member through their own tenant's URL (IDOR → 404);
- assign another tenant's role or invite with it (and that the DB rejects such a row directly);
- smuggle a tenant id through query strings, request bodies or custom headers;
- switch the active tenant to a workspace they do not belong to;
- keep access after their membership or the tenant is suspended;
- and that a platform super admin has no implicit tenant access.
