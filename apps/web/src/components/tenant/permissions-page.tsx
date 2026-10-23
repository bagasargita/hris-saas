'use client';

import { CheckIcon, MinusIcon } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { AccessDenied, ErrorState } from '@/components/states';
import { Skeleton } from '@/components/ui/misc';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePermissionCatalog, useRoles } from '@/lib/api/hooks';
import { useTenant } from './tenant-context';

export function PermissionsPage() {
  const { tenant, can } = useTenant();
  const catalog = usePermissionCatalog(tenant.id);
  const roles = useRoles(tenant.id);

  if (!can('roles.read')) return <AccessDenied />;

  const header = (
    <PageHeader
      title="Permissions"
      description="Every permission in this workspace and which roles grant it."
    />
  );
  if (catalog.isError || roles.isError) {
    return (
      <>
        {header}
        <ErrorState onRetry={() => void Promise.all([catalog.refetch(), roles.refetch()])} />
      </>
    );
  }
  if (catalog.isPending || roles.isPending) {
    return (
      <>
        {header}
        <Skeleton className="h-96" />
      </>
    );
  }

  return (
    <>
      {header}
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead>Permission</TableHead>
              {roles.data.map((role) => (
                <TableHead key={role.id} className="text-center">
                  {role.name}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {catalog.data.map((permission) => (
              <TableRow key={permission.key}>
                <TableCell className="whitespace-normal">
                  <code className="text-xs font-medium">{permission.key}</code>
                  <p className="text-xs text-muted-foreground">{permission.description}</p>
                </TableCell>
                {roles.data.map((role) => (
                  <TableCell key={role.id} className="text-center">
                    {role.permissions.includes(permission.key) ? (
                      <CheckIcon className="mx-auto size-4 text-success" aria-label="Granted" />
                    ) : (
                      <MinusIcon
                        className="mx-auto size-4 text-muted-foreground/40"
                        aria-label="Not granted"
                      />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
