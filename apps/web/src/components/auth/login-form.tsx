'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { LoginResponse } from '@saas/contracts';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiPost } from '@/lib/api/client';
import { ApiError, errorMessage } from '@/lib/api/errors';
import { safeRedirectPath } from '@/lib/safe-redirect';
import { loginSchema, type LoginValues } from '@/lib/validation';
import { FormAlert } from './auth-card';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const reason = searchParams.get('reason');

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    setUnverifiedEmail(null);
    try {
      await apiPost<LoginResponse>('/auth/login', values);
      // Anything cached before login belongs to an anonymous or previous session.
      queryClient.clear();
      router.replace(safeRedirectPath(searchParams.get('next')));
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EMAIL_NOT_VERIFIED')
        setUnverifiedEmail(values.email);
      setFormError(errorMessage(error));
      form.resetField('password');
    }
  });

  const resend = async () => {
    if (!unverifiedEmail) return;
    try {
      await apiPost('/auth/resend-verification', { email: unverifiedEmail });
      setFormError('Jika akun perlu diverifikasi, tautan baru akan segera dikirim.');
      setUnverifiedEmail(null);
    } catch (error) {
      setFormError(errorMessage(error));
    }
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="grid gap-4">
      {reason === 'expired' && !formError && (
        <FormAlert tone="info">Sesi Anda telah berakhir. Silakan masuk kembali.</FormAlert>
      )}
      {formError && (
        <FormAlert>
          {formError}
          {unverifiedEmail && (
            <button
              type="button"
              onClick={() => void resend()}
              className="ml-1 font-medium underline underline-offset-2"
            >
              Kirim ulang email verifikasi
            </button>
          )}
        </FormAlert>
      )}
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
      <FormField
        id="password"
        label={
          <span className="flex w-full items-center justify-between">
            Kata sandi
            <Link
              href="/forgot-password"
              className="text-xs font-normal text-muted-foreground hover:text-foreground"
            >
              Lupa kata sandi?
            </Link>
          </span>
        }
        error={errors.password?.message}
      >
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...form.register('password')}
        />
      </FormField>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Memproses masuk…' : 'Masuk'}
      </Button>
    </form>
  );
}
