'use client';

import type { ReactNode } from 'react';
import type { MembershipSummaryDto, TenantContextResponse, UserDto } from '@saas/contracts';
import { AppShell } from '@/components/layout/app-shell';
import { TENANT_NAV } from '@/components/layout/nav';
import { TenantSwitcher } from '@/components/layout/tenant-switcher';
import { Badge } from '@/components/ui/badge';
import { TenantProvider } from './tenant-context';

export function TenantShell({
  user,
  context,
  memberships,
  children,
}: {
  user: UserDto;
  context: TenantContextResponse;
  memberships: MembershipSummaryDto[];
  children: ReactNode;
}) {
  const permissions = new Set(context.permissions);
  const basePath = `/t/${context.tenant.slug}`;
  const nav = TENANT_NAV.filter((item) => !item.permission || permissions.has(item.permission)).map(
    ({ permission: _permission, ...item }) => ({
      ...item,
      href: `${basePath}${item.href}`,
    }),
  );

  return (
    <TenantProvider context={context}>
      <AppShell
        user={user}
        nav={nav}
        sidebarHeader={<TenantSwitcher current={context.tenant} memberships={memberships} />}
        sidebarFooter={
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate">{context.roles.map((r) => r.name).join(', ')}</span>
            <Badge variant="secondary">{context.tenant.plan}</Badge>
          </div>
        }
      >
        {children}
      </AppShell>
    </TenantProvider>
  );
}
