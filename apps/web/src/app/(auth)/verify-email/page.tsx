import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { VerifyEmail } from '@/components/auth/verify-email';

export const metadata: Metadata = { title: 'Verifikasi email', referrer: 'no-referrer' };

export default function VerifyEmailPage() {
  return (
    <AuthCard
      title="Verifikasi email Anda"
      description="Konfirmasi bahwa alamat ini milik Anda"
    >
      <Suspense>
        <VerifyEmail />
      </Suspense>
    </AuthCard>
  );
}
