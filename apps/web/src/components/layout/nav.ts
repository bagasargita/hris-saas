import {
  CreditCardIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  MailIcon,
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
  { label: 'Overview', href: '', icon: LayoutDashboardIcon },
  { label: 'Members', href: '/members', icon: UsersIcon, permission: 'members.read' },
  { label: 'Invitations', href: '/invitations', icon: MailIcon, permission: 'members.read' },
  { label: 'Roles', href: '/roles', icon: ShieldCheckIcon, permission: 'roles.read' },
  { label: 'Permissions', href: '/permissions', icon: KeyRoundIcon, permission: 'roles.read' },
  { label: 'Audit log', href: '/audit-logs', icon: ScrollTextIcon, permission: 'audit_logs.read' },
  { label: 'Billing', href: '/billing', icon: CreditCardIcon, permission: 'billing.read' },
  { label: 'Settings', href: '/settings', icon: SettingsIcon, permission: 'tenant.read' },
];
