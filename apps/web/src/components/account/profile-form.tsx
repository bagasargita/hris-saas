'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import type { UserDto } from '@saas/contracts';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiPatch } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import { queryKeys } from '@/lib/api/query-keys';

export function ProfileForm({ user }: { user: UserDto }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const trimmed = name.trim();

  const save = async () => {
    setSaving(true);
    try {
      await apiPatch<UserDto>('/users/me', { name: trimmed });
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
      toast.success('Profile updated');
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>This is how teammates see you across workspaces.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <FormField
          id="profile-name"
          label="Name"
          error={trimmed.length === 0 ? 'Name is required' : undefined}
        >
          <Input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            autoComplete="name"
          />
        </FormField>
        <FormField
          id="profile-email"
          label="Email"
          hint={user.emailVerified ? 'Verified' : 'Not verified'}
        >
          <Input id="profile-email" value={user.email} disabled readOnly />
        </FormField>
      </CardContent>
      <CardFooter className="justify-end">
        <Button
          onClick={() => void save()}
          disabled={saving || trimmed.length === 0 || trimmed === user.name}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </CardFooter>
    </Card>
  );
}
