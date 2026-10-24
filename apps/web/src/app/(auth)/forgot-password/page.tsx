import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/auth-card';
import { ForgotPasswordForm } from '@/components/auth/password-reset-forms';

export const metadata: Metadata = { title: 'Lupa kata sandi' };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Atur ulang kata sandi"
      description="Masukkan email Anda dan kami akan mengirim tautan reset"
      footer={
        <Link href="/login" className="hover:text-foreground">
          Kembali ke masuk
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
