import { HttpStatus } from '@nestjs/common';
import { type PermissionKey, SYSTEM_ROLE_KEYS } from '@saas/contracts';
import { AppException } from '../../common/errors/app-exception';

/**
 * Pure privilege-escalation rules. Kept free of I/O so they can be unit tested exhaustively and
 * reused by every service that grants or changes access.
 *
 * Core invariant: an actor can only grant, assign or manage a set of permissions that is a subset
 * of their own effective permissions in the same tenant. The owner role is additionally reserved
 * for owners, because tenants may edit other roles to hold every permission.
 */

export interface ActorScope {
  membershipId: string;
  isOwner: boolean;
  permissions: ReadonlySet<PermissionKey>;
}

export interface RoleScope {
  key: string;
  permissions: readonly string[];
}

export interface MemberScope {
  membershipId: string;
  isOwner: boolean;
  permissions: ReadonlySet<string>;
}

export function actorScope(context: {
  membershipId: string;
  isOwner: boolean;
  permissions: ReadonlySet<PermissionKey>;
}): ActorScope {
  return {
    membershipId: context.membershipId,
    isOwner: context.isOwner,
    permissions: context.permissions,
  };
}

function escalation(message: string): AppException {
  return new AppException('PRIVILEGE_ESCALATION', message, HttpStatus.FORBIDDEN);
}

export function permissionsOutsideScope(
  permissions: Iterable<string>,
  scope: ReadonlySet<string>,
): string[] {
  const outside = new Set<string>();
  for (const permission of permissions) {
    if (!scope.has(permission)) outside.add(permission);
  }
  return [...outside].sort();
}

export function assertCanGrantPermissions(actor: ActorScope, permissions: readonly string[]): void {
  const outside = permissionsOutsideScope(permissions, actor.permissions);
  if (outside.length > 0) {
    throw escalation(`You cannot grant permissions you do not hold: ${outside.join(', ')}`);
  }
}

export function assertCanAssignRole(actor: ActorScope, role: RoleScope): void {
  if (role.key === SYSTEM_ROLE_KEYS.OWNER && !actor.isOwner) {
    throw escalation('Only owners can assign the owner role');
  }
  assertCanGrantPermissions(actor, role.permissions);
}

/** Changing roles/status or removing a member requires authority over everything that member holds. */
export function assertCanManageMember(actor: ActorScope, target: MemberScope): void {
  if (target.membershipId === actor.membershipId) {
    throw AppException.forbidden(
      'You cannot change your own membership. Ask another administrator.',
    );
  }
  if (target.isOwner && !actor.isOwner) {
    throw escalation('Only owners can manage other owners');
  }
  const outside = permissionsOutsideScope(target.permissions, actor.permissions);
  if (outside.length > 0) {
    throw escalation('This member has permissions beyond your own and cannot be managed by you');
  }
}

/** Editing a role changes access for everyone holding it, so the actor must already cover it. */
export function assertCanEditRole(
  actor: ActorScope,
  role: RoleScope,
  nextPermissions?: readonly string[],
): void {
  if (role.key === SYSTEM_ROLE_KEYS.OWNER) {
    throw AppException.forbidden('The owner role cannot be modified');
  }
  if (permissionsOutsideScope(role.permissions, actor.permissions).length > 0) {
    throw escalation('This role has permissions beyond your own and cannot be modified by you');
  }
  if (nextPermissions) assertCanGrantPermissions(actor, nextPermissions);
}
