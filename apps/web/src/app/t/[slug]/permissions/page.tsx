import type { Metadata } from 'next';
import { PermissionsPage } from '@/components/tenant/permissions-page';

export const metadata: Metadata = { title: 'Permissions' };

export default function Page() {
  return <PermissionsPage />;
}
