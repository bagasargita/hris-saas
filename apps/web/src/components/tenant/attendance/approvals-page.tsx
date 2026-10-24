'use client';

import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { AccessDenied, EmptyState, ErrorState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/api/errors';
import { useApproveAttendance, useAttendanceRecords } from '@/lib/api/hooks';
import { formatDateTime } from '@/lib/utils';
import { useTenant } from '../tenant-context';

export function AttendanceApprovalsPage() {
  const { tenant, can } = useTenant();
  const scope = can('members.update') ? 'all' : 'team';
  const records = useAttendanceRecords(tenant.id, {
    page: 1,
    limit: 50,
    status: 'PENDING',
    scope,
  });
  const approve = useApproveAttendance(tenant.id);

  if (!can('attendance.approve')) return <AccessDenied />;

  const decide = (recordId: string, decision: 'APPROVED' | 'REJECTED') => {
    approve.mutate(
      { recordId, decision },
      {
        onSuccess: () => toast.success(decision === 'APPROVED' ? 'Disetujui' : 'Ditolak'),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  return (
    <>
      <PageHeader
        title="Persetujuan"
        description={
          scope === 'all'
            ? 'Absensi menunggu persetujuan untuk seluruh workspace.'
            : 'Absensi menunggu persetujuan untuk bawahan langsung Anda.'
        }
      />
      {records.isPending && (
        <p className="py-10 text-center text-sm text-muted-foreground">Memuat…</p>
      )}
      {records.isError && <ErrorState onRetry={() => void records.refetch()} />}
      {records.data && records.data.data.length === 0 && (
        <EmptyState
          title="Tidak ada persetujuan tertunda"
          description="Semua sudah selesai."
        />
      )}
      {records.data && records.data.data.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {records.data.data.map((record) => (
            <li
              key={record.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {record.member.user.name}{' '}
                  <span className="text-muted-foreground">· {record.site.name}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(record.clockInAt)}
                  {record.clockOutAt ? ` → ${formatDateTime(record.clockOutAt)}` : ''}
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge variant="secondary">{record.workDate}</Badge>
                  {record.lateMinutes !== null && record.lateMinutes > 0 && (
                    <Badge variant="destructive">Terlambat {record.lateMinutes} mnt</Badge>
                  )}
                  {record.earlyLeaveMinutes !== null && record.earlyLeaveMinutes > 0 && (
                    <Badge variant="secondary">Pulang awal {record.earlyLeaveMinutes} mnt</Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={approve.isPending}
                  onClick={() => decide(record.id, 'REJECTED')}
                >
                  Tolak
                </Button>
                <Button disabled={approve.isPending} onClick={() => decide(record.id, 'APPROVED')}>
                  Setujui
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
