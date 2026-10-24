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
  ATTENDANCE_READ: 'attendance.read',
  ATTENDANCE_CLOCK: 'attendance.clock',
  ATTENDANCE_SITES_MANAGE: 'attendance.sites.manage',
  ATTENDANCE_SCHEDULES_MANAGE: 'attendance.schedules.manage',
  ATTENDANCE_APPROVE: 'attendance.approve',
  ATTENDANCE_TEAM_READ: 'attendance.team.read',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: readonly PermissionKey[] = Object.values(PERMISSIONS);

export type PermissionGroup =
  | 'Tenant'
  | 'Anggota'
  | 'Peran'
  | 'Audit'
  | 'Tagihan'
  | 'Absensi';

export interface PermissionDefinition {
  key: PermissionKey;
  group: PermissionGroup;
  description: string;
}

export const PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    key: 'tenant.read',
    group: 'Tenant',
    description: 'Melihat detail workspace dan dasbor',
  },
  {
    key: 'tenant.update',
    group: 'Tenant',
    description: 'Mengubah nama dan pengaturan workspace',
  },
  {
    key: 'members.read',
    group: 'Anggota',
    description: 'Melihat anggota dan undangan',
  },
  {
    key: 'members.invite',
    group: 'Anggota',
    description: 'Mengundang anggota baru dan mencabut undangan',
  },
  {
    key: 'members.update',
    group: 'Anggota',
    description: 'Mengubah peran dan status anggota',
  },
  {
    key: 'members.remove',
    group: 'Anggota',
    description: 'Menghapus anggota dari workspace',
  },
  {
    key: 'roles.read',
    group: 'Peran',
    description: 'Melihat peran dan izinnya',
  },
  {
    key: 'roles.create',
    group: 'Peran',
    description: 'Membuat peran kustom',
  },
  {
    key: 'roles.update',
    group: 'Peran',
    description: 'Mengedit peran dan izinnya',
  },
  {
    key: 'roles.delete',
    group: 'Peran',
    description: 'Menghapus peran kustom',
  },
  {
    key: 'audit_logs.read',
    group: 'Audit',
    description: 'Melihat log audit workspace',
  },
  {
    key: 'billing.read',
    group: 'Tagihan',
    description: 'Melihat detail paket dan langganan',
  },
  {
    key: 'billing.manage',
    group: 'Tagihan',
    description: 'Mengubah paket dan detail pembayaran',
  },
  {
    key: 'attendance.read',
    group: 'Absensi',
    description: 'Melihat catatan absensi sendiri dan kalender',
  },
  {
    key: 'attendance.clock',
    group: 'Absensi',
    description: 'Clock in dan clock out di lokasi kerja ber-geofence',
  },
  {
    key: 'attendance.sites.manage',
    group: 'Absensi',
    description: 'Membuat dan mengedit lokasi kerja absensi',
  },
  {
    key: 'attendance.schedules.manage',
    group: 'Absensi',
    description: 'Menetapkan jadwal kerja mingguan',
  },
  {
    key: 'attendance.approve',
    group: 'Absensi',
    description: 'Menyetujui atau menolak catatan absensi',
  },
  {
    key: 'attendance.team.read',
    group: 'Absensi',
    description: 'Melihat kalender absensi tim dan antrean persetujuan',
  },
];

export function isPermissionKey(value: string): value is PermissionKey {
  return (ALL_PERMISSIONS as readonly string[]).includes(value);
}
