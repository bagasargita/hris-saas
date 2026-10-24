import type { Metadata } from 'next';
import { Suspense } from 'react';
import { InvitationsPage } from '@/components/tenant/invitations-page';

export const metadata: Metadata = { title: 'Undangan' };

export default function Page() {
  return (
    <Suspense>
      <InvitationsPage />
    </Suspense>
  );
}
