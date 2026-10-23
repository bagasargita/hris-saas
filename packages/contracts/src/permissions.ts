/**
 * Tenant permission catalog. The API seeds these into the `Permission` table and
 * enforces them server-side; the web app only uses them to shape navigation.
 */
export const PERMISSIONS = {
  TENANT_READ: 'tenant.read',
  TENANT_UPDATE: 'tenant.update',
  MEMBERS_READ: 'members.read',
  MEMBERS_INVITE: 'members.invite',
  MEMBERS_UPDATE: 'members.update',
  MEMBERS_REMOVE: 'members.remove',
  ROLES_READ: 'roles.read',
  ROLES_CREATE: 'roles.create',
  ROLES_UPDATE: 'roles.update',
  ROLES_DELETE: 'roles.delete',
  AUDIT_LOGS_READ: 'audit_logs.read',
  BILLING_READ: 'billing.read',
  BILLING_MANAGE: 'billing.manage',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: readonly PermissionKey[] = Object.values(PERMISSIONS);

export interface PermissionDefinition {
  key: PermissionKey;
  group: 'Tenant' | 'Members' | 'Roles' | 'Audit' | 'Billing';
  description: string;
}

export const PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  { key: 'tenant.read', group: 'Tenant', description: 'View workspace details and dashboard' },
  { key: 'tenant.update', group: 'Tenant', description: 'Change workspace name and settings' },
  { key: 'members.read', group: 'Members', description: 'View members and invitations' },
  {
    key: 'members.invite',
    group: 'Members',
    description: 'Invite new members and revoke invitations',
  },
  { key: 'members.update', group: 'Members', description: 'Change member roles and status' },
  { key: 'members.remove', group: 'Members', description: 'Remove members from the workspace' },
  { key: 'roles.read', group: 'Roles', description: 'View roles and their permissions' },
  { key: 'roles.create', group: 'Roles', description: 'Create custom roles' },
  { key: 'roles.update', group: 'Roles', description: 'Edit roles and their permissions' },
  { key: 'roles.delete', group: 'Roles', description: 'Delete custom roles' },
  { key: 'audit_logs.read', group: 'Audit', description: 'View the workspace audit log' },
  { key: 'billing.read', group: 'Billing', description: 'View plan and subscription details' },
  { key: 'billing.manage', group: 'Billing', description: 'Change plan and payment details' },
];

export function isPermissionKey(value: string): value is PermissionKey {
  return (ALL_PERMISSIONS as readonly string[]).includes(value);
}
