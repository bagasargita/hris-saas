import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/auth-card';
import { RegisterForm } from '@/components/auth/register-form';

export const metadata: Metadata = { title: 'Buat akun' };

export default function RegisterPage() {
  return (
    <AuthCard
      title="Buat akun Anda"
      description="Mulai dengan workspace gratis untuk tim Anda"
      footer={
        <span>
          Sudah punya akun?{' '}
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Masuk
          </Link>
        </span>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
