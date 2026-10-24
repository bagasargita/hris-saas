'use client';

import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { MembershipSummaryDto } from '@saas/contracts';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiPost } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import { queryKeys } from '@/lib/api/query-keys';
import { canCreateWorkspace } from '@/lib/workspace-access';

export function TenantSwitcher({
  current,
  memberships,
}: {
  current: { id: string; name: string };
  memberships: MembershipSummaryDto[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const active = memberships.filter((m) => m.status === 'ACTIVE' && m.tenant.status === 'ACTIVE');
  const allowCreate = canCreateWorkspace(memberships);

  const switchTo = async (membership: MembershipSummaryDto) => {
    try {
      // The API verifies membership before recording the active tenant; the URL alone grants nothing.
      await apiPost('/auth/active-tenant', { tenantId: membership.tenant.id });
      queryClient.removeQueries({ queryKey: queryKeys.tenant(current.id) });
      router.push(`/t/${membership.tenant.slug}`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between gap-2 px-2"
          aria-label="Ganti ruang kerja"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
              {current.name.charAt(0).toUpperCase()}
            </span>
            <span className="truncate text-sm font-medium">{current.name}</span>
          </span>
          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Ruang kerja</DropdownMenuLabel>
        {active.map((membership) => (
          <DropdownMenuItem key={membership.tenant.id} onSelect={() => void switchTo(membership)}>
            <span className="flex size-5 items-center justify-center rounded bg-muted text-[10px] font-semibold">
              {membership.tenant.name.charAt(0).toUpperCase()}
            </span>
            <span className="flex-1 truncate">{membership.tenant.name}</span>
            {membership.tenant.id === current.id && <CheckIcon />}
          </DropdownMenuItem>
        ))}
        {allowCreate && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push('/tenants?create=1')}>
              <PlusIcon /> Buat ruang kerja
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
