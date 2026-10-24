'use client';

import type { UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import type { AuditLogDto, Paginated } from '@saas/contracts';
import { DataTable, type AppColumnDef } from '@/components/data-table/data-table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AuditListParams } from '@/lib/api/hooks';
import { formatDateTime } from '@/lib/utils';

const ACTION_FILTERS = [
  { value: 'all', label: 'Semua peristiwa' },
  { value: 'auth.', label: 'Autentikasi' },
  { value: 'member.', label: 'Anggota' },
  { value: 'role.', label: 'Peran' },
  { value: 'invitation.', label: 'Undangan' },
  { value: 'tenant.', label: 'Ruang kerja' },
  { value: 'platform.', label: 'Platform' },
] as const;

function actionVariant(action: string): 'destructive' | 'secondary' | 'default' {
  if (/(failed|removed|revoked|deleted|suspend)/.test(action)) return 'destructive';
  if (action.startsWith('auth.')) return 'secondary';
  return 'default';
}

function MetadataSummary({ metadata }: { metadata: Record<string, unknown> | null }) {
  if (!metadata) return <span className="text-muted-foreground">—</span>;
  const entries = Object.entries(metadata).slice(0, 3);
  return (
    <span
      className="block max-w-72 truncate text-xs text-muted-foreground"
      title={JSON.stringify(metadata)}
    >
      {entries
        .map(
          ([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`,
        )
        .join(' · ')}
    </span>
  );
}

export function AuditLogTable({
  useData,
  showTenant = false,
  includePlatformFilter = false,
}: {
  useData: (params: AuditListParams) => UseQueryResult<Paginated<AuditLogDto>>;
  showTenant?: boolean;
  includePlatformFilter?: boolean;
}) {
  const [params, setParams] = useState<AuditListParams>({ page: 1, limit: 25 });
  const query = useData(params);
  const filters = ACTION_FILTERS.filter((f) => includePlatformFilter || f.value !== 'platform.');

  const columns: AppColumnDef<AuditLogDto>[] = [
    {
      id: 'when',
      header: 'Waktu',
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {formatDateTime(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: 'action',
      header: 'Peristiwa',
      cell: ({ row }) => (
        <Badge variant={actionVariant(row.original.action)} className="font-mono">
          {row.original.action}
        </Badge>
      ),
    },
    {
      id: 'actor',
      header: 'Pelaku',
      cell: ({ row }) =>
        row.original.actor ? (
          <div className="min-w-0">
            <p className="truncate text-sm">{row.original.actor.name}</p>
            <p className="truncate text-xs text-muted-foreground">{row.original.actor.email}</p>
          </div>
        ) : (
          <span className="text-muted-foreground">Sistem</span>
        ),
    },
    ...(showTenant
      ? [
          {
            id: 'tenant',
            header: 'Penyewa',
            cell: ({ row }) => (
              <code className="text-xs">{row.original.tenantId?.slice(0, 8) ?? '—'}</code>
            ),
          } satisfies AppColumnDef<AuditLogDto>,
        ]
      : []),
    {
      id: 'details',
      header: 'Detail',
      cell: ({ row }) => <MetadataSummary metadata={row.original.metadata} />,
    },
    {
      id: 'ip',
      header: 'IP',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.ipAddress ?? '—'}
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4">
        <Select
          value={params.action ?? 'all'}
          onValueChange={(v) =>
            setParams((p) => ({ ...p, page: 1, action: v === 'all' ? undefined : v }))
          }
        >
          <SelectTrigger className="w-48" aria-label="Filter menurut jenis peristiwa">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {filters.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DataTable
        columns={columns}
        data={query.data?.data}
        meta={query.data?.meta}
        isLoading={query.isPending}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        onPageChange={(page) => setParams((p) => ({ ...p, page }))}
        getRowId={(log) => log.id}
        emptyTitle="Belum ada peristiwa tercatat"
      />
    </>
  );
}
