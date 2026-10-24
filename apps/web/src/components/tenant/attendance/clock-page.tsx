'use client';

import { ClockIcon, MapPinIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { AccessDenied } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { errorMessage } from '@/lib/api/errors';
import { useAttendanceToday, useClockIn, useClockOut } from '@/lib/api/hooks';
import { getCurrentPosition, minutesToLabel } from '@/lib/geolocation';
import { formatDateTime } from '@/lib/utils';
import { useTenant } from '../tenant-context';

const STATUS_LABEL: Record<string, string> = {
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  PENDING: 'Menunggu',
};

export function AttendanceClockPage() {
  const { tenant, can } = useTenant();
  const today = useAttendanceToday(tenant.id);
  const clockIn = useClockIn(tenant.id);
  const clockOut = useClockOut(tenant.id);
  const [siteId, setSiteId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  if (!can('attendance.read') && !can('attendance.clock')) return <AccessDenied />;

  const open = today.data?.openRecord ?? null;
  const sites = today.data?.sites ?? [];
  const selectedSiteId = siteId || sites[0]?.id || '';

  const punch = async (action: 'in' | 'out') => {
    setBusy(true);
    try {
      const pos = await getCurrentPosition();
      if (action === 'in') {
        if (!selectedSiteId) {
          toast.error('Pilih lokasi kerja terlebih dahulu');
          return;
        }
        await clockIn.mutateAsync({
          siteId: selectedSiteId,
          latitude: pos.latitude,
          longitude: pos.longitude,
        });
        toast.success('Absensi masuk berhasil');
      } else {
        await clockOut.mutateAsync({
          latitude: pos.latitude,
          longitude: pos.longitude,
        });
        toast.success('Absensi pulang — menunggu persetujuan atasan');
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Absensi"
        description="Masuk dan pulang di lokasi kerja dengan geofence. Peramban akan membagikan koordinat GPS Anda."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClockIcon className="size-5" /> Hari ini
            </CardTitle>
            <CardDescription>
              {today.data?.scheduleToday
                ? `Jadwal ${minutesToLabel(today.data.scheduleToday.startMinutes)}–${minutesToLabel(today.data.scheduleToday.endMinutes)}`
                : 'Tidak ada jadwal hari ini'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {open ? (
              <div className="rounded-lg border p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-medium">Masuk di {open.site.name}</p>
                  <Badge>Aktif</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{formatDateTime(open.clockInAt)}</p>
                {can('attendance.clock') && (
                  <Button
                    className="mt-4 w-full"
                    size="lg"
                    disabled={busy || clockOut.isPending}
                    onClick={() => void punch('out')}
                  >
                    {busy ? 'Mengambil lokasi…' : 'Pulang'}
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="site">
                    Lokasi kerja
                  </label>
                  <Select value={selectedSiteId} onValueChange={setSiteId}>
                    <SelectTrigger id="site" aria-label="Lokasi kerja">
                      <SelectValue placeholder="Pilih lokasi" />
                    </SelectTrigger>
                    <SelectContent>
                      {sites.map((site) => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.name} ({site.radiusMeters}m)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {can('attendance.clock') && (
                  <Button
                    size="lg"
                    disabled={busy || !selectedSiteId || clockIn.isPending}
                    onClick={() => void punch('in')}
                  >
                    {busy ? 'Mengambil lokasi…' : 'Masuk'}
                  </Button>
                )}
                {sites.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Belum ada lokasi aktif. Minta admin untuk mengonfigurasi lokasi absensi.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPinIcon className="size-5" /> Terbaru
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {(today.data?.recent ?? []).map((record) => (
                <li key={record.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{record.site.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(record.clockInAt)}
                      {record.clockOutAt ? ` → ${formatDateTime(record.clockOutAt)}` : ''}
                    </p>
                  </div>
                  <Badge
                    variant={
                      record.status === 'APPROVED'
                        ? 'success'
                        : record.status === 'REJECTED'
                          ? 'destructive'
                          : 'secondary'
                    }
                  >
                    {STATUS_LABEL[record.status] ?? record.status}
                  </Badge>
                </li>
              ))}
              {(today.data?.recent?.length ?? 0) === 0 && (
                <li className="py-6 text-center text-sm text-muted-foreground">
                  Belum ada catatan absensi
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
