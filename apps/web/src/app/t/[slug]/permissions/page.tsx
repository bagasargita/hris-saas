import type { Metadata } from 'next';
import { PermissionsPage } from '@/components/tenant/permissions-page';

export const metadata: Metadata = { title: 'Izin' };

export default function Page() {
  return <PermissionsPage />;
}
