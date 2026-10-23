import type { Metadata } from 'next';
import { Suspense } from 'react';
import { InvitationsPage } from '@/components/tenant/invitations-page';

export const metadata: Metadata = { title: 'Invitations' };

export default function Page() {
  return (
    <Suspense>
      <InvitationsPage />
    </Suspense>
  );
}
