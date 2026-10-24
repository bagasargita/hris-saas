'use client';

import {
  ArrowLeftIcon,
  Building2Icon,
  KeyRoundIcon,
  ScrollTextIcon,
  UserIcon,
  UsersIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { UserDto } from '@saas/contracts';
import { Badge } from '@/components/ui/badge';
import { AppShell, type ShellNavItem } from './app-shell';

const ACCOUNT_NAV: ShellNavItem[] = [
  { label: 'Profil', href: '/account', icon: UserIcon },
  { label: 'Keamanan', href: '/account/security', icon: KeyRoundIcon },
];

const ADMIN_NAV: ShellNavItem[] = [
  { label: 'Tenant', href: '/admin', icon: Building2Icon },
  { label: 'Pengguna', href: '/admin/users', icon: UsersIcon },
  { label: 'Log audit', href: '/admin/audit-logs', icon: ScrollTextIcon },
];

function BackToWorkspaces() {
  return (
    <Link
      href="/tenants"
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
    >
      <ArrowLeftIcon className="size-4" /> Semua workspace
    </Link>
  );
}

export function AccountShell({ user, children }: { user: UserDto; children: ReactNode }) {
  return (
    <AppShell user={user} nav={ACCOUNT_NAV} sidebarHeader={<BackToWorkspaces />}>
      {children}
    </AppShell>
  );
}

export function AdminShell({ user, children }: { user: UserDto; children: ReactNode }) {
  return (
    <AppShell
      user={user}
      nav={ADMIN_NAV}
      sidebarHeader={<BackToWorkspaces />}
      sidebarFooter={
        <Badge variant="destructive" className="w-full justify-center">
          Administrasi platform
        </Badge>
      }
    >
      {children}
    </AppShell>
  );
}
