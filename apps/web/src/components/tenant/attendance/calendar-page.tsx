'use client';

import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { AccessDenied, ErrorState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAttendanceCalendar } from '@/lib/api/hooks';
import { cn } from '@/lib/utils';
import { useTenant } from '../tenant-context';

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

const WEEKDAY_HEADERS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'] as const;

export function AttendanceCalendarPage() {
  const { tenant, can } = useTenant();
  const [cursor, setCursor] = useState(() => new Date());
  const [scope, setScope] = useState<'self' | 'team' | 'all'>('self');
  const month = monthKey(cursor);
  const calendar = useAttendanceCalendar(tenant.id, {
    month,
    scope: can('attendance.team.read') || can('attendance.approve') ? scope : 'self',
  });

  const calendarDays = calendar.data;
  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const monthIndex = cursor.getMonth();
    const firstWeekday = new Date(year, monthIndex, 1).getDay();
    const total = daysInMonth(year, monthIndex);
    const byDate = new Map((calendarDays ?? []).map((d) => [d.date, d.records] as const));
    const out: {
      key: string;
      label: number | null;
      records: NonNullable<typeof calendarDays>[number]['records'];
    }[] = [];
    for (let i = 0; i < firstWeekday; i++) out.push({ key: `pad-${i}`, label: null, records: [] });
    for (let day = 1; day <= total; day++) {
      const date = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      out.push({ key: date, label: day, records: byDate.get(date) ?? [] });
    }
    return out;
  }, [calendarDays, cursor]);

  if (!can('attendance.read')) return <AccessDenied />;

  const shift = (delta: number) => {
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  };

  return (
    <>
      <PageHeader
        title="Kalender absensi"
        description="Tampilan bulanan catatan absensi. Warna menunjukkan status persetujuan."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {(can('attendance.team.read') || can('attendance.approve')) && (
              <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
                <SelectTrigger className="w-36" aria-label="Cakupan kalender">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">Saya</SelectItem>
                  <SelectItem value="team">Tim</SelectItem>
                  {can('members.update') && <SelectItem value="all">Semua</SelectItem>}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" onClick={() => shift(-1)}>
              Sebelumnya
            </Button>
            <span className="min-w-28 text-center text-sm font-medium">{month}</span>
            <Button variant="outline" size="sm" onClick={() => shift(1)}>
              Berikutnya
            </Button>
          </div>
        }
      />
      {calendar.isError && <ErrorState onRetry={() => void calendar.refetch()} />}
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border">
        {WEEKDAY_HEADERS.map((d) => (
          <div key={d} className="bg-muted/50 px-2 py-2 text-center text-xs font-medium">
            {d}
          </div>
        ))}
        {cells.map((cell) => (
          <div
            key={cell.key}
            className={cn(
              'min-h-24 bg-background p-2',
              cell.label === null && 'bg-muted/20',
            )}
          >
            {cell.label !== null && (
              <>
                <p className="mb-1 text-xs font-medium text-muted-foreground">{cell.label}</p>
                <div className="flex flex-col gap-1">
                  {cell.records.slice(0, 3).map((r) => (
                    <Badge
                      key={r.id}
                      variant={
                        r.status === 'APPROVED'
                          ? 'success'
                          : r.status === 'REJECTED'
                            ? 'destructive'
                            : 'secondary'
                      }
                      className="truncate text-[10px]"
                      title={`${r.member.user.name} · ${r.site.name}`}
                    >
                      {r.member.user.name.split(' ')[0]}
                    </Badge>
                  ))}
                  {cell.records.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{cell.records.length - 3} lainnya
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
