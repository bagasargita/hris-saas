'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { FormAlert } from '@/components/auth/auth-card';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError, errorMessage } from '@/lib/api/errors';
import { useCreateTenant } from '@/lib/api/hooks';
import { workspaceSchema } from '@/lib/validation';

type Values = z.infer<typeof workspaceSchema>;

export function CreateWorkspaceForm({ onCreated }: { onCreated?: () => void }) {
  const router = useRouter();
  const createTenant = useCreateTenant();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: { name: '', slug: '' },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async ({ name, slug }) => {
    setFormError(null);
    try {
      const context = await createTenant.mutateAsync({ name, ...(slug ? { slug } : {}) });
      onCreated?.();
      router.push(`/t/${context.tenant.slug}`);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'CONFLICT') {
        form.setError('slug', { message: error.message });
        return;
      }
      setFormError(errorMessage(error));
    }
  });

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="grid gap-4">
      {formError && <FormAlert>{formError}</FormAlert>}
      <FormField id="ws-name" label="Nama workspace" error={errors.name?.message}>
        <Input
          id="ws-name"
          placeholder="Acme Inc."
          autoFocus
          aria-invalid={!!errors.name}
          {...form.register('name')}
        />
      </FormField>
      <FormField
        id="ws-slug"
        label="URL (opsional)"
        error={errors.slug?.message}
        hint="Kosongkan untuk membuat otomatis dari nama."
      >
        <div className="flex items-center rounded-md border border-input shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
          <span className="pl-3 text-sm text-muted-foreground">/t/</span>
          <Input
            id="ws-slug"
            placeholder="acme"
            className="border-0 shadow-none focus-visible:ring-0"
            aria-invalid={!!errors.slug}
            {...form.register('slug')}
          />
        </div>
      </FormField>
      <Button type="submit" disabled={createTenant.isPending}>
        {createTenant.isPending ? 'Membuat…' : 'Buat workspace'}
      </Button>
    </form>
  );
}
