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
        title="Roles"
        description="Roles bundle permissions. Members can hold several roles; their permissions add up."
        actions={
          can('roles.create') && (
            <Button onClick={() => setEditing('new')}>
              <PlusIcon /> New role
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
                        {role.isSystem && <Badge variant="secondary">System</Badge>}
                      </CardTitle>
                      <CardDescription>{role.description ?? 'Custom role'}</CardDescription>
                      <CardAction className="flex gap-1">
                        {isOwner ? (
                          <LockIcon
                            className="size-4 text-muted-foreground"
                            aria-label="The owner role cannot be modified"
                          />
                        ) : (
                          <>
                            {can('roles.update') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditing(role)}
                                aria-label={`Edit ${role.name}`}
                              >
                                <PencilIcon />
                              </Button>
                            )}
                            {can('roles.delete') && !role.isSystem && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleting(role)}
                                aria-label={`Delete ${role.name}`}
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
                        {role.memberCount === 1 ? 'member' : 'members'}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.length === 0 && (
                          <span className="text-xs text-muted-foreground">No permissions</span>
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
        title="Delete role?"
        description={
          deleting
            ? `The "${deleting.name}" role will be deleted. Roles that are assigned to members or pending invitations cannot be deleted.`
            : ''
        }
        confirmLabel="Delete role"
        destructive
        pending={deleteRole.isPending}
        onConfirm={() => {
          if (!deleting) return;
          deleteRole.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('Role deleted');
              setDeleting(null);
            },
            onError: (error) => toast.error(errorMessage(error)),
          });
        }}
      />
    </>
  );
}
