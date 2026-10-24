'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { MemberDto } from '@saas/contracts';
import { PageHeader } from '@/components/layout/page-header';
import { AccessDenied, EmptyState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/misc';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { errorMessage } from '@/lib/api/errors';
import {
  useAttendanceSites,
  useBulkPutWorkSchedule,
  useMembers,
  useWorkSchedule,
} from '@/lib/api/hooks';
import { WEEKDAY_LABELS, labelToMinutes, minutesToLabel } from '@/lib/geolocation';
import { useTenant } from '../tenant-context';

interface DayDraft {
  enabled: boolean;
  start: string;
  end: string;
  siteId: string;
}

const defaultDay = (): DayDraft => ({
  enabled: false,
  start: '09:00',
  end: '18:00',
  siteId: '',
});

function daysFromSchedule(
  days: { weekday: number; startMinutes: number; endMinutes: number; siteId: string | null }[],
): DayDraft[] {
  const next = Array.from({ length: 7 }, () => defaultDay());
  for (const day of days) {
    next[day.weekday] = {
      enabled: true,
      start: minutesToLabel(day.startMinutes),
      end: minutesToLabel(day.endMinutes),
      siteId: day.siteId ?? '',
    };
  }
  return next;
}

function buildDayPayload(days: DayDraft[]) {
  const payload: {
    weekday: number;
    startMinutes: number;
    endMinutes: number;
    siteId: string | null;
  }[] = [];
  for (let weekday = 0; weekday < days.length; weekday++) {
    const day = days[weekday];
    if (!day?.enabled) continue;
    const startMinutes = labelToMinutes(day.start);
    const endMinutes = labelToMinutes(day.end);
    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      toast.error(`Waktu tidak valid untuk ${WEEKDAY_LABELS[weekday]}`);
      return null;
    }
    payload.push({
      weekday,
      startMinutes,
      endMinutes,
      siteId: day.siteId || null,
    });
  }
  return payload;
}

export function AttendanceSchedulesPage() {
  const { tenant, can, membershipId } = useTenant();
  const membersQuery = useMembers(tenant.id, {
    page: 1,
    limit: 100,
    status: 'ACTIVE',
    sortBy: 'name',
    sortOrder: 'asc',
  });
  const sites = useAttendanceSites(tenant.id);
  const saveBulk = useBulkPutWorkSchedule(tenant.id);

  /**
   * Org-wide (admin/owner): all active members.
   * Manager/lead: only self + direct reports (`managerId` reporting line).
   */
  const canManageOrgWide = can('members.update');
  const members = useMemo(() => {
    const active = (membersQuery.data?.data ?? []).filter((m) => m.status === 'ACTIVE');
    if (canManageOrgWide) return active;
    return active.filter((m) => m.id === membershipId || m.managerId === membershipId);
  }, [membersQuery.data?.data, canManageOrgWide, membershipId]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<DayDraft[] | null>(null);

  // Load schedule from the first selected member as a template preview (optional).
  const previewMemberId = [...selectedIds][0] ?? '';
  const previewSchedule = useWorkSchedule(tenant.id, previewMemberId);

  const days = useMemo(() => {
    if (draft) return draft;
    if (previewSchedule.data) return daysFromSchedule(previewSchedule.data.days);
    return Array.from({ length: 7 }, () => defaultDay());
  }, [draft, previewSchedule.data]);

  const setDays = (updater: (prev: DayDraft[]) => DayDraft[]) => {
    setDraft(updater(days));
  };

  const toggleMember = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
    setDraft(null);
  };

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(members.map((m) => m.id)) : new Set());
    setDraft(null);
  };

  if (!can('attendance.schedules.manage')) return <AccessDenied />;

  const onSave = () => {
    if (selectedIds.size === 0) {
      toast.error('Pilih minimal satu anggota');
      return;
    }
    const payload = buildDayPayload(days);
    if (payload === null) return;

    saveBulk.mutate(
      { membershipIds: [...selectedIds], days: payload },
      {
        onSuccess: (result) => {
          setDraft(null);
          toast.success(
            `Jadwal diterapkan ke ${result.updatedMembershipIds.length} anggota`,
          );
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  return (
    <>
      <PageHeader
        title="Jadwal"
        description="Buat satu templat mingguan dan terapkan ke satu atau banyak anggota aktif."
      />

      {membersQuery.isPending && (
        <p className="py-10 text-center text-sm text-muted-foreground">Memuat anggota…</p>
      )}

      {!membersQuery.isPending && members.length === 0 && (
        <EmptyState
          title={canManageOrgWide ? 'Tidak ada anggota aktif' : 'Tidak ada anggota tim'}
          description={
            canManageOrgWide
              ? 'Undang atau aktifkan kembali anggota sebelum menetapkan jadwal kerja.'
              : 'Hanya orang yang melapor kepada Anda yang muncul di sini. Minta admin menetapkan Anda sebagai atasan mereka di halaman Anggota.'
          }
        />
      )}

      {members.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(240px,320px)_1fr]">
          <section className="rounded-lg border">
            <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={selectedIds.size > 0 && selectedIds.size === members.length}
                  onCheckedChange={(checked) => toggleAll(checked === true)}
                  aria-label="Pilih semua anggota"
                />
                {canManageOrgWide ? 'Anggota' : 'Tim Anda'} ({selectedIds.size}/{members.length})
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedIds(new Set());
                  setDraft(null);
                }}
              >
                Hapus pilihan
              </Button>
            </div>
            <ul className="max-h-[28rem] divide-y overflow-y-auto">
              {members.map((m: MemberDto) => (
                <li key={m.id}>
                  <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-accent/40">
                    <Checkbox
                      className="mt-0.5"
                      checked={selectedIds.has(m.id)}
                      onCheckedChange={(checked) => toggleMember(m.id, checked === true)}
                      aria-label={`Pilih ${m.user.name}`}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{m.user.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {m.user.email}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          <section className="min-w-0">
            <p className="mb-3 text-sm text-muted-foreground">
              {selectedIds.size === 0
                ? 'Pilih satu atau lebih anggota, ubah jam mingguan, lalu terapkan.'
                : selectedIds.size === 1
                  ? 'Mengedit templat untuk 1 anggota terpilih (memuat jadwal saat ini jika tersedia).'
                  : `Templat yang sama akan diterapkan ke ${selectedIds.size} anggota terpilih.`}
            </p>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Hari</th>
                    <th className="px-3 py-2 font-medium">Kerja</th>
                    <th className="px-3 py-2 font-medium">Mulai</th>
                    <th className="px-3 py-2 font-medium">Selesai</th>
                    <th className="px-3 py-2 font-medium">Lokasi default</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((day, weekday) => (
                    <tr key={weekday} className="border-t">
                      <td className="px-3 py-2 font-medium">{WEEKDAY_LABELS[weekday]}</td>
                      <td className="px-3 py-2">
                        <Checkbox
                          checked={day.enabled}
                          onCheckedChange={(checked) =>
                            setDays((prev) =>
                              prev.map((d, i) =>
                                i === weekday ? { ...d, enabled: checked === true } : d,
                              ),
                            )
                          }
                          aria-label={`Kerja pada ${WEEKDAY_LABELS[weekday]}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="time"
                          value={day.start}
                          disabled={!day.enabled}
                          onChange={(e) =>
                            setDays((prev) =>
                              prev.map((d, i) =>
                                i === weekday ? { ...d, start: e.target.value } : d,
                              ),
                            )
                          }
                          className="w-32"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="time"
                          value={day.end}
                          disabled={!day.enabled}
                          onChange={(e) =>
                            setDays((prev) =>
                              prev.map((d, i) =>
                                i === weekday ? { ...d, end: e.target.value } : d,
                              ),
                            )
                          }
                          className="w-32"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={day.siteId || 'none'}
                          disabled={!day.enabled}
                          onValueChange={(v) =>
                            setDays((prev) =>
                              prev.map((d, i) =>
                                i === weekday ? { ...d, siteId: v === 'none' ? '' : v } : d,
                              ),
                            )
                          }
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Semua lokasi</SelectItem>
                            {sites.data?.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <Button
                onClick={onSave}
                disabled={saveBulk.isPending || selectedIds.size === 0 || membersQuery.isPending}
              >
                {saveBulk.isPending
                  ? 'Menyimpan…'
                  : selectedIds.size <= 1
                    ? 'Simpan jadwal'
                    : `Terapkan ke ${selectedIds.size} anggota`}
              </Button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
