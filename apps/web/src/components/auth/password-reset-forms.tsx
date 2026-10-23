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
        If an account exists for that address, you will receive a reset link shortly. The link
        expires in 1 hour.
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
        {isSubmitting ? 'Sending…' : 'Send reset link'}
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
        This reset link is incomplete.{' '}
        <Link href="/forgot-password" className="font-medium underline">
          Request a new one
        </Link>
        .
      </FormAlert>
    );
  }

  if (done) {
    return (
      <div className="grid gap-4">
        <FormAlert tone="success">
          Your password was changed and all other sessions were signed out.
        </FormAlert>
        <Button asChild className="w-full">
          <Link href="/login">Continue to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="grid gap-4">
      {formError && <FormAlert>{formError}</FormAlert>}
      <FormField
        id="password"
        label="New password"
        error={errors.password?.message}
        hint={`At least ${PASSWORD_MIN} characters.`}
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
      <FormField id="confirm" label="Confirm new password" error={errors.confirm?.message}>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirm}
          {...form.register('confirm')}
        />
      </FormField>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Saving…' : 'Set new password'}
      </Button>
    </form>
  );
}
