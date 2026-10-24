'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FormField } from '@/components/form-field';
import { PageHeader } from '@/components/layout/page-header';
import { AccessDenied } from '@/components/states';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { errorMessage } from '@/lib/api/errors';
import { useLeaveTenant, useUpdateTenant } from '@/lib/api/hooks';
import { formatDate } from '@/lib/utils';
import { workspaceSchema } from '@/lib/validation';
import { useTenant } from './tenant-context';

const nameSchema = workspaceSchema.pick({ name: true });

export function SettingsPage() {
  const { tenant, can } = useTenant();
  const router = useRouter();
  const update = useUpdateTenant(tenant.id);
  const leave = useLeaveTenant(tenant.id);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const canUpdate = can('tenant.update');
  const form = useForm<z.infer<typeof nameSchema>>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: tenant.name },
  });
  const { errors, isDirty } = form.formState;

  if (!can('tenant.read')) return <AccessDenied />;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync(values);
      form.reset(values);
      toast.success('Workspace diperbarui');
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  return (
    <>
      <PageHeader
        title="Pengaturan"
        description="Kelola tampilan workspace ini bagi anggotanya."
      />
      <div className="grid max-w-2xl gap-6">
        <Card>
          <form onSubmit={(event) => void onSubmit(event)} noValidate className="contents">
            <CardHeader>
              <CardTitle>Umum</CardTitle>
              <CardDescription>
                Dibuat {formatDate(tenant.createdAt)} · URL{' '}
                <code className="text-xs">/t/{tenant.slug}</code>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField id="tenant-name" label="Nama workspace" error={errors.name?.message}>
                <Input
                  id="tenant-name"
                  disabled={!canUpdate}
                  aria-invalid={!!errors.name}
                  {...form.register('name')}
                />
              </FormField>
            </CardContent>
            {canUpdate && (
              <CardFooter className="justify-end">
                <Button type="submit" disabled={!isDirty || update.isPending}>
                  {update.isPending ? 'Menyimpan…' : 'Simpan perubahan'}
                </Button>
              </CardFooter>
            )}
          </form>
        </Card>
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle>Tinggalkan workspace</CardTitle>
            <CardDescription>
              Anda akan segera kehilangan akses. Pemilik terakhir tidak dapat keluar hingga pemilik
              lain ditetapkan.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-end">
            <Button variant="destructive" onClick={() => setConfirmLeave(true)}>
              Tinggalkan {tenant.name}
            </Button>
          </CardFooter>
        </Card>
      </div>
      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title={`Tinggalkan ${tenant.name}?`}
        description="Anda memerlukan undangan baru untuk bergabung kembali."
        confirmLabel="Tinggalkan workspace"
        destructive
        pending={leave.isPending}
        onConfirm={() =>
          leave.mutate(undefined, {
            onSuccess: () => {
              toast.success(`Anda telah meninggalkan ${tenant.name}`);
              router.replace('/tenants');
              router.refresh();
            },
            onError: (error) => {
              toast.error(errorMessage(error));
              setConfirmLeave(false);
            },
          })
        }
      />
    </>
  );
}
