# API

Base path: `/api/v1`. Interactive documentation (Swagger UI): `/api/docs` when `SWAGGER_ENABLED=true`
(enabled in development, disabled by default in production).

## Conventions

- JSON only. Timestamps are ISO-8601 strings. IDs are UUIDs.
- Authentication: session cookie. State-changing requests require `X-CSRF-Token` (see
  [authentication](./authentication.md#csrf)).
- Unknown properties in bodies or query strings are rejected (`400 VALIDATION_ERROR`).
- Responses are never cached (`Cache-Control: no-store`, `Vary: Cookie`).
- Every response carries `X-Request-Id`.

### Pagination

List endpoints accept `page` (≥1, default 1), `limit` (1–100, default 20), `sortOrder` (`asc`/`desc`) and,
where noted, `search`, filters and `sortBy`. They return:

```json
{ "data": [], "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 } }
```

### Errors

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "statusCode": 400,
    "requestId": "c0a8…",
    "details": [{ "field": "email", "messages": ["email must be an email"] }]
  }
}
```

| Code                                      | Status | Meaning                                                             |
| ----------------------------------------- | ------ | ------------------------------------------------------------------- |
| `VALIDATION_ERROR`                        | 400    | Invalid or unknown input                                            |
| `BAD_REQUEST`                             | 400    | Semantically invalid request                                        |
| `INVALID_TOKEN`                           | 400    | Verification/reset/invitation token invalid, used or expired        |
| `UNAUTHENTICATED`                         | 401    | No valid session                                                    |
| `INVALID_CREDENTIALS`                     | 401    | Wrong email or password (also 400 for a wrong current password)     |
| `EMAIL_NOT_VERIFIED`, `ACCOUNT_SUSPENDED` | 403    | Account state (only after a correct password)                       |
| `CSRF_INVALID`                            | 403    | Missing/invalid CSRF token or disallowed origin                     |
| `TENANT_ACCESS_DENIED`                    | 403    | Not an active member of an active tenant (or tenant does not exist) |
| `FORBIDDEN`                               | 403    | Missing permission                                                  |
| `PRIVILEGE_ESCALATION`                    | 403    | Would grant or manage more than the actor holds                     |
| `NOT_FOUND`                               | 404    | Resource not found **in this tenant**                               |
| `CONFLICT`                                | 409    | Uniqueness, last-owner rule, or concurrent modification             |
| `RATE_LIMITED`                            | 429    | Too many requests                                                   |
| `NOT_IMPLEMENTED`                         | 501    | Feature boundary not configured (billing)                           |
| `INTERNAL_ERROR`                          | 500    | Unexpected error; details are logged, never returned                |

## Endpoints

### Health

`GET /health` (liveness) · `GET /health/ready` (database check; `503` when down).

### Auth

`GET /auth/csrf` · `POST /auth/register` · `POST /auth/login` · `POST /auth/logout` · `GET /auth/me` ·
`POST /auth/active-tenant` · `POST /auth/verify-email` · `POST /auth/resend-verification` ·
`POST /auth/forgot-password` · `POST /auth/reset-password`

### Current user

`PATCH /users/me` · `POST /users/me/password` · `GET /users/me/sessions` ·
`POST /users/me/sessions/revoke-others` · `DELETE /users/me/sessions/:sessionId`

### Tenants

| Method & path                   | Permission                             |
| ------------------------------- | -------------------------------------- |
| `GET /tenants`                  | authenticated (own memberships)        |
| `POST /tenants`                 | authenticated (creator becomes owner)  |
| `GET /tenants/:tenantId/me`     | active membership                      |
| `GET /tenants/:tenantId`        | `tenant.read`                          |
| `PATCH /tenants/:tenantId`      | `tenant.update`                        |
| `GET /tenants/:tenantId/stats`  | `tenant.read`                          |
| `POST /tenants/:tenantId/leave` | active membership (last owner refused) |

### Members — `/tenants/:tenantId/members`

`GET /` (`members.read`; `search`, `status`, `roleId`, `sortBy=joinedAt|name|email`) · `GET /:memberId` ·
`PUT /:memberId/roles {roleIds}` (`members.update`) · `PATCH /:memberId {status}` (`members.update`) ·
`DELETE /:memberId` (`members.remove`)

### Roles & permissions

`GET /tenants/:tenantId/roles` (`roles.read`) · `GET /…/roles/:roleId` · `POST /…/roles` (`roles.create`) ·
`PATCH /…/roles/:roleId` (`roles.update`) · `DELETE /…/roles/:roleId` (`roles.delete`; refused while assigned) ·
`GET /tenants/:tenantId/permissions` (`roles.read`)

### Invitations

`GET /tenants/:tenantId/invitations` (`members.read`; `status`) · `POST /…/invitations {email, roleId}`
(`members.invite`) · `GET /…/invitations/import-template` (`members.invite`; CSV download with `email,role`
columns) · `POST /…/invitations/import` (`members.invite`; multipart field `file`, max 100 rows / 100 KB;
returns per-row invited/skipped/failed) · `POST /…/invitations/:id/revoke` ·
`POST /…/invitations/:id/resend` (rotates the token) · `POST /invitations/preview {token}` (public) ·
`POST /invitations/accept {token}` (authenticated, verified, matching email)

### Audit logs

`GET /tenants/:tenantId/audit-logs` (`audit_logs.read`; `action` prefix, `actorId`, `from`, `to`)

### Billing

`GET /tenants/:tenantId/billing` (`billing.read`) returns plan, member count/limit and
`providerConfigured`. `POST /tenants/:tenantId/billing/checkout {plan}` (`billing.manage`) returns
`501 NOT_IMPLEMENTED` until a `BillingProvider` implementation (e.g. Stripe Checkout + webhooks that update
`Tenant.plan`) is bound in `BillingModule`. Nothing in the codebase pretends a payment happened.

### Platform (SUPER_ADMIN only)

`GET /platform/tenants` · `PATCH /platform/tenants/:tenantId {status}` ·
`DELETE /platform/tenants/:tenantId` (204; permanently removes the workspace, memberships, roles,
invitations and tenant-scoped audit logs; keeps user accounts; records `platform.tenant_deleted`) ·
`GET /platform/users` · `PATCH /platform/users/:userId {status}` (suspending revokes the user's sessions) ·
`GET /platform/audit-logs`
