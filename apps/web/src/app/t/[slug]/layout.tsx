import type { ReactNode } from 'react';
import { AccessDenied } from '@/components/states';
import { TenantShell } from '@/components/tenant/tenant-shell';
import { getTenantContext } from '@/lib/api/server';
import { requireUser } from '@/lib/auth';

/**
 * The slug in the URL is only a lookup key. It is resolved against the memberships the API returned
 * for this session, and the tenant context (roles, permissions) is fetched from the API, which
 * re-verifies membership. Unknown and forbidden workspaces render the same screen.
 */
export default async function TenantLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const me = await requireUser(`/t/${slug}`);
  const membership = me.memberships.find((m) => m.tenant.slug === slug);
  const context = membership ? await getTenantContext(membership.tenant.id) : null;

  if (!context) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24">
        <AccessDenied description="This workspace does not exist or you do not have access to it." />
      </div>
    );
  }

  return (
    <TenantShell user={me.user} context={context} memberships={me.memberships}>
      {children}
    </TenantShell>
  );
}
