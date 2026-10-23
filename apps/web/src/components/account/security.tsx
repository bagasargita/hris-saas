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
      toast.success('Password changed. Other sessions were signed out.');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') {
        form.setError('currentPassword', { message: 'Current password is incorrect' });
        return;
      }
      toast.error(errorMessage(error));
    }
  });

  return (
    <Card>
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="contents">
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Changing your password signs out all of your other sessions.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FormField
            id="current-password"
            label="Current password"
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
            label="New password"
            error={errors.newPassword?.message}
            hint={`At least ${PASSWORD_MIN} characters.`}
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
            label="Confirm new password"
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
            {isSubmitting ? 'Updating…' : 'Update password'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function describeAgent(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';
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
  return os ? `${browser} on ${os}` : browser;
}

export function SessionsCard() {
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const others = sessions.data?.filter((s) => !s.current).length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active sessions</CardTitle>
        <CardDescription>Devices currently signed in to your account.</CardDescription>
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
                {session.current && <Badge variant="success">This device</Badge>}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {session.ipAddress ?? 'Unknown IP'} · last active{' '}
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
                    onSuccess: () => toast.success('Session signed out'),
                    onError: (error) => toast.error(errorMessage(error)),
                  })
                }
              >
                Sign out
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
                    `Signed out ${result.revoked} other session${result.revoked === 1 ? '' : 's'}`,
                  ),
                onError: (error) => toast.error(errorMessage(error)),
              })
            }
          >
            <LogOutIcon /> Sign out all other sessions
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
