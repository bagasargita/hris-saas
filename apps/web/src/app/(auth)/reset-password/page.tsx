import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { ResetPasswordForm } from '@/components/auth/password-reset-forms';

export const metadata: Metadata = { title: 'Choose a new password', referrer: 'no-referrer' };

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Choose a new password" description="This will sign you out everywhere else">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
