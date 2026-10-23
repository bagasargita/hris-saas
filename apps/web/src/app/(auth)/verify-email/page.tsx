import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { VerifyEmail } from '@/components/auth/verify-email';

export const metadata: Metadata = { title: 'Verify email', referrer: 'no-referrer' };

export default function VerifyEmailPage() {
  return (
    <AuthCard title="Verify your email" description="Confirm this address belongs to you">
      <Suspense>
        <VerifyEmail />
      </Suspense>
    </AuthCard>
  );
}
