'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiPost } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import { forgotPasswordSchema, PASSWORD_MIN, resetPasswordSchema } from '@/lib/validation';
import { FormAlert } from './auth-card';

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await apiPost('/auth/forgot-password', values);
      setSent(true);
    } catch (error) {
      setFormError(errorMessage(error));
    }
  });

  if (sent) {
    return (
      <FormAlert tone="success">
        Jika akun terdaftar untuk alamat tersebut, Anda akan menerima tautan reset sebentar lagi.
        Tautan berlaku selama 1 jam.
      </FormAlert>
    );
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="grid gap-4">
      {formError && <FormAlert>{formError}</FormAlert>}
      <FormField id="email" label="Email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          aria-invalid={!!errors.email}
          {...form.register('email')}
        />
      </FormField>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Mengirim…' : 'Kirim tautan reset'}
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const token = useSearchParams().get('token');
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirm: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ password }) => {
    setFormError(null);
    try {
      await apiPost('/auth/reset-password', { token, password });
      setDone(true);
    } catch (error) {
      setFormError(errorMessage(error));
    }
  });

  if (!token) {
    return (
      <FormAlert>
        Tautan reset ini tidak lengkap.{' '}
        <Link href="/forgot-password" className="font-medium underline">
          Minta tautan baru
        </Link>
        .
      </FormAlert>
    );
  }

  if (done) {
    return (
      <div className="grid gap-4">
        <FormAlert tone="success">
          Kata sandi Anda telah diubah dan semua sesi lain telah keluar.
        </FormAlert>
        <Button asChild className="w-full">
          <Link href="/login">Lanjutkan masuk</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="grid gap-4">
      {formError && <FormAlert>{formError}</FormAlert>}
      <FormField
        id="password"
        label="Kata sandi baru"
        error={errors.password?.message}
        hint={`Minimal ${PASSWORD_MIN} karakter.`}
      >
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          autoFocus
          aria-invalid={!!errors.password}
          {...form.register('password')}
        />
      </FormField>
      <FormField id="confirm" label="Konfirmasi kata sandi baru" error={errors.confirm?.message}>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirm}
          {...form.register('confirm')}
        />
      </FormField>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Menyimpan…' : 'Atur kata sandi baru'}
      </Button>
    </form>
  );
}
