import { ArrowRightIcon, Building2Icon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/layout/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { UserMenu } from '@/components/layout/user-menu';
import { CreateWorkspaceForm } from '@/components/tenant/create-workspace-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Workspaces' };

export default async function TenantsPage() {
  const me = await requireUser('/tenants');
  const usable = me.memberships.filter(
    (m) => m.status === 'ACTIVE' && m.tenant.status === 'ACTIVE',
  );
  const unavailable = me.memberships.filter(
    (m) => !(m.status === 'ACTIVE' && m.tenant.status === 'ACTIVE'),
  );

  return (
    <div className="min-h-svh">
      <header className="flex h-16 items-center justify-between border-b px-4 md:px-8">
        <Logo href="/tenants" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserMenu user={me.user} />
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-[1fr_360px] md:px-8">
        <section>
          <h1 className="text-2xl font-semibold tracking-tight">Your workspaces</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a workspace to continue, or create a new one.
          </p>
          <div className="mt-6 grid gap-3">
            {usable.length === 0 && (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                You are not a member of any workspace yet. Create one, or ask a teammate to invite
                you.
              </div>
            )}
            {usable.map((m) => (
              <Link
                key={m.tenant.id}
                href={`/t/${m.tenant.slug}`}
                className="group flex items-center gap-4 rounded-xl border bg-card p-4 shadow-xs transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 font-semibold text-primary">
                  {m.tenant.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.tenant.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    /t/{m.tenant.slug} · {m.roles.map((r) => r.name).join(', ')}
                  </p>
                </div>
                <Badge variant="secondary">{m.tenant.plan}</Badge>
                <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
            {unavailable.map((m) => (
              <div
                key={m.tenant.id}
                className="flex items-center gap-4 rounded-xl border border-dashed p-4 opacity-70"
              >
                <Building2Icon className="size-5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.tenant.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {m.tenant.status !== 'ACTIVE'
                      ? 'This workspace is suspended.'
                      : 'Your access to this workspace is suspended.'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <aside>
          <Card>
            <CardHeader>
              <CardTitle>Create a workspace</CardTitle>
              <CardDescription>You will be its owner.</CardDescription>
            </CardHeader>
            <CardContent>
              <CreateWorkspaceForm />
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}
