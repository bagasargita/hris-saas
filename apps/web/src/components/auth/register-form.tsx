'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheckIcon } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiPost } from '@/lib/api/client';
import { ApiError, errorMessage } from '@/lib/api/errors';
import { PASSWORD_MIN, registerSchema, type RegisterValues } from '@/lib/validation';
import { FormAlert } from './auth-card';

export function RegisterForm() {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await apiPost('/auth/register', values);
      setSubmittedEmail(values.email);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VALIDATION_ERROR') {
        for (const [field, message] of Object.entries(error.fieldErrors())) {
          if (field === 'name' || field === 'email' || field === 'password')
            form.setError(field, { message });
        }
      }
      setFormError(errorMessage(error));
    }
  });

  if (submittedEmail) {
    // Same message whether or not the email was already registered (prevents account enumeration).
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MailCheckIcon className="size-5" />
        </div>
        <h2 className="font-medium">Check your inbox</h2>
        <p className="text-sm text-muted-foreground">
          We sent a verification link to{' '}
          <strong className="text-foreground">{submittedEmail}</strong>. Follow it to activate your
          account.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="grid gap-4">
      {formError && <FormAlert>{formError}</FormAlert>}
      <FormField id="name" label="Full name" error={errors.name?.message}>
        <Input
          id="name"
          autoComplete="name"
          autoFocus
          aria-invalid={!!errors.name}
          {...form.register('name')}
        />
      </FormField>
      <FormField id="email" label="Work email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          {...form.register('email')}
        />
      </FormField>
      <FormField
        id="password"
        label="Password"
        error={errors.password?.message}
        hint={`At least ${PASSWORD_MIN} characters. A passphrase works well.`}
      >
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          {...form.register('password')}
        />
      </FormField>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  );
}
