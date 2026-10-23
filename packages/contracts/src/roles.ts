import { ALL_PERMISSIONS, type PermissionKey } from './permissions';

export const SYSTEM_ROLE_KEYS = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MANAGER: 'manager',
  MEMBER: 'member',
  VIEWER: 'viewer',
} as const;

export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[keyof typeof SYSTEM_ROLE_KEYS];

export interface DefaultRoleDefinition {
  key: SystemRoleKey;
  name: string;
  description: string;
  permissions: readonly PermissionKey[];
}

/**
 * Defaults copied into every new tenant. Tenants can edit these (except the owner role)
 * and create their own, so they are a starting point rather than a security boundary.
 */
export const DEFAULT_TENANT_ROLES: readonly DefaultRoleDefinition[] = [
  {
    key: 'owner',
    name: 'Owner',
    description: 'Full control of the workspace, including billing and ownership.',
    permissions: ALL_PERMISSIONS,
  },
  {
    key: 'admin',
    name: 'Admin',
    description: 'Manage members, roles and settings. Cannot manage billing.',
    permissions: [
      'tenant.read',
      'tenant.update',
      'members.read',
      'members.invite',
      'members.update',
      'members.remove',
      'roles.read',
      'roles.create',
      'roles.update',
      'roles.delete',
      'audit_logs.read',
      'billing.read',
    ],
  },
  {
    key: 'manager',
    name: 'Manager',
    description: 'Invite and view members, view roles.',
    permissions: ['tenant.read', 'members.read', 'members.invite', 'roles.read'],
  },
  {
    key: 'member',
    name: 'Member',
    description: 'Standard access to the workspace.',
    permissions: ['tenant.read', 'members.read'],
  },
  {
    key: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to the workspace overview.',
    permissions: ['tenant.read'],
  },
];

export const PLATFORM_ROLES = {
  USER: 'USER',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[keyof typeof PLATFORM_ROLES];
