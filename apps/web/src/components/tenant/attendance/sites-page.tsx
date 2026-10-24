'use client';

import { PlusIcon, TrashIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { AttendanceSiteDto } from '@saas/contracts';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PageHeader } from '@/components/layout/page-header';
import { AccessDenied, EmptyState, ErrorState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage } from '@/lib/api/errors';
import {
  useAttendanceSites,
  useCreateAttendanceSite,
  useDeleteAttendanceSite,
  useUpdateAttendanceSite,
} from '@/lib/api/hooks';
import { useTenant } from '../tenant-context';
import { SiteLocationPicker } from './site-location-picker';

const emptyForm = {
  name: '',
  address: '',
  latitude: '-6.175392',
  longitude: '106.827153',
  radiusMeters: '150',
  timezone: 'Asia/Jakarta',
};

function SiteFormDialog({
  site,
  onClose,
}: {
  site: AttendanceSiteDto | null | 'new';
  onClose: () => void;
}) {
  const { tenant } = useTenant();
  const create = useCreateAttendanceSite(tenant.id);
  const update = useUpdateAttendanceSite(tenant.id);
  const editing = site && site !== 'new' ? site : null;
  const [form, setForm] = useState(() =>
    editing
      ? {
          name: editing.name,
          address: editing.address ?? '',
          latitude: String(editing.latitude),
          longitude: String(editing.longitude),
          radiusMeters: String(editing.radiusMeters),
          timezone: editing.timezone,
        }
      : emptyForm,
  );

  const latitude = Number(form.latitude);
  const longitude = Number(form.longitude);
  const radiusMeters = Number(form.radiusMeters);

  const save = () => {
    const payload = {
      name: form.name.trim(),
      address: form.address.trim() || undefined,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      radiusMeters: Number(form.radiusMeters),
      timezone: form.timezone.trim() || 'UTC',
    };
    if (!payload.name || Number.isNaN(payload.latitude) || Number.isNaN(payload.longitude)) {
      toast.error('Nama dan lokasi di peta wajib diisi');
      return;
    }
    if (editing) {
      update.mutate(
        { siteId: editing.id, ...payload },
        {
          onSuccess: () => {
            toast.success('Lokasi diperbarui');
            onClose();
          },
          onError: (e) => toast.error(errorMessage(e)),
        },
      );
    } else {
      create.mutate(payload, {
        onSuccess: () => {
          toast.success('Lokasi dibuat');
          onClose();
        },
        onError: (e) => toast.error(errorMessage(e)),
      });
    }
  };

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Ubah lokasi' : 'Lokasi kerja baru'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="name">Nama</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Kantor Pusat"
            />
          </div>

          <SiteLocationPicker
            latitude={latitude}
            longitude={longitude}
            radiusMeters={radiusMeters}
            address={form.address}
            onChange={({ latitude: lat, longitude: lng, address, suggestedName }) => {
              setForm((f) => ({
                ...f,
                latitude: String(lat),
                longitude: String(lng),
                address,
                name: f.name.trim() || suggestedName || f.name,
              }));
            }}
          />

          <div className="grid gap-1.5">
            <Label htmlFor="address">Alamat</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Terisi dari pencarian atau klik peta"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                value={form.latitude}
                onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                value={form.longitude}
                onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="radiusMeters">Radius (m)</Label>
              <Input
                id="radiusMeters"
                value={form.radiusMeters}
                onChange={(e) => setForm((f) => ({ ...f, radiusMeters: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="timezone">Zona waktu (IANA)</Label>
            <Input
              id="timezone"
              value={form.timezone}
              onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
              placeholder="Asia/Jakarta"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AttendanceSitesPage() {
  const { tenant, can } = useTenant();
  const sites = useAttendanceSites(tenant.id);
  const remove = useDeleteAttendanceSite(tenant.id);
  const [editing, setEditing] = useState<AttendanceSiteDto | null | 'new'>(null);
  const [deleting, setDeleting] = useState<AttendanceSiteDto | null>(null);

  if (!can('attendance.sites.manage')) return <AccessDenied />;

  return (
    <>
      <PageHeader
        title="Lokasi kerja"
        description="Lokasi dengan geofence untuk absensi masuk dan pulang. Pilih tempat di peta saat menambah lokasi."
        actions={
          <Button onClick={() => setEditing('new')}>
            <PlusIcon /> Tambah lokasi
          </Button>
        }
      />
      {sites.isPending && (
        <p className="py-10 text-center text-sm text-muted-foreground">Memuat lokasi…</p>
      )}
      {sites.isError && <ErrorState onRetry={() => void sites.refetch()} />}
      {sites.data && sites.data.length === 0 && (
        <EmptyState
          title="Belum ada lokasi"
          description="Buat geofence kantor atau lokasi kerja pertama Anda."
        />
      )}
      {sites.data && sites.data.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Nama</th>
                <th className="px-3 py-2 font-medium">Koordinat</th>
                <th className="px-3 py-2 font-medium">Radius</th>
                <th className="px-3 py-2 font-medium">Zona waktu</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {sites.data.map((site) => (
                <tr key={site.id} className="border-t">
                  <td className="px-3 py-2">
                    <p className="font-medium">{site.name}</p>
                    {site.address && (
                      <p className="text-xs text-muted-foreground">{site.address}</p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {site.latitude.toFixed(5)}, {site.longitude.toFixed(5)}
                  </td>
                  <td className="px-3 py-2">{site.radiusMeters}m</td>
                  <td className="px-3 py-2">{site.timezone}</td>
                  <td className="px-3 py-2">
                    <Badge variant={site.isActive ? 'success' : 'secondary'}>
                      {site.isActive ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(site)}>
                      Ubah
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Hapus ${site.name}`}
                      onClick={() => setDeleting(site)}
                    >
                      <TrashIcon />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <SiteFormDialog site={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Hapus lokasi?"
        description={deleting ? `${deleting.name} akan dihapus.` : ''}
        confirmLabel="Hapus"
        destructive
        pending={remove.isPending}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('Lokasi dihapus');
              setDeleting(null);
            },
            onError: (e) => toast.error(errorMessage(e)),
          });
        }}
      />
    </>
  );
}
