# Authorization

## Model

- **Permissions** are fixed keys defined in `packages/contracts/src/permissions.ts`:
  `tenant.read`, `tenant.update`, `members.read`, `members.invite`, `members.update`, `members.remove`,
  `roles.read`, `roles.create`, `roles.update`, `roles.delete`, `audit_logs.read`, `billing.read`,
  `billing.manage`.
- **Roles** belong to a tenant and bundle permissions. A member can hold several roles; effective permissions
  are the union.
- **System roles** are provisioned for every tenant:

| Role    | Permissions                                                   |
| ------- | ------------------------------------------------------------- |
| Owner   | all                                                           |
| Admin   | all except `billing.manage`                                   |
| Manager | `tenant.read`, `members.read`, `members.invite`, `roles.read` |
| Member  | `tenant.read`, `members.read`                                 |
| Viewer  | `tenant.read`                                                 |

- **Platform role** (`User.platformRole = SUPER_ADMIN`) is separate. It grants access to `/api/v1/platform/*`
  only and gives **no** implicit access to any tenant's data.

## Enforcement

```ts
@TenantScoped('members.read')            // controller: resolves tenant context, requires permission
@Controller('tenants/:tenantId/members')
class MembershipsController {
  @RequirePermissions('members.update')  // handler: additional permission
  @Put(':memberId/roles') updateRoles(...) {}
}
```

`TenantAccessGuard`:

1. requires an authenticated session;
2. validates `:tenantId` is a UUID;
3. loads the caller's membership **from the database** (`tenantId + userId`) with roles and permissions;
4. denies with `403 TENANT_ACCESS_DENIED` if there is no membership, it is suspended, or the tenant is
   suspended — the same response as for a tenant that does not exist;
5. checks the merged class + handler permissions (`403 FORBIDDEN` if any is missing);
6. attaches the resolved `TenantContext` to the request. Handlers read it with `@Tenant()`.

Nothing from the client (headers, body fields, slugs, cached permissions) is ever used as proof of access.
Unknown body/query fields such as `tenantId` or `platformRole` are rejected by the validation pipe.

## Privilege-escalation rules

Implemented as pure functions in `apps/api/src/modules/permissions/authorization.policy.ts` and unit tested.
Services call them inside the same transaction as the change.

1. **Grant ⊆ own**: creating/editing a role, assigning a role or inviting with a role is only allowed if every
   permission involved is held by the actor.
2. **Owner role is reserved**: only owners can assign it (directly or via invitation); it cannot be edited or
   deleted.
3. **No self-management**: an actor cannot change their own roles/status or remove themselves (use _leave_).
4. **Managing someone requires covering them**: an actor can only change or remove a member whose
   permissions are a subset of the actor's; non-owners cannot manage owners.
5. **Editing a role requires covering it**: an actor cannot edit a role that already holds permissions they
   lack.
6. **Last owner**: demoting, suspending, removing or leaving is refused if it would leave the tenant without an
   active owner. Checked under `Serializable` isolation so concurrent demotions cannot both succeed.
7. **Platform admins cannot change their own platform status.**

Rules 1, 2 (assignment), 4 and 5 return `403 PRIVILEGE_ESCALATION`; self-management, editing the owner role
and platform self-changes return `403 FORBIDDEN`; the last-owner rule returns `409 CONFLICT`. Default (system)
roles cannot be deleted, and a role cannot be deleted while it is assigned or used by a pending invitation.

## Frontend

`TenantProvider` exposes `can(permission)` from the context returned by `GET /tenants/:id/me`. It is used to
hide navigation and buttons only. Every action is re-authorized by the API, and the integration tests call
the API directly to prove that hidden actions are also forbidden.
