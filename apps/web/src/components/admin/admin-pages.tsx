'use client';

import { SearchIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { PlatformTenantDto, PlatformUserDto } from '@saas/contracts';
import { AuditLogTable } from '@/components/audit-log-table';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable, type AppColumnDef } from '@/components/data-table/data-table';
import { useDebounced } from '@/components/data-table/use-debounced';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorMessage } from '@/lib/api/errors';
import {
  useDeletePlatformTenant,
  usePlatformAuditLogs,
  usePlatformTenants,
  usePlatformUsers,
  useSetPlatformTenantStatus,
  useSetPlatformUserStatus,
  type ListParams,
} from '@/lib/api/hooks';
import { formatDate } from '@/lib/utils';

function SearchBox({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div className="relative mb-4 max-w-md">
      <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        aria-label={label}
        className="pl-9"
        maxLength={100}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: 'ACTIVE' | 'SUSPENDED' }) {
  return status === 'ACTIVE' ? (
    <Badge variant="success">Aktif</Badge>
  ) : (
    <Badge variant="destructive">Ditangguhkan</Badge>
  );
}

export function AdminTenantsPage() {
  const [params, setParams] = useState<ListParams>({ page: 1, limit: 20 });
  const [search, setSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<PlatformTenantDto | null>(null);
  const debounced = useDebounced(search.trim());
  const query = usePlatformTenants({ ...params, search: debounced || undefined });
  const setStatus = useSetPlatformTenantStatus();
  const deleteTenant = useDeletePlatformTenant();

  const columns: AppColumnDef<PlatformTenantDto>[] = [
    {
      id: 'name',
      header: 'Tenant',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">/t/{row.original.slug}</p>
        </div>
      ),
    },
    {
      id: 'plan',
      header: 'Paket',
      cell: ({ row }) => <Badge variant="secondary">{row.original.plan}</Badge>,
    },
    {
      id: 'members',
      header: 'Anggota',
      cell: ({ row }) => <span className="tabular-nums">{row.original.memberCount}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'created',
      header: 'Dibuat',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDate(row.original.createdAt)}</span>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Tindakan</span>,
      cell: ({ row }) => {
        const next = row.original.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        return (
          <div className="flex flex-wrap justify-end gap-1">
            <Button
              variant={next === 'SUSPENDED' ? 'ghost' : 'outline'}
              size="sm"
              className={
                next === 'SUSPENDED' ? 'text-destructive hover:text-destructive' : undefined
              }
              disabled={setStatus.isPending || deleteTenant.isPending}
              onClick={() =>
                setStatus.mutate(
                  { tenantId: row.original.id, status: next },
                  {
                    onSuccess: () =>
                      toast.success(
                        `${row.original.name} ${next === 'SUSPENDED' ? 'ditangguhkan' : 'diaktifkan kembali'}`,
                      ),
                    onError: (error) => toast.error(errorMessage(error)),
                  },
                )
              }
            >
              {next === 'SUSPENDED' ? 'Tangguhkan' : 'Aktifkan kembali'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={setStatus.isPending || deleteTenant.isPending}
              onClick={() => setPendingDelete(row.original)}
            >
              Hapus
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Tenant"
        description="Semua workspace di platform. Penangguhan memblokir akses; penghapusan secara permanen menghapus workspace beserta keanggotaan, peran, undangan, dan riwayat audit tenant."
      />
      <SearchBox
        value={search}
        onChange={(v) => {
          setSearch(v);
          setParams((p) => ({ ...p, page: 1 }));
        }}
        label="Cari tenant berdasarkan nama atau slug"
      />
      <DataTable
        columns={columns}
        data={query.data?.data}
        meta={query.data?.meta}
        isLoading={query.isPending}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        onPageChange={(page) => setParams((p) => ({ ...p, page }))}
        getRowId={(t) => t.id}
        emptyTitle="Tenant tidak ditemukan"
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Hapus workspace secara permanen?"
        description={
          pendingDelete ? (
            <>
              Tindakan ini menghapus permanen <strong>{pendingDelete.name}</strong> (/t/
              {pendingDelete.slug}), termasuk {pendingDelete.memberCount} keanggotaan, peran,
              undangan, dan log audit tenant. Akun pengguna tetap ada. Tindakan ini tidak dapat
              dibatalkan.
            </>
          ) : null
        }
        confirmLabel="Hapus workspace"
        destructive
        pending={deleteTenant.isPending}
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteTenant.mutate(pendingDelete.id, {
            onSuccess: () => {
              toast.success(`${pendingDelete.name} dihapus`);
              setPendingDelete(null);
            },
            onError: (error) => toast.error(errorMessage(error)),
          });
        }}
      />
    </>
  );
}

export function AdminUsersPage({ currentUserId }: { currentUserId: string }) {
  const [params, setParams] = useState<ListParams>({ page: 1, limit: 20 });
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search.trim());
  const query = usePlatformUsers({ ...params, search: debounced || undefined });
  const setStatus = useSetPlatformUserStatus();

  const columns: AppColumnDef<PlatformUserDto>[] = [
    {
      id: 'user',
      header: 'Pengguna',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">
            {row.original.name}
            {row.original.platformRole === 'SUPER_ADMIN' && (
              <Badge variant="destructive" className="ml-2">
                Super admin
              </Badge>
            )}
          </p>
          <p className="text-xs text-muted-foreground">{row.original.email}</p>
        </div>
      ),
    },
    {
      id: 'verified',
      header: 'Email',
      cell: ({ row }) =>
        row.original.emailVerified ? (
          <Badge variant="success">Terverifikasi</Badge>
        ) : (
          <Badge variant="warning">Belum terverifikasi</Badge>
        ),
    },
    {
      id: 'workspaces',
      header: 'Workspace',
      cell: ({ row }) => <span className="tabular-nums">{row.original.membershipCount}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'created',
      header: 'Bergabung',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDate(row.original.createdAt)}</span>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Tindakan</span>,
      cell: ({ row }) => {
        if (row.original.id === currentUserId) return null;
        const next = row.original.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        return (
          <Button
            variant={next === 'SUSPENDED' ? 'ghost' : 'outline'}
            size="sm"
            className={next === 'SUSPENDED' ? 'text-destructive hover:text-destructive' : undefined}
            disabled={setStatus.isPending}
            onClick={() =>
              setStatus.mutate(
                { userId: row.original.id, status: next },
                {
                  onSuccess: () =>
                    toast.success(
                      next === 'SUSPENDED'
                        ? `${row.original.name} ditangguhkan dan keluar dari semua sesi`
                        : `${row.original.name} diaktifkan kembali`,
                    ),
                  onError: (error) => toast.error(errorMessage(error)),
                },
              )
            }
          >
            {next === 'SUSPENDED' ? 'Tangguhkan' : 'Aktifkan kembali'}
          </Button>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Pengguna"
        description="Setiap akun di platform. Menangguhkan pengguna akan mengeluarkannya dari semua sesi."
      />
      <SearchBox
        value={search}
        onChange={(v) => {
          setSearch(v);
          setParams((p) => ({ ...p, page: 1 }));
        }}
        label="Cari pengguna berdasarkan nama atau email"
      />
      <DataTable
        columns={columns}
        data={query.data?.data}
        meta={query.data?.meta}
        isLoading={query.isPending}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        onPageChange={(page) => setParams((p) => ({ ...p, page }))}
        getRowId={(u) => u.id}
        emptyTitle="Pengguna tidak ditemukan"
      />
    </>
  );
}

export function AdminAuditLogsPage() {
  return (
    <>
      <PageHeader
        title="Log audit platform"
        description="Peristiwa di semua tenant, termasuk tindakan administrasi platform."
      />
      <AuditLogTable useData={usePlatformAuditLogs} showTenant includePlatformFilter />
    </>
  );
}
