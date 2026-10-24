'use client';

import { LockIcon, PencilIcon, PlusIcon, Trash2Icon, UsersIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { RoleDto } from '@saas/contracts';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PageHeader } from '@/components/layout/page-header';
import { AccessDenied, ErrorState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';
import { errorMessage } from '@/lib/api/errors';
import { useDeleteRole, useRoles } from '@/lib/api/hooks';
import { RoleEditor } from './role-editor';
import { useTenant } from './tenant-context';

export function RolesPage() {
  const { tenant, can } = useTenant();
  const roles = useRoles(tenant.id);
  const deleteRole = useDeleteRole(tenant.id);
  const [editing, setEditing] = useState<RoleDto | 'new' | null>(null);
  const [deleting, setDeleting] = useState<RoleDto | null>(null);

  if (!can('roles.read')) return <AccessDenied />;

  return (
    <>
      <PageHeader
        title="Peran"
        description="Peran menggabungkan izin. Anggota dapat memiliki beberapa peran; izin mereka digabungkan."
        actions={
          can('roles.create') && (
            <Button onClick={() => setEditing('new')}>
              <PlusIcon /> Peran baru
            </Button>
          )
        }
      />
      {roles.isError ? (
        <ErrorState onRetry={() => void roles.refetch()} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roles.isPending
            ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-40" />)
            : roles.data.map((role) => {
                const isOwner = role.key === 'owner';
                return (
                  <Card key={role.id} className="gap-4">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {role.name}
                        {role.isSystem && <Badge variant="secondary">Sistem</Badge>}
                      </CardTitle>
                      <CardDescription>{role.description ?? 'Peran kustom'}</CardDescription>
                      <CardAction className="flex gap-1">
                        {isOwner ? (
                          <LockIcon
                            className="size-4 text-muted-foreground"
                            aria-label="Peran pemilik tidak dapat diubah"
                          />
                        ) : (
                          <>
                            {can('roles.update') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditing(role)}
                                aria-label={`Ubah ${role.name}`}
                              >
                                <PencilIcon />
                              </Button>
                            )}
                            {can('roles.delete') && !role.isSystem && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleting(role)}
                                aria-label={`Hapus ${role.name}`}
                              >
                                <Trash2Icon />
                              </Button>
                            )}
                          </>
                        )}
                      </CardAction>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <UsersIcon className="size-4" /> {role.memberCount}{' '}
                        {role.memberCount === 1 ? 'anggota' : 'anggota'}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.length === 0 && (
                          <span className="text-xs text-muted-foreground">Tidak ada izin</span>
                        )}
                        {role.permissions.map((p) => (
                          <code key={p} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                            {p}
                          </code>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
        </div>
      )}
      {editing && (
        <RoleEditor role={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Hapus peran?"
        description={
          deleting
            ? `Peran "${deleting.name}" akan dihapus. Peran yang ditetapkan ke anggota atau undangan yang masih menunggu tidak dapat dihapus.`
            : ''
        }
        confirmLabel="Hapus peran"
        destructive
        pending={deleteRole.isPending}
        onConfirm={() => {
          if (!deleting) return;
          deleteRole.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('Peran dihapus');
              setDeleting(null);
            },
            onError: (error) => toast.error(errorMessage(error)),
          });
        }}
      />
    </>
  );
}
