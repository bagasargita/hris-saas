import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { AcceptInvitation } from '@/components/auth/accept-invitation';

export const metadata: Metadata = { title: 'Accept invitation', referrer: 'no-referrer' };

export default function AcceptInvitationPage() {
  return (
    <AuthCard title="You're invited" description="Review the invitation below">
      <Suspense>
        <AcceptInvitation />
      </Suspense>
    </AuthCard>
  );
}
