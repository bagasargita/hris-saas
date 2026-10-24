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

const ATTENDANCE_ADMIN: readonly PermissionKey[] = [
  'attendance.read',
  'attendance.clock',
  'attendance.sites.manage',
  'attendance.schedules.manage',
  'attendance.approve',
  'attendance.team.read',
];

const ATTENDANCE_MANAGER: readonly PermissionKey[] = [
  'attendance.read',
  'attendance.clock',
  'attendance.schedules.manage',
  'attendance.approve',
  'attendance.team.read',
];

const ATTENDANCE_MEMBER: readonly PermissionKey[] = ['attendance.read', 'attendance.clock'];

/**
 * Defaults copied into every new tenant. Tenants can edit these (except the owner role)
 * and create their own, so they are a starting point rather than a security boundary.
 */
export const DEFAULT_TENANT_ROLES: readonly DefaultRoleDefinition[] = [
  {
    key: 'owner',
    name: 'Pemilik',
    description: 'Kontrol penuh atas workspace, termasuk tagihan dan kepemilikan.',
    permissions: ALL_PERMISSIONS,
  },
  {
    key: 'admin',
    name: 'Admin',
    description: 'Mengelola anggota, peran, dan pengaturan. Tidak dapat mengelola tagihan.',
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
      ...ATTENDANCE_ADMIN,
    ],
  },
  {
    key: 'manager',
    name: 'Manajer',
    description: 'Mengundang dan melihat anggota, mengelola absensi tim.',
    permissions: [
      'tenant.read',
      'members.read',
      'members.invite',
      'roles.read',
      ...ATTENDANCE_MANAGER,
    ],
  },
  {
    key: 'member',
    name: 'Anggota',
    description: 'Akses standar ke workspace.',
    permissions: ['tenant.read', 'members.read', ...ATTENDANCE_MEMBER],
  },
  {
    key: 'viewer',
    name: 'Pengamat',
    description: 'Akses hanya baca ke ringkasan workspace.',
    permissions: ['tenant.read'],
  },
];

export const PLATFORM_ROLES = {
  USER: 'USER',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[keyof typeof PLATFORM_ROLES];
