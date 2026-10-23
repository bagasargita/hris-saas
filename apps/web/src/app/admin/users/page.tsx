import type { Metadata } from 'next';
import { AdminUsersPage } from '@/components/admin/admin-pages';
import { requireUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Platform · Users' };

export default async function Page() {
  const me = await requireUser('/admin/users');
  return <AdminUsersPage currentUserId={me.user.id} />;
}
