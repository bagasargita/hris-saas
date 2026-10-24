import type { Metadata } from 'next';
import { RolesPage } from '@/components/tenant/roles-page';

export const metadata: Metadata = { title: 'Peran' };

export default function Page() {
  return <RolesPage />;
}
