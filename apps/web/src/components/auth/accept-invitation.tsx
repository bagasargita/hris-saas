'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2Icon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { InvitationPreviewDto, MeResponse, TenantContextResponse } from '@saas/contracts';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { apiGet, apiPost } from '@/lib/api/client';
import { ApiError, errorMessage } from '@/lib/api/errors';
import { queryKeys } from '@/lib/api/query-keys';
import { formatDate } from '@/lib/utils';
import { FormAlert } from './auth-card';

async function fetchMeOrNull(): Promise<MeResponse | null> {
  try {
    return await apiGet<MeResponse>('/auth/me');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function AcceptInvitation() {
  const token = useSearchParams().get('token');
  const router = useRouter();
  const queryClient = useQueryClient();
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  const preview = useQuery({
    queryKey: ['invitation-preview', token],
    queryFn: () => apiPost<InvitationPreviewDto>('/invitations/preview', { token }),
    enabled: !!token,
    retry: false,
  });
  const me = useQuery({
    queryKey: [...queryKeys.me, 'optional'],
    queryFn: fetchMeOrNull,
    retry: false,
  });

  if (!token) return <FormAlert>Tautan undangan ini tidak lengkap.</FormAlert>;
  if (preview.isPending || me.isPending) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }
  if (preview.isError)
    return (
      <FormAlert>
        {errorMessage(preview.error, 'Undangan ini tidak valid atau sudah kedaluwarsa.')}
      </FormAlert>
    );

  const invitation = preview.data;
  const user = me.data?.user ?? null;
  const returnTo = `/invitations/accept?token=${encodeURIComponent(token)}`;

  const accept = async () => {
    setAccepting(true);
    setAcceptError(null);
    try {
      const context = await apiPost<TenantContextResponse>('/invitations/accept', { token });
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
      router.replace(`/t/${context.tenant.slug}`);
      router.refresh();
    } catch (error) {
      setAcceptError(errorMessage(error));
      setAccepting(false);
    }
  };

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Building2Icon className="size-5" />
        </div>
        <div className="min-w-0 text-sm">
          <p className="truncate font-medium">{invitation.tenantName}</p>
          <p className="text-muted-foreground">
            Bergabung sebagai <strong className="text-foreground">{invitation.roleName}</strong> ·
            kedaluwarsa{' '}
            {formatDate(invitation.expiresAt)}
          </p>
        </div>
      </div>
      {acceptError && <FormAlert>{acceptError}</FormAlert>}
      {user ? (
        user.email === invitation.email ? (
          <Button onClick={() => void accept()} disabled={accepting} className="w-full">
            {accepting ? 'Bergabung…' : `Bergabung dengan ${invitation.tenantName}`}
          </Button>
        ) : (
          <FormAlert>
            Undangan ini dikirim ke <strong>{invitation.email}</strong>, tetapi Anda masuk sebagai{' '}
            <strong>{user.email}</strong>. Masuk dengan akun yang diundang untuk menerimanya.
          </FormAlert>
        )
      ) : (
        <div className="grid gap-2">
          <p className="text-center text-sm text-muted-foreground">
            Masuk atau buat akun sebagai{' '}
            <strong className="text-foreground">{invitation.email}</strong> untuk menerima undangan.
          </p>
          <Button asChild className="w-full">
            <Link href={`/login?next=${encodeURIComponent(returnTo)}`}>Masuk untuk menerima</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/register">Buat akun</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
