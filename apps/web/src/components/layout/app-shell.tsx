'use client';

import { MenuIcon, PanelLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { UserDto } from '@saas/contracts';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/ui-store';
import { Logo } from './logo';
import type { NavItem } from './nav';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

export interface ShellNavItem extends Omit<NavItem, 'permission'> {
  href: string;
}

function NavLinks({
  items,
  collapsed,
  onNavigate,
}: {
  items: ShellNavItem[];
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  // Longest matching prefix wins so `/t/acme` (overview) is not active on `/t/acme/members`.
  const activeHref = items
    .map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {items.map((item) => {
        const active = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            title={collapsed ? item.label : undefined}
            className={cn(
              'flex h-9 items-center gap-3 rounded-md px-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              active && 'bg-sidebar-accent text-sidebar-accent-foreground',
              collapsed && 'justify-center px-0',
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  user,
  nav,
  sidebarHeader,
  sidebarFooter,
  children,
}: {
  user: Pick<UserDto, 'name' | 'email' | 'platformRole'>;
  nav: ShellNavItem[];
  sidebarHeader?: ReactNode;
  sidebarFooter?: ReactNode;
  children: ReactNode;
}) {
  const { sidebarCollapsed, toggleSidebar, mobileNavOpen, setMobileNavOpen } = useUiStore();

  return (
    <div className="flex min-h-svh">
      <aside
        className={cn(
          'sticky top-0 hidden h-svh shrink-0 flex-col border-r bg-sidebar transition-[width] duration-200 md:flex',
          sidebarCollapsed ? 'w-16' : 'w-64',
        )}
      >
        <div
          className={cn(
            'flex h-14 items-center border-b px-4',
            sidebarCollapsed && 'justify-center px-0',
          )}
        >
          <Logo href="/tenants" compact={sidebarCollapsed} />
        </div>
        {!sidebarCollapsed && sidebarHeader && <div className="border-b p-2">{sidebarHeader}</div>}
        <div className="flex-1 overflow-y-auto p-2">
          <NavLinks items={nav} collapsed={sidebarCollapsed} />
        </div>
        {!sidebarCollapsed && sidebarFooter && <div className="border-t p-3">{sidebarFooter}</div>}
      </aside>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-14 items-center border-b px-4">
            <Logo href="/tenants" />
          </div>
          {sidebarHeader && <div className="border-b p-2">{sidebarHeader}</div>}
          <div className="flex-1 overflow-y-auto p-2">
            <NavLinks items={nav} collapsed={false} onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
          >
            <MenuIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
          >
            <PanelLeftIcon />
          </Button>
          <div className="flex-1" />
          <ThemeToggle />
          <UserMenu user={user} />
        </header>
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
