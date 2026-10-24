import {
  CalendarDaysIcon,
  ClockIcon,
  CreditCardIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  MailIcon,
  MapPinIcon,
  CalendarClockIcon,
  ClipboardCheckIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';
import type { PermissionKey } from '@saas/contracts';

export interface NavItem {
  label: string;
  /** Relative to the workspace base path (`/t/<slug>`). */
  href: string;
  icon: LucideIcon;
  permission?: PermissionKey;
}

export const TENANT_NAV: NavItem[] = [
  { label: 'Ringkasan', href: '', icon: LayoutDashboardIcon },
  { label: 'Absensi', href: '/attendance', icon: ClockIcon, permission: 'attendance.read' },
  {
    label: 'Persetujuan',
    href: '/attendance/approvals',
    icon: ClipboardCheckIcon,
    permission: 'attendance.approve',
  },
  {
    label: 'Kalender',
    href: '/attendance/calendar',
    icon: CalendarDaysIcon,
    permission: 'attendance.read',
  },
  {
    label: 'Lokasi',
    href: '/attendance/sites',
    icon: MapPinIcon,
    permission: 'attendance.sites.manage',
  },
  {
    label: 'Jadwal',
    href: '/attendance/schedules',
    icon: CalendarClockIcon,
    permission: 'attendance.schedules.manage',
  },
  { label: 'Anggota', href: '/members', icon: UsersIcon, permission: 'members.read' },
  { label: 'Undangan', href: '/invitations', icon: MailIcon, permission: 'members.read' },
  { label: 'Peran', href: '/roles', icon: ShieldCheckIcon, permission: 'roles.read' },
  { label: 'Izin', href: '/permissions', icon: KeyRoundIcon, permission: 'roles.read' },
  { label: 'Log audit', href: '/audit-logs', icon: ScrollTextIcon, permission: 'audit_logs.read' },
  { label: 'Tagihan', href: '/billing', icon: CreditCardIcon, permission: 'billing.read' },
  { label: 'Pengaturan', href: '/settings', icon: SettingsIcon, permission: 'tenant.read' },
];
