import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { AcceptInvitation } from '@/components/auth/accept-invitation';

export const metadata: Metadata = { title: 'Terima undangan', referrer: 'no-referrer' };

export default function AcceptInvitationPage() {
  return (
    <AuthCard title="Anda diundang" description="Tinjau undangan di bawah">
      <Suspense>
        <AcceptInvitation />
      </Suspense>
    </AuthCard>
  );
}
