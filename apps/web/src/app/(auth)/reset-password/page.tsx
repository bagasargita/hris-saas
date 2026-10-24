import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { ResetPasswordForm } from '@/components/auth/password-reset-forms';

export const metadata: Metadata = { title: 'Pilih kata sandi baru', referrer: 'no-referrer' };

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Pilih kata sandi baru"
      description="Anda akan keluar dari semua perangkat lain"
    >
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
