'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PERMISSION_DEFINITIONS, type PermissionKey, type RoleDto } from '@saas/contracts';
import { FormAlert } from '@/components/auth/auth-card';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/misc';
import { errorMessage } from '@/lib/api/errors';
import { useCreateRole, useUpdateRole } from '@/lib/api/hooks';
import { useTenant } from './tenant-context';

const GROUPS = [...new Set(PERMISSION_DEFINITIONS.map((p) => p.group))];

export function RoleEditor({ role, onClose }: { role: RoleDto | null; onClose: () => void }) {
  const { tenant, can } = useTenant();
  const create = useCreateRole(tenant.id);
  const update = useUpdateRole(tenant.id);
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [permissions, setPermissions] = useState<Set<PermissionKey>>(
    () => new Set(role?.permissions ?? []),
  );
  const [error, setError] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;

  const toggle = (key: PermissionKey, checked: boolean) =>
    setPermissions((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });

  const save = async () => {
    setError(null);
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('Nama peran minimal 2 karakter.');
      return;
    }
    const input = {
      name: trimmed,
      description: description.trim() || undefined,
      permissions: [...permissions],
    };
    try {
      if (role) await update.mutateAsync({ roleId: role.id, ...input });
      else await create.mutateAsync(input);
      toast.success(role ? 'Peran diperbarui' : 'Peran dibuat');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{role ? `Ubah ${role.name}` : 'Buat peran'}</DialogTitle>
          <DialogDescription>
            Izin yang tidak Anda miliki tidak dapat diberikan dan dinonaktifkan.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {error && <FormAlert>{error}</FormAlert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="role-name" label="Nama">
              <Input
                id="role-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
              />
            </FormField>
            <FormField id="role-desc" label="Deskripsi (opsional)">
              <Textarea
                id="role-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={200}
                className="min-h-9"
                rows={1}
              />
            </FormField>
          </div>
          <div className="grid max-h-[50vh] gap-4 overflow-y-auto pr-1">
            {GROUPS.map((group) => (
              <fieldset key={group} className="rounded-lg border p-3">
                <legend className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {group}
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PERMISSION_DEFINITIONS.filter((p) => p.group === group).map((permission) => {
                    const allowed = can(permission.key);
                    return (
                      <label
                        key={permission.key}
                        className={`flex items-start gap-2.5 rounded-md p-2 ${allowed ? 'cursor-pointer hover:bg-accent/40' : 'opacity-50'}`}
                      >
                        <Checkbox
                          checked={permissions.has(permission.key)}
                          disabled={!allowed}
                          onCheckedChange={(checked) => toggle(permission.key, checked === true)}
                          className="mt-0.5"
                        />
                        <span className="grid gap-0.5">
                          <code className="text-xs font-medium">{permission.key}</code>
                          <span className="text-xs text-muted-foreground">
                            {permission.description}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Batal
          </Button>
          <Button onClick={() => void save()} disabled={pending}>
            {pending ? 'Menyimpan…' : role ? 'Simpan perubahan' : 'Buat peran'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
