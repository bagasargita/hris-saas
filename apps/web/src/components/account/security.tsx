'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LaptopIcon, LogOutIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { FormField } from '@/components/form-field';
import { ErrorState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
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
import { Skeleton } from '@/components/ui/misc';
import { apiPost } from '@/lib/api/client';
import { ApiError, errorMessage } from '@/lib/api/errors';
import { useRevokeOtherSessions, useRevokeSession, useSessions } from '@/lib/api/hooks';
import { formatDateTime } from '@/lib/utils';
import { changePasswordSchema, PASSWORD_MIN } from '@/lib/validation';

type PasswordValues = z.infer<typeof changePasswordSchema>;

export function ChangePasswordCard() {
  const form = useForm<PasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await apiPost('/users/me/password', { currentPassword, newPassword });
      form.reset();
      toast.success('Kata sandi diubah. Sesi lain telah keluar.');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') {
        form.setError('currentPassword', { message: 'Kata sandi saat ini salah' });
        return;
      }
      toast.error(errorMessage(error));
    }
  });

  return (
    <Card>
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="contents">
        <CardHeader>
          <CardTitle>Kata sandi</CardTitle>
          <CardDescription>
            Mengubah kata sandi akan mengeluarkan semua sesi lain Anda.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FormField
            id="current-password"
            label="Kata sandi saat ini"
            error={errors.currentPassword?.message}
          >
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              aria-invalid={!!errors.currentPassword}
              {...form.register('currentPassword')}
            />
          </FormField>
          <FormField
            id="new-password"
            label="Kata sandi baru"
            error={errors.newPassword?.message}
            hint={`Minimal ${PASSWORD_MIN} karakter.`}
          >
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.newPassword}
              {...form.register('newPassword')}
            />
          </FormField>
          <FormField
            id="confirm-password"
            label="Konfirmasi kata sandi baru"
            error={errors.confirm?.message}
          >
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.confirm}
              {...form.register('confirm')}
            />
          </FormField>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Memperbarui…' : 'Perbarui kata sandi'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function describeAgent(userAgent: string | null): string {
  if (!userAgent) return 'Perangkat tidak dikenal';
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Chrome\//.test(userAgent)
      ? 'Chrome'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : 'Browser';
  const os = /Windows/.test(userAgent)
    ? 'Windows'
    : /Mac OS X/.test(userAgent)
      ? 'macOS'
      : /Android/.test(userAgent)
        ? 'Android'
        : /iPhone|iPad/.test(userAgent)
          ? 'iOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : '';
  return os ? `${browser} di ${os}` : browser;
}

export function SessionsCard() {
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const others = sessions.data?.filter((s) => !s.current).length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sesi aktif</CardTitle>
        <CardDescription>Perangkat yang saat ini masuk ke akun Anda.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {sessions.isError && <ErrorState onRetry={() => void sessions.refetch()} />}
        {sessions.isPending &&
          Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-16" />)}
        {sessions.data?.map((session) => (
          <div key={session.id} className="flex items-center gap-3 rounded-lg border p-3">
            <LaptopIcon className="size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="flex items-center gap-2 font-medium">
                {describeAgent(session.userAgent)}
                {session.current && <Badge variant="success">Perangkat ini</Badge>}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {session.ipAddress ?? 'IP tidak dikenal'} · terakhir aktif{' '}
                {formatDateTime(session.lastUsedAt)}
              </p>
            </div>
            {!session.current && (
              <Button
                variant="ghost"
                size="sm"
                disabled={revoke.isPending}
                onClick={() =>
                  revoke.mutate(session.id, {
                    onSuccess: () => toast.success('Sesi telah keluar'),
                    onError: (error) => toast.error(errorMessage(error)),
                  })
                }
              >
                Keluar
              </Button>
            )}
          </div>
        ))}
      </CardContent>
      {others > 0 && (
        <CardFooter className="justify-end">
          <Button
            variant="outline"
            disabled={revokeOthers.isPending}
            onClick={() =>
              revokeOthers.mutate(undefined, {
                onSuccess: (result) =>
                  toast.success(
                    `Keluar dari ${result.revoked} sesi lain${result.revoked === 1 ? '' : ''}`,
                  ),
                onError: (error) => toast.error(errorMessage(error)),
              })
            }
          >
            <LogOutIcon /> Keluar dari semua sesi lain
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
