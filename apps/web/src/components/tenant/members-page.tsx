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
          toast.success(`Roles updated for ${member.user.name}`);
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
          <DialogTitle>Change roles</DialogTitle>
          <DialogDescription>
            Choose the roles for {member.user.name}. You can only assign roles whose permissions you
            hold yourself.
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
                  {role.description ?? `${role.permissions.length} permissions`}
                </span>
              </span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={selected.size === 0 || updateRoles.isPending}>
            {updateRoles.isPending ? 'Saving…' : 'Save roles'}
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
  const [removing, setRemoving] = useState<MemberDto | null>(null);

  const canManage = can('members.update');
  const canRemove = can('members.remove');

  const setStatus = (member: MemberDto, status: 'ACTIVE' | 'SUSPENDED') => {
    updateStatus.mutate(
      { memberId: member.id, status },
      {
        onSuccess: () =>
          toast.success(
            status === 'SUSPENDED'
              ? `${member.user.name} was suspended`
              : `${member.user.name} was reactivated`,
          ),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  const columns: AppColumnDef<MemberDto>[] = [
    {
      id: 'member',
      header: 'Member',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>{initials(row.original.user.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium">
              {row.original.user.name}
              {row.original.id === membershipId && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>
              )}
            </p>
            <p className="truncate text-xs text-muted-foreground">{row.original.user.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'roles',
      header: 'Roles',
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
      id: 'status',
      header: 'Status',
      cell: ({ row }) =>
        row.original.status === 'ACTIVE' ? (
          <Badge variant="success">Active</Badge>
        ) : (
          <Badge variant="destructive">Suspended</Badge>
        ),
    },
    {
      id: 'joined',
      header: 'Joined',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDate(row.original.joinedAt)}</span>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const member = row.original;
        if (member.id === membershipId || (!canManage && !canRemove)) return null;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Actions for ${member.user.name}`}>
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canManage && (
                <>
                  <DropdownMenuItem onSelect={() => setEditing(member)}>
                    <ShieldIcon /> Change roles
                  </DropdownMenuItem>
                  {member.status === 'ACTIVE' ? (
                    <DropdownMenuItem onSelect={() => setStatus(member, 'SUSPENDED')}>
                      <UserXIcon /> Suspend
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onSelect={() => setStatus(member, 'ACTIVE')}>
                      <UserCheckIcon /> Reactivate
                    </DropdownMenuItem>
                  )}
                </>
              )}
              {canRemove && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setRemoving(member)}>
                    <UserMinusIcon /> Remove from workspace
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
        title="Members"
        description="People with access to this workspace and their roles."
        actions={
          can('members.invite') ? (
            <Button asChild variant="outline">
              <Link href={`/t/${tenant.slug}/invitations?import=1`}>
                <UploadIcon /> Import CSV
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
            placeholder="Search by name or email"
            className="pl-9"
            aria-label="Search members"
            maxLength={100}
          />
        </div>
        <Select
          value={params.status ?? ALL}
          onValueChange={(v) => setParams((p) => ({ ...p, page: 1, status: parseStatus(v) }))}
        >
          <SelectTrigger className="sm:w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={params.roleId ?? ALL}
          onValueChange={(v) =>
            setParams((p) => ({ ...p, page: 1, roleId: v === ALL ? undefined : v }))
          }
        >
          <SelectTrigger className="sm:w-44" aria-label="Filter by role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All roles</SelectItem>
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
          <SelectTrigger className="sm:w-44" aria-label="Sort members">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="joinedAt:desc">Newest first</SelectItem>
            <SelectItem value="joinedAt:asc">Oldest first</SelectItem>
            <SelectItem value="name:asc">Name A–Z</SelectItem>
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
        emptyTitle="No members found"
        emptyDescription={debouncedSearch ? 'Try a different search or filter.' : undefined}
      />
      {editing && roles.data && (
        <EditRolesDialog member={editing} roles={roles.data} onClose={() => setEditing(null)} />
      )}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove member?"
        description={
          removing ? `${removing.user.name} will immediately lose access to ${tenant.name}.` : ''
        }
        confirmLabel="Remove"
        destructive
        pending={removeMember.isPending}
        onConfirm={() => {
          if (!removing) return;
          removeMember.mutate(removing.id, {
            onSuccess: () => {
              toast.success(`${removing.user.name} was removed`);
              setRemoving(null);
            },
            onError: (error) => toast.error(errorMessage(error)),
          });
        }}
      />
    </>
  );
}
