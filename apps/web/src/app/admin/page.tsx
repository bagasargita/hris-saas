import type { Metadata } from 'next';
import { AdminTenantsPage } from '@/components/admin/admin-pages';

export const metadata: Metadata = { title: 'Platform · Tenant' };

export default function Page() {
  return <AdminTenantsPage />;
}
