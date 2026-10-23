import type { ReactNode } from 'react';
import { AccountShell } from '@/components/layout/section-shells';
import { requireUser } from '@/lib/auth';

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const me = await requireUser('/account');
  return <AccountShell user={me.user}>{children}</AccountShell>;
}
