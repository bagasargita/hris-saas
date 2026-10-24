import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = { title: 'Masuk' };

export default function LoginPage() {
  return (
    <AuthCard
      title="Selamat datang kembali"
      description="Masuk ke akun Anda"
      footer={
        <span>
          Baru di sini?{' '}
          <Link
            href="/register"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Buat akun
          </Link>
        </span>
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
