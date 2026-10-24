'use client';

import {
  MoreHorizontalIcon,
  SearchIcon,
  ShieldIcon,
  UploadIcon,
  UserMinusIcon,
  UserCheckIcon,
  UserXIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import type { MemberDto, RoleDto } from '@saas/contracts';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable, type AppColumnDef } from '@/components/data-table/data-table';
import { useDebounced } from '@/components/data-table/use-debounced';
import { PageHeader } from '@/components/layout/page-header';
import { AccessDenied } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, Checkbox } from '@/components/ui/misc';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { errorMessage } from '@/lib/api/errors';
import {
  useMembers,
  useRemoveMember,
  useRoles,
  useUpdateMemberManager,
  useUpdateMemberRoles,
  useUpdateMemberStatus,
  type MemberListParams,
} from '@/lib/api/hooks';
import { formatDate, initials } from '@/lib/utils';
import { useTenant } from './tenant-context';

const ALL = 'all';

const SORTS = {
  'joinedAt:desc': { sortBy: 'joinedAt', sortOrder: 'desc' },
  'joinedAt:asc': { sortBy: 'joinedAt', sortOrder: 'asc' },
  'name:asc': { sortBy: 'name', sortOrder: 'asc' },
  'email:asc': { sortBy: 'email', sortOrder: 'asc' },
} as const satisfies Record<string, Pick<MemberListParams, 'sortBy' | 'sortOrder'>>;

function parseStatus(value: string): MemberListParams['status'] {
  return value === 'ACTIVE' || value === 'SUSPENDED' ? value : undefined;
}

function parseSort(value: string): Pick<MemberListParams, 'sortBy' | 'sortOrder'> {
  return Object.entries(SORTS).find(([key]) => key === value)?.[1] ?? SORTS['joinedAt:desc'];
}

function EditManagerDialog({
  member,
  candidates,
  onClose,
}: {
  member: MemberDto;
  candidates: MemberDto[];
  onClose: () => void;
}) {
  const { tenant } = useTenant();
  const updateManager = useUpdateMemberManager(tenant.id);
  const [managerId, setManagerId] = useState<string>(member.managerId ?? 'none');

  const save = () => {
    updateManager.mutate(
      { memberId: member.id, managerId: managerId === 'none' ? null : managerId },
      {
        onSuccess: () => {
          toast.success(`Atasan diperbarui untuk ${member.user.name}`);
          onClose();
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Melapor kepada</DialogTitle>
          <DialogDescription>
            Pilih atasan langsung untuk {member.user.name}. Atasan menyetujui kehadiran anggota
            ini.
          </DialogDescription>
        </DialogHeader>
        <Select value={managerId} onValueChange={setManagerId}>
          <SelectTrigger aria-label="Atasan">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Tidak ada atasan</SelectItem>
            {candidates
              .filter((c) => c.id !== member.id && c.status === 'ACTIVE')
              .map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.user.name} ({c.user.email})
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={save} disabled={updateManager.isPending}>
            {updateManager.isPending ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditRolesDialog({
  member,
  roles,
  onClose,
}: {
  member: MemberDto;
  roles: RoleDto[];
  onClose: () => void;
}) {
  const { tenant } = useTenant();
  const updateRoles = useUpdateMemberRoles(tenant.id);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(member.roles.map((r) => r.id)),
  );

  const toggle = (roleId: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(roleId);
      else next.delete(roleId);
      return next;
    });
  };

  const save = () => {
    updateRoles.mutate(
      { memberId: member.id, roleIds: [...selected] },
      {
        onSuccess: () => {
          toast.success(`Peran diperbarui untuk ${member.user.name}`);
          onClose();
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ubah peran</DialogTitle>
          <DialogDescription>
            Pilih peran untuk {member.user.name}. Anda hanya dapat menetapkan peran yang izinnya
            Anda miliki.
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-80 gap-2 overflow-y-auto">
          {roles.map((role) => (
            <label
              key={role.id}
              className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-accent/40"
            >
              <Checkbox
                checked={selected.has(role.id)}
                onCheckedChange={(checked) => toggle(role.id, checked === true)}
                className="mt-0.5"
              />
              <span className="grid gap-0.5">
                <span className="text-sm font-medium">{role.name}</span>
                <span className="text-xs text-muted-foreground">
                  {role.description ?? `${role.permissions.length} izin`}
                </span>
              </span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={save} disabled={selected.size === 0 || updateRoles.isPending}>
            {updateRoles.isPending ? 'Menyimpan…' : 'Simpan peran'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MembersPage() {
  const { tenant, can, membershipId } = useTenant();
  const [params, setParams] = useState<MemberListParams>({
    page: 1,
    limit: 20,
    sortBy: 'joinedAt',
    sortOrder: 'desc',
  });
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search.trim());
  const query = useMembers(tenant.id, { ...params, search: debouncedSearch || undefined });
  const roles = useRoles(tenant.id);
  const updateStatus = useUpdateMemberStatus(tenant.id);
  const removeMember = useRemoveMember(tenant.id);
  const [editing, setEditing] = useState<MemberDto | null>(null);
  const [editingManager, setEditingManager] = useState<MemberDto | null>(null);
  const [removing, setRemoving] = useState<MemberDto | null>(null);

  const canManage = can('members.update');
  const canRemove = can('members.remove');
  /** Managers without members.update only see their team (enforced by the API too). */
  const teamOnly = !canManage;

  const setStatus = (member: MemberDto, status: 'ACTIVE' | 'SUSPENDED') => {
    updateStatus.mutate(
      { memberId: member.id, status },
      {
        onSuccess: () =>
          toast.success(
            status === 'SUSPENDED'
              ? `${member.user.name} ditangguhkan`
              : `${member.user.name} diaktifkan kembali`,
          ),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  const columns: AppColumnDef<MemberDto>[] = [
    {
      id: 'member',
      header: 'Anggota',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>{initials(row.original.user.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium">
              {row.original.user.name}
              {row.original.id === membershipId && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">(Anda)</span>
              )}
            </p>
            <p className="truncate text-xs text-muted-foreground">{row.original.user.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'roles',
      header: 'Peran',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.roles.map((role) => (
            <Badge key={role.id} variant={role.key === 'owner' ? 'default' : 'secondary'}>
              {role.name}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      id: 'manager',
      header: 'Melapor kepada',
      cell: ({ row }) =>
        row.original.manager ? (
          <span className="text-sm">{row.original.manager.user.name}</span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) =>
        row.original.status === 'ACTIVE' ? (
          <Badge variant="success">Aktif</Badge>
        ) : (
          <Badge variant="destructive">Ditangguhkan</Badge>
        ),
    },
    {
      id: 'joined',
      header: 'Bergabung',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDate(row.original.joinedAt)}</span>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Tindakan</span>,
      cell: ({ row }) => {
        const member = row.original;
        if (member.id === membershipId || (!canManage && !canRemove)) return null;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Tindakan untuk ${member.user.name}`}>
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canManage && (
                <>
                  <DropdownMenuItem onSelect={() => setEditing(member)}>
                    <ShieldIcon /> Ubah peran
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setEditingManager(member)}>
                    <UserCheckIcon /> Atur atasan
                  </DropdownMenuItem>
                  {member.status === 'ACTIVE' ? (
                    <DropdownMenuItem onSelect={() => setStatus(member, 'SUSPENDED')}>
                      <UserXIcon /> Tangguhkan
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onSelect={() => setStatus(member, 'ACTIVE')}>
                      <UserCheckIcon /> Aktifkan kembali
                    </DropdownMenuItem>
                  )}
                </>
              )}
              {canRemove && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setRemoving(member)}>
                    <UserMinusIcon /> Keluarkan dari workspace
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  if (!can('members.read')) return <AccessDenied />;

  return (
    <>
      <PageHeader
        title={teamOnly ? 'Tim Anda' : 'Anggota'}
        description={
          teamOnly
            ? 'Anda dan orang yang melapor kepada Anda.'
            : 'Orang yang memiliki akses ke workspace ini beserta perannya.'
        }
        actions={
          can('members.invite') ? (
            <Button asChild variant="outline">
              <Link href={`/t/${tenant.slug}/invitations?import=1`}>
                <UploadIcon /> Impor CSV
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setParams((p) => ({ ...p, page: 1 }));
            }}
            placeholder="Cari berdasarkan nama atau email"
            className="pl-9"
            aria-label="Cari anggota"
            maxLength={100}
          />
        </div>
        <Select
          value={params.status ?? ALL}
          onValueChange={(v) => setParams((p) => ({ ...p, page: 1, status: parseStatus(v) }))}
        >
          <SelectTrigger className="sm:w-40" aria-label="Filter menurut status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Semua status</SelectItem>
            <SelectItem value="ACTIVE">Aktif</SelectItem>
            <SelectItem value="SUSPENDED">Ditangguhkan</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={params.roleId ?? ALL}
          onValueChange={(v) =>
            setParams((p) => ({ ...p, page: 1, roleId: v === ALL ? undefined : v }))
          }
        >
          <SelectTrigger className="sm:w-44" aria-label="Filter menurut peran">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Semua peran</SelectItem>
            {roles.data?.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={`${params.sortBy}:${params.sortOrder}`}
          onValueChange={(v) => setParams((p) => ({ ...p, page: 1, ...parseSort(v) }))}
        >
          <SelectTrigger className="sm:w-44" aria-label="Urutkan anggota">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="joinedAt:desc">Terbaru dulu</SelectItem>
            <SelectItem value="joinedAt:asc">Terlama dulu</SelectItem>
            <SelectItem value="name:asc">Nama A–Z</SelectItem>
            <SelectItem value="email:asc">Email A–Z</SelectItem>
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
        getRowId={(m) => m.id}
        emptyTitle="Tidak ada anggota ditemukan"
        emptyDescription={debouncedSearch ? 'Coba pencarian atau filter lain.' : undefined}
      />
      {editing && roles.data && (
        <EditRolesDialog member={editing} roles={roles.data} onClose={() => setEditing(null)} />
      )}
      {editingManager && query.data && (
        <EditManagerDialog
          member={editingManager}
          candidates={query.data.data}
          onClose={() => setEditingManager(null)}
        />
      )}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Keluarkan anggota?"
        description={
          removing
            ? `${removing.user.name} akan segera kehilangan akses ke ${tenant.name}.`
            : ''
        }
        confirmLabel="Keluarkan"
        destructive
        pending={removeMember.isPending}
        onConfirm={() => {
          if (!removing) return;
          removeMember.mutate(removing.id, {
            onSuccess: () => {
              toast.success(`${removing.user.name} dikeluarkan`);
              setRemoving(null);
            },
            onError: (error) => toast.error(errorMessage(error)),
          });
        }}
      />
    </>
  );
}
