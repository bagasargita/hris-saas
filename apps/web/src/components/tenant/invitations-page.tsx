'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { DownloadIcon, MailPlusIcon, RefreshCwIcon, UploadIcon, XCircleIcon } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import type {
  InvitationDto,
  InvitationImportResultDto,
  InvitationStatus,
} from '@saas/contracts';
import { FormAlert } from '@/components/auth/auth-card';
import { DataTable, type AppColumnDef } from '@/components/data-table/data-table';
import { FormField } from '@/components/form-field';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { errorMessage } from '@/lib/api/errors';
import {
  downloadInvitationImportTemplate,
  useCreateInvitation,
  useImportInvitations,
  useInvitationAction,
  useInvitations,
  useRoles,
  type InvitationListParams,
} from '@/lib/api/hooks';
import { formatDate } from '@/lib/utils';
import { inviteSchema } from '@/lib/validation';
import { useTenant } from './tenant-context';

const STATUS_BADGE: Record<
  InvitationStatus,
  { label: string; variant: 'success' | 'secondary' | 'destructive' | 'warning' }
> = {
  PENDING: { label: 'Pending', variant: 'warning' },
  ACCEPTED: { label: 'Accepted', variant: 'success' },
  REVOKED: { label: 'Revoked', variant: 'destructive' },
  EXPIRED: { label: 'Expired', variant: 'secondary' },
};

const STATUS_FILTERS = ['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED'] as const;

function parseStatus(value: string): InvitationListParams['status'] {
  return STATUS_FILTERS.find((s) => s === value);
}

function InviteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { tenant } = useTenant();
  const roles = useRoles(tenant.id);
  const create = useCreateInvitation(tenant.id);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', roleId: '' },
  });
  const { errors } = form.formState;
  const assignable = roles.data?.filter((r) => r.key !== 'owner') ?? [];

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await create.mutateAsync(values);
      toast.success(`Invitation sent to ${values.email}`);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      setFormError(errorMessage(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite someone</DialogTitle>
          <DialogDescription>
            They will receive an email with a link that expires in 7 days.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void onSubmit(event)} noValidate className="grid gap-4">
          {formError && <FormAlert>{formError}</FormAlert>}
          <FormField id="invite-email" label="Email address" error={errors.email?.message}>
            <Input
              id="invite-email"
              type="email"
              autoComplete="off"
              placeholder="colleague@company.com"
              aria-invalid={!!errors.email}
              {...form.register('email')}
            />
          </FormField>
          <FormField
            id="invite-role"
            label="Role"
            error={errors.roleId?.message}
            hint="You can only invite with roles whose permissions you hold."
          >
            <Controller
              control={form.control}
              name="roleId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="invite-role" aria-invalid={!!errors.roleId}>
                    <SelectValue placeholder="Choose a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignable.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Sending…' : 'Send invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { tenant } = useTenant();
  const importInvites = useImportInvitations(tenant.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<InvitationImportResultDto | null>(null);
  const [downloading, setDownloading] = useState(false);

  const reset = () => {
    setFile(null);
    setFormError(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const onDownloadTemplate = async () => {
    setDownloading(true);
    try {
      await downloadInvitationImportTemplate(tenant.id);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDownloading(false);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!file) {
      setFormError('Choose a CSV file first.');
      return;
    }
    try {
      const outcome = await importInvites.mutateAsync(file);
      setResult(outcome);
      if (outcome.invited > 0) {
        toast.success(
          `Sent ${String(outcome.invited)} invitation${outcome.invited === 1 ? '' : 's'}`,
        );
      } else if (outcome.failed > 0) {
        toast.error('No invitations were sent. Check the row errors below.');
      } else {
        toast.message('Nothing to import');
      }
    } catch (error) {
      setFormError(errorMessage(error));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import members from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV with <code className="text-xs">email</code> and{' '}
            <code className="text-xs">role</code> columns. Role must be a role key such as{' '}
            <code className="text-xs">member</code>, <code className="text-xs">manager</code>,{' '}
            <code className="text-xs">admin</code>, or <code className="text-xs">viewer</code> (not
            owner). Each row sends an invitation email.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void onSubmit(event)} className="grid gap-4">
          {formError && <FormAlert>{formError}</FormAlert>}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={downloading}
              onClick={() => void onDownloadTemplate()}
            >
              <DownloadIcon /> {downloading ? 'Downloading…' : 'Download template'}
            </Button>
          </div>
          <FormField id="invite-csv" label="CSV file" hint="Max 100 rows, 100 KB.">
            <Input
              id="invite-csv"
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                setResult(null);
                setFile(e.target.files?.[0] ?? null);
              }}
            />
          </FormField>
          {file && (
            <p className="text-sm text-muted-foreground">
              Selected: {file.name} ({Math.ceil(file.size / 1024)} KB)
            </p>
          )}
          {result && (
            <div className="max-h-56 overflow-auto rounded-md border text-sm">
              <div className="border-b bg-muted/40 px-3 py-2 font-medium">
                {result.invited} invited · {result.skipped} skipped · {result.failed} failed
              </div>
              <ul className="divide-y">
                {result.rows.map((row) => (
                  <li key={`${String(row.line)}-${row.email}`} className="px-3 py-2">
                    <span className="font-medium">Line {row.line}</span>
                    {row.email ? ` · ${row.email}` : ''}
                    {row.role ? ` · ${row.role}` : ''}
                    <span
                      className={
                        row.status === 'invited'
                          ? ' text-emerald-700 dark:text-emerald-400'
                          : row.status === 'failed'
                            ? ' text-destructive'
                            : ' text-muted-foreground'
                      }
                    >
                      {' '}
                      — {row.status}
                      {row.message ? `: ${row.message}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Close
            </Button>
            <Button type="submit" disabled={importInvites.isPending || !file}>
              {importInvites.isPending ? 'Importing…' : 'Upload and invite'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function InvitationsPage() {
  const { tenant, can } = useTenant();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [params, setParams] = useState<InvitationListParams>({
    page: 1,
    limit: 20,
    status: 'PENDING',
  });
  const query = useInvitations(tenant.id, params);
  const revoke = useInvitationAction(tenant.id, 'revoke');
  const resend = useInvitationAction(tenant.id, 'resend');
  const [inviteOpen, setInviteOpen] = useState(searchParams.get('new') === '1');
  const [importOpen, setImportOpen] = useState(searchParams.get('import') === '1');
  const canInvite = can('members.invite');

  const setDialog = (open: boolean) => {
    setInviteOpen(open);
    if (!open && searchParams.get('new')) router.replace(window.location.pathname);
  };

  const setImportDialog = (open: boolean) => {
    setImportOpen(open);
    if (!open && searchParams.get('import')) router.replace(window.location.pathname);
  };

  const columns: AppColumnDef<InvitationDto>[] = [
    {
      id: 'email',
      header: 'Email',
      cell: ({ row }) => <span className="font-medium">{row.original.email}</span>,
    },
    {
      id: 'role',
      header: 'Role',
      cell: ({ row }) => <Badge variant="secondary">{row.original.role.name}</Badge>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const badge = STATUS_BADGE[row.original.status];
        return <Badge variant={badge.variant}>{badge.label}</Badge>;
      },
    },
    {
      id: 'invitedBy',
      header: 'Invited by',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.invitedBy?.name ?? '—'}</span>
      ),
    },
    {
      id: 'expires',
      header: 'Expires',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDate(row.original.expiresAt)}</span>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) =>
        canInvite && row.original.status === 'PENDING' ? (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={resend.isPending}
              onClick={() =>
                resend.mutate(row.original.id, {
                  onSuccess: () => toast.success('Invitation resent with a new link'),
                  onError: (error) => toast.error(errorMessage(error)),
                })
              }
            >
              <RefreshCwIcon /> Resend
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={revoke.isPending}
              onClick={() =>
                revoke.mutate(row.original.id, {
                  onSuccess: () => toast.success('Invitation revoked'),
                  onError: (error) => toast.error(errorMessage(error)),
                })
              }
            >
              <XCircleIcon /> Revoke
            </Button>
          </div>
        ) : null,
    },
  ];

  if (!can('members.read')) return <AccessDenied />;

  return (
    <>
      <PageHeader
        title="Invitations"
        description="Pending and past invitations to this workspace. Import a CSV to invite many people at once."
        actions={
          canInvite && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setImportDialog(true)}>
                <UploadIcon /> Import CSV
              </Button>
              <Button onClick={() => setDialog(true)}>
                <MailPlusIcon /> Invite people
              </Button>
            </div>
          )
        }
      />
      <div className="mb-4">
        <Select
          value={params.status ?? 'all'}
          onValueChange={(v) => setParams((p) => ({ ...p, page: 1, status: parseStatus(v) }))}
        >
          <SelectTrigger className="w-44" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All invitations</SelectItem>
            {STATUS_FILTERS.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_BADGE[status].label}
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
        getRowId={(i) => i.id}
        emptyTitle="No invitations"
        emptyDescription={
          canInvite ? 'Invite teammates to collaborate in this workspace.' : undefined
        }
      />
      {canInvite && <InviteDialog open={inviteOpen} onOpenChange={setDialog} />}
      {canInvite && <ImportDialog open={importOpen} onOpenChange={setImportDialog} />}
    </>
  );
}
