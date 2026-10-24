import type { ReactNode } from 'react';
import { AdminShell } from '@/components/layout/section-shells';
import { AccessDenied } from '@/components/states';
import { requireUser } from '@/lib/auth';

/** Hides the console from non-admins. The API independently enforces SUPER_ADMIN on every /platform call. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const me = await requireUser('/admin');
  if (me.user.platformRole !== 'SUPER_ADMIN') {
    return (
      <div className="mx-auto max-w-lg px-4 py-24">
        <AccessDenied description="Konsol platform hanya tersedia untuk administrator platform." />
      </div>
    );
  }
  return <AdminShell user={me.user}>{children}</AdminShell>;
}
